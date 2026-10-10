import asyncio
from pathlib import Path
import sys
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.video.processor import (
    ShortRenderConfig,
    VideoProcessor,
    escape_drawtext_text,
    video_processor,
)
from app.video.probe import probe_video


def test_escape_drawtext_text():
    text = "Goal by Messi: 100% Curler 'Masterclass'!"
    escaped = escape_drawtext_text(text)
    assert "\\:" in escaped
    assert "\\%" in escaped
    assert "'\\''" in escaped


def test_filtergraph_construction_blurred():
    proc = VideoProcessor()
    config = ShortRenderConfig(
        input_path=Path("/tmp/sample.mp4"),
        output_path=Path("/tmp/out.mp4"),
        start_time=0.0,
        end_time=5.0,
        layout="blurred_background",
        branding_enabled=True,
        branding_text="JOVYX | eFootball",
        caption_enabled=True,
        caption_text="Incredible Curler",
    )
    v_graph, a_graph = proc.build_filtergraph(config, has_audio=True)
    assert "boxblur" in v_graph
    assert "overlay=" in v_graph
    assert "JOVYX" in v_graph
    assert "Incredible Curler" in v_graph
    assert a_graph is not None


def test_filtergraph_construction_crop():
    proc = VideoProcessor()
    config = ShortRenderConfig(
        input_path=Path("/tmp/sample.mp4"),
        output_path=Path("/tmp/out.mp4"),
        start_time=0.0,
        end_time=5.0,
        layout="center_crop",
        slow_motion=True,
        vignette=True,
    )
    v_graph, a_graph = proc.build_filtergraph(config, has_audio=True)
    assert "crop=1080:1920" in v_graph
    assert "setpts=2.0*PTS" in v_graph
    assert "vignette" in v_graph
    assert "atempo=0.5" in a_graph


@pytest.mark.asyncio
async def test_render_actual_vertical_short(tmp_path):
    fixture_path = Path(__file__).resolve().parent / "fixtures" / "sample_efootball.mp4"
    out_path = tmp_path / "rendered_short.mp4"

    config = ShortRenderConfig(
        input_path=fixture_path,
        output_path=out_path,
        start_time=0.0,
        end_time=2.0,
        layout="blurred_background",
        branding_enabled=True,
        branding_text="JOVYX TEST",
        encoder_preference="cpu",  # CPU for predictable CI/testing
    )

    progresses = []
    def on_progress(p):
        progresses.append(p)

    encoder = await video_processor.render_short(config, progress_callback=on_progress)
    assert out_path.exists(), "Rendered MP4 must exist"
    assert out_path.stat().st_size > 1000

    meta = probe_video(out_path)
    assert meta.width == 1080
    assert meta.height == 1920
    assert meta.duration > 1.8
    assert len(progresses) > 0
    assert progresses[-1] == 100.0
