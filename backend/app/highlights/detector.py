import asyncio
import logging
import subprocess
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from app.highlights.base import (
    BaseHighlightClassifier,
    BaseHighlightDetector,
    CandidateClipData,
)
from app.highlights.scorer import scorer
from app.video.probe import probe_video

logger = logging.getLogger(__name__)


class VisualSceneDetector(BaseHighlightDetector):
    def __init__(self, classifier: Optional[BaseHighlightClassifier] = None):
        self.classifier = classifier

    async def extract_candidates(
        self,
        video_path: Path,
        target_clip_duration: float = 25.0,
        sensitivity: float = 0.35,
        max_candidates: int = 8,
        progress_callback: Optional[object] = None,
    ) -> list[CandidateClipData]:
        """
        Extract candidate highlight clips using visual-change analysis.
        Runs asynchronously in thread pool so it does not block the event loop.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            self._analyze_video_sync,
            video_path,
            target_clip_duration,
            sensitivity,
            max_candidates,
            progress_callback,
        )

    def _extract_diff_timeline_ffmpeg(
        self,
        video_path: Path,
        sample_fps: float = 3.0,
        total_duration: float = 0.0,
        progress_callback: Optional[object] = None,
    ) -> list[tuple[float, float]]:
        """
        Decodes sampled grayscale frames using system FFmpeg with hardware acceleration.
        Bypasses slow full-frame OpenCV CPU decoders, achieving 10-15s scans for 4-minute 60 FPS videos.
        """
        # Try hardware accelerated CUDA decode first, fallback to standard CPU if unavailable
        cmd_cuda = [
            "ffmpeg",
            "-hwaccel", "cuda",
            "-v", "error",
            "-an",
            "-i", str(video_path),
            "-vf", f"fps={sample_fps},scale=160:90",
            "-f", "rawvideo",
            "-pix_fmt", "gray",
            "pipe:1",
        ]

        cmd_cpu = [
            "ffmpeg",
            "-v", "error",
            "-an",
            "-i", str(video_path),
            "-vf", f"fps={sample_fps},scale=160:90",
            "-f", "rawvideo",
            "-pix_fmt", "gray",
            "pipe:1",
        ]

        def _run_pipe(cmd: list[str]) -> list[tuple[float, float]]:
            diff_timeline: list[tuple[float, float]] = []
            frame_size = 160 * 90
            prev_gray = None
            frame_idx = 0
            expected_frames = max(1.0, total_duration * sample_fps) if total_duration > 0 else 1.0

            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                while True:
                    raw_bytes = proc.stdout.read(frame_size)
                    if len(raw_bytes) < frame_size:
                        break

                    current_time = frame_idx / sample_fps
                    gray = np.frombuffer(raw_bytes, dtype=np.uint8).reshape((90, 160))

                    if prev_gray is not None:
                        diff = float(np.mean(cv2.absdiff(gray, prev_gray))) / 255.0
                        diff_timeline.append((current_time, diff))

                    prev_gray = gray
                    frame_idx += 1

                    if progress_callback and frame_idx % 15 == 0:
                        pct = min(85.0, (frame_idx / expected_frames) * 85.0)
                        try:
                            progress_callback(pct, f"Analyzing visual timeline ({int(current_time)}s / {int(total_duration)}s)")
                        except Exception:
                            pass

                proc.communicate()
            except Exception as e:
                logger.error(f"FFmpeg pipeline reading failed: {e}")
                try:
                    proc.kill()
                except Exception:
                    pass

            return diff_timeline

        # Attempt CUDA decode
        try:
            timeline = _run_pipe(cmd_cuda)
            if timeline:
                logger.info(f"FFmpeg CUDA frame reader decoded {len(timeline)} sample frames from {video_path.name}")
                return timeline
        except Exception as e:
            logger.warning(f"FFmpeg CUDA decode failed ({e}), falling back to CPU decode")

        # Fallback to CPU decode
        timeline = _run_pipe(cmd_cpu)
        logger.info(f"FFmpeg CPU frame reader decoded {len(timeline)} sample frames from {video_path.name}")
        return timeline

    def _analyze_video_sync(
        self,
        video_path: Path,
        target_clip_duration: float,
        sensitivity: float,
        max_candidates: int,
        progress_callback: Optional[object] = None,
    ) -> list[CandidateClipData]:
        meta = probe_video(video_path)
        total_duration = meta.duration

        if total_duration <= 0:
            return []

        if progress_callback:
            try:
                progress_callback(5.0, "Starting fast hardware-accelerated stream scan")
            except Exception:
                pass

        # If video is already shorter than target clip duration, return entire video as 1 candidate
        if total_duration <= target_clip_duration + 2.0:
            return [
                CandidateClipData(
                    start_time=0.0,
                    end_time=round(total_duration, 2),
                    duration=round(total_duration, 2),
                    score=85.0,
                    rank=1,
                    representative_timestamp=round(total_duration / 2.0, 2),
                    detection_method="full_video",
                    tags=["whole_clip"],
                )
            ]

        # Use fast downsampled FFmpeg pipeline (GPU accelerated with CPU fallback)
        diff_timeline = self._extract_diff_timeline_ffmpeg(
            video_path=video_path,
            sample_fps=3.0,
            total_duration=total_duration,
            progress_callback=progress_callback,
        )

        if not diff_timeline:
            logger.warning(f"Could not extract visual diff timeline for {video_path.name}")
            return []

        if progress_callback:
            try:
                progress_callback(88.0, "Clustering scene changes and motion energy peaks")
            except Exception:
                pass

        # Threshold for cut / major scene change
        cut_threshold = max(0.12, 0.45 - (sensitivity * 0.3))

        # Find timestamps of scene changes
        scene_cuts: list[float] = [
            t for t, diff in diff_timeline if diff >= cut_threshold
        ]

        # Slide a window of target_clip_duration across timeline
        step_window = max(5.0, target_clip_duration / 3.0)
        num_windows = int(max(1, (total_duration - target_clip_duration) / step_window)) + 1

        candidates_raw: list[tuple[float, float, float, float, int]] = []
        # (score, start, end, rep_t, cuts_count)

        for i in range(num_windows):
            start = i * step_window
            end = min(total_duration, start + target_clip_duration)
            if end - start < 8.0:
                continue

            # Compute window metrics
            window_diffs = [
                d for t, d in diff_timeline if start <= t <= end
            ]
            cuts_in_window = [
                c for c in scene_cuts if start <= c <= end
            ]

            avg_energy = float(np.mean(window_diffs)) if window_diffs else 0.05
            peak_moment = start + (end - start) / 2.0

            # Find peak motion moment in window for thumbnail
            if window_diffs:
                best_t = max(
                    [item for item in diff_timeline if start <= item[0] <= end],
                    key=lambda x: x[1],
                    default=(peak_moment, 0.0)
                )[0]
                peak_moment = best_t

            calculated_score = scorer.calculate_candidate_score(
                motion_energy=avg_energy,
                scene_cuts_count=len(cuts_in_window),
                duration=end - start,
                target_duration=target_clip_duration,
            )

            candidates_raw.append(
                (calculated_score, start, end, peak_moment, len(cuts_in_window))
            )

        # Sort by score descending
        candidates_raw.sort(key=lambda x: x[0], reverse=True)

        # Non-maximum suppression: Avoid candidates that overlap by >55%
        filtered: list[CandidateClipData] = []
        for cand_score, start, end, rep_t, cuts_count in candidates_raw:
            overlaps = False
            for existing in filtered:
                overlap_start = max(start, existing.start_time)
                overlap_end = min(end, existing.end_time)
                overlap_len = max(0.0, overlap_end - overlap_start)
                min_len = min(end - start, existing.duration)
                if min_len > 0 and (overlap_len / min_len) > 0.55:
                    overlaps = True
                    break

            if not overlaps:
                filtered.append(
                    CandidateClipData(
                        start_time=round(start, 2),
                        end_time=round(end, 2),
                        duration=round(end - start, 2),
                        score=cand_score,
                        rank=len(filtered) + 1,
                        representative_timestamp=round(rep_t, 2),
                        detection_method="visual_scene",
                        tags=["action_rush"] if cuts_count >= 1 else ["smooth_play"],
                    )
                )

            if len(filtered) >= max_candidates:
                break

        # Re-assign ranks 1..N
        for idx, item in enumerate(filtered):
            item.rank = idx + 1

        return filtered


highlight_detector = VisualSceneDetector()
