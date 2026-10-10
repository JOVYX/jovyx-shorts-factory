import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.db import get_db
from app.database.models import OAuthToken, PublishingRecord, Short
from app.models.schemas import PublishingRecordResponse, YouTubePublishRequest
from app.publishing.youtube import youtube_service
from app.services.jobs import job_queue

router = APIRouter(prefix="/publishing", tags=["Publishing"])


@router.get("/status")
async def get_publishing_status(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(OAuthToken).where(OAuthToken.id == "youtube"))
    token = res.scalar_one_or_none()
    return {
        "configured": youtube_service.is_configured(),
        "authenticated": token is not None,
        "channel_title": token.channel_title if token else None,
        "channel_id": token.channel_id if token else None,
        "redirect_uri": settings.youtube_redirect_uri,
    }


@router.get("/youtube/auth-url")
async def get_youtube_auth_url():
    if not youtube_service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="YouTube Client ID and Client Secret must be set in Settings or .env file before authenticating.",
        )
    try:
        url = youtube_service.get_authorization_url()
        return {"authorization_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/youtube/callback", response_class=HTMLResponse)
async def youtube_oauth_callback(
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if error:
        return HTMLResponse(
            f"<html><body style='background:#121212;color:#fff;font-family:sans-serif;padding:40px;'>"
            f"<h2>Authentication Cancelled</h2><p>Error: {error}</p>"
            f"<script>window.opener && window.opener.postMessage('yt_oauth_error', '*'); setTimeout(()=>window.close(), 3000);</script>"
            f"</body></html>"
        )
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    try:
        tokens = youtube_service.exchange_code_for_tokens(code)
        channel_info = await youtube_service.get_channel_info(tokens)

        # Upsert OAuth token in database
        res = await db.execute(select(OAuthToken).where(OAuthToken.id == "youtube"))
        oauth_token = res.scalar_one_or_none()
        if not oauth_token:
            oauth_token = OAuthToken(id="youtube")
            db.add(oauth_token)

        oauth_token.access_token = tokens["access_token"]
        oauth_token.refresh_token = tokens.get("refresh_token")
        oauth_token.token_uri = tokens.get("token_uri", "https://oauth2.googleapis.com/token")
        oauth_token.client_id = tokens.get("client_id", settings.youtube_client_id)
        oauth_token.client_secret = tokens.get("client_secret", settings.youtube_client_secret)
        oauth_token.scopes = tokens.get("scopes", "")
        oauth_token.expiry = tokens.get("expiry")
        oauth_token.channel_title = channel_info.get("channel_title")
        oauth_token.channel_id = channel_info.get("channel_id")

        await db.commit()

        return HTMLResponse(
            f"<html><body style='background:#121212;color:#fff;font-family:sans-serif;padding:40px;text-align:center;'>"
            f"<h2 style='color:#4ade80;'>YouTube Account Connected!</h2>"
            f"<p>Connected Channel: <strong>{channel_info.get('channel_title')}</strong></p>"
            f"<p>You can close this window now.</p>"
            f"<script>window.opener && window.opener.postMessage('yt_oauth_success', '*'); setTimeout(()=>window.close(), 2500);</script>"
            f"</body></html>"
        )
    except Exception as e:
        return HTMLResponse(
            f"<html><body style='background:#121212;color:#fff;font-family:sans-serif;padding:40px;'>"
            f"<h2 style='color:#f87171;'>Authentication Failed</h2><p>{str(e)}</p>"
            f"</body></html>",
            status_code=500,
        )


@router.post("/youtube/upload", response_model=PublishingRecordResponse)
async def publish_short_to_youtube(
    req: YouTubePublishRequest,
    db: AsyncSession = Depends(get_db),
):
    # Retrieve short
    res = await db.execute(select(Short).where(Short.id == req.short_id))
    short = res.scalar_one_or_none()
    if not short:
        raise HTTPException(status_code=404, detail="Short not found")
    if not short.output_path or not Path(short.output_path).exists():
        raise HTTPException(status_code=400, detail="Short has not been rendered yet")

    # Verify short approval requirement: initially uploads require approval
    if short.status not in ["approved", "rendered"]:
        raise HTTPException(
            status_code=400,
            detail="Short must be reviewed and approved before uploading.",
        )

    # Check OAuth token exists
    token_res = await db.execute(select(OAuthToken).where(OAuthToken.id == "youtube"))
    if not token_res.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="YouTube is not authenticated. Please connect your YouTube account in Settings first.",
        )

    # Apply title/description overrides if provided
    if req.title:
        short.title = req.title
    if req.description:
        short.description = req.description
    await db.commit()

    record_id = uuid.uuid4().hex
    pub_record = PublishingRecord(
        id=record_id,
        short_id=short.id,
        platform="youtube",
        privacy_status="private",  # Strictly start as private as per requirement
        status="pending",
        upload_progress=0.0,
    )
    db.add(pub_record)
    short.status = "uploading"
    await db.commit()
    await db.refresh(pub_record)

    task_id = job_queue.spawn_youtube_upload(record_id)

    return pub_record


@router.get("/history", response_model=list[PublishingRecordResponse])
async def list_publishing_history(db: AsyncSession = Depends(get_db)):
    stmt = select(PublishingRecord).order_by(PublishingRecord.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()
