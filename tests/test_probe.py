import pytest
from pathlib import Path
import sys

# Ensure backend is on PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.video.probe import probe_video, parse_fps


def test_parse_fps():
    assert parse_fps("60/1") == 60.0
    assert parse_fps("30") == 30.0
    assert abs(parse_fps("60000/1001") - 59.94) < 0.01
    assert parse_fps("invalid") == 30.0


def test_probe_sample_video():
    fixture_path = Path(__file__).resolve().parent / "fixtures" / "sample_efootball.mp4"
    assert fixture_path.exists(), "Sample video fixture should exist"

    meta = probe_video(fixture_path)
    assert meta.duration > 2.5
    assert meta.width == 1920
    assert meta.height == 1080
    assert meta.fps == 30.0
    assert meta.has_audio is True
    assert meta.file_size > 0


def test_probe_nonexistent_file():
    with pytest.raises(FileNotFoundError):
        probe_video("/tmp/non_existent_efootball_video.mp4")
