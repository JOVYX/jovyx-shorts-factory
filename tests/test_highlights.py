import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.highlights.scorer import HighlightScorer
from app.highlights.detector import VisualSceneDetector
from app.highlights.reference_analyzer import reference_analyzer


def test_highlight_scorer():
    scorer = HighlightScorer()
    
    # High energy, optimal cuts (2), optimal duration (25s)
    score1 = scorer.calculate_candidate_score(
        motion_energy=0.8,
        scene_cuts_count=2,
        duration=25.0,
        target_duration=25.0,
        historical_feedback_bias=5.0
    )
    assert 85.0 <= score1 <= 99.0

    # Low energy, 0 cuts, duration far from target
    score2 = scorer.calculate_candidate_score(
        motion_energy=0.05,
        scene_cuts_count=0,
        duration=5.0,
        target_duration=25.0,
    )
    assert score2 < score1


@pytest.mark.asyncio
async def test_scene_detector_extraction():
    fixture_path = Path(__file__).resolve().parent / "fixtures" / "sample_efootball.mp4"
    detector = VisualSceneDetector()

    candidates = await detector.extract_candidates(
        video_path=fixture_path,
        target_clip_duration=2.0,
        sensitivity=0.35,
        max_candidates=4,
    )
    assert len(candidates) >= 1
    assert candidates[0].duration > 0
    assert candidates[0].score > 0
    assert candidates[0].rank == 1


@pytest.mark.asyncio
async def test_reference_analyzer():
    fixture_path = Path(__file__).resolve().parent / "fixtures" / "sample_efootball.mp4"
    profile = await reference_analyzer.analyze(fixture_path)
    assert profile.duration > 2.0
    assert profile.detected_layout in ("blurred_background", "center_crop")
    assert profile.color_grading in ("vibrant", "cinematic", "natural")
    assert len(profile.editing_formula) > 0
    assert "name" in profile.preset_template
