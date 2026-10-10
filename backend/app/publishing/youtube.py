import asyncio
import datetime
import http.client
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Callable, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from app.config import settings

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
]

RETRIABLE_STATUS_CODES = [500, 502, 503, 504]
RETRIABLE_EXCEPTIONS = (
    HttpError,
    http.client.HTTPException,
    IOError,
)


class YouTubePublishingService:
    def __init__(self):
        self._cached_service = None

    def is_configured(self) -> bool:
        return bool(settings.youtube_client_id and settings.youtube_client_secret)

    def create_oauth_flow(self) -> Flow:
        """Create Google OAuth Flow using client credentials."""
        client_config = {
            "web": {
                "client_id": settings.youtube_client_id,
                "client_secret": settings.youtube_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.youtube_redirect_uri],
            }
        }
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=settings.youtube_redirect_uri,
        )
        return flow

    def get_authorization_url(self) -> str:
        """Generates Google OAuth 2.0 authorization URL."""
        if not self.is_configured():
            raise ValueError(
                "YouTube Client ID and Client Secret must be configured in Settings or .env"
            )
        flow = self.create_oauth_flow()
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        return auth_url

    def exchange_code_for_tokens(self, code: str) -> dict[str, Any]:
        """Exchanges auth code from callback for access and refresh tokens."""
        flow = self.create_oauth_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials

        return {
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": " ".join(credentials.scopes or SCOPES),
            "expiry": credentials.expiry,
        }

    def build_credentials(self, token_data: dict[str, Any]) -> Credentials:
        creds = Credentials(
            token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=token_data.get("client_id", settings.youtube_client_id),
            client_secret=token_data.get("client_secret", settings.youtube_client_secret),
            scopes=SCOPES,
        )
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
        return creds

    async def get_channel_info(self, token_data: dict[str, Any]) -> dict[str, str]:
        """Fetch authenticated channel name and ID."""
        creds = self.build_credentials(token_data)
        youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)

        loop = asyncio.get_running_loop()

        def _fetch():
            res = youtube.channels().list(mine=True, part="snippet").execute()
            items = res.get("items", [])
            if items:
                snippet = items[0].get("snippet", {})
                return {
                    "channel_id": items[0].get("id", ""),
                    "channel_title": snippet.get("title", "YouTube Channel"),
                }
            return {"channel_id": "", "channel_title": "Authenticated Channel"}

        return await loop.run_in_executor(None, _fetch)

    async def upload_short(
        self,
        token_data: dict[str, Any],
        video_path: Path,
        title: str,
        description: str,
        tags: Optional[list[str]] = None,
        privacy_status: str = "private",  # Mandatory initial private status
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> tuple[str, str]:
        """
        Uploads vertical MP4 using resumable upload protocol.
        Safely retries on transient network errors.
        Returns (video_id, video_url).
        """
        v_path = Path(video_path).resolve()
        if not v_path.exists():
            raise FileNotFoundError(f"Video file to upload does not exist: {v_path}")

        # Ensure privacy status is safe (default to private if not explicitly set)
        if privacy_status not in ["private", "unlisted", "public"]:
            privacy_status = "private"

        creds = self.build_credentials(token_data)
        youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)

        body = {
            "snippet": {
                "title": title[:100],
                "description": description[:5000],
                "tags": tags or ["eFootball", "eFootballMobile", "Shorts", "Gaming"],
                "categoryId": "20",  # 20 = Gaming
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False,
            },
        }

        # Media upload with 1MB chunk size for resumable progress tracking
        media = MediaFileUpload(
            str(v_path),
            chunksize=1024 * 1024,
            resumable=True,
            mimetype="video/mp4",
        )

        request = youtube.videos().insert(
            part="snippet,status",
            body=body,
            media_body=media,
        )

        loop = asyncio.get_running_loop()

        def _do_upload() -> str:
            response = None
            retry = 0
            max_retries = 5

            while response is None:
                try:
                    status, response = request.next_chunk()
                    if status and progress_callback:
                        pct = round(status.progress() * 100.0, 1)
                        progress_callback(pct)
                except RETRIABLE_EXCEPTIONS as e:
                    retry += 1
                    if retry > max_retries:
                        raise RuntimeError(f"Exceeded upload retries due to error: {e}")
                    sleep_secs = 2 ** retry
                    logger.warning(f"Retrying upload in {sleep_secs}s due to error: {e}")
                    time.sleep(sleep_secs)

            if progress_callback:
                progress_callback(100.0)

            video_id = response.get("id")
            if not video_id:
                raise RuntimeError("YouTube upload completed but no video ID returned")

            return video_id

        video_id = await loop.run_in_executor(None, _do_upload)
        video_url = f"https://www.youtube.com/shorts/{video_id}"
        return video_id, video_url


youtube_service = YouTubePublishingService()
