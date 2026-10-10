import math
from typing import Optional


class HighlightScorer:
    """
    Candidate highlight ranking scorer.
    Combines visual dynamics, cut frequency, and user feedback learning.
    """

    def calculate_candidate_score(
        self,
        motion_energy: float,
        scene_cuts_count: int,
        duration: float,
        target_duration: float = 25.0,
        historical_feedback_bias: float = 0.0,
    ) -> float:
        """
        Calculates a ranking score in range [0.0, 100.0].
        - High motion/visual dynamism rewards score
        - Optimal clip duration pacing (penalizes clips that are too short or too long)
        - Scene changes reward score up to an optimal excitement density
        - Incorporates feedback bias
        """
        # 1. Motion/Dynamics component (0 - 45 pts)
        motion_score = min(45.0, motion_energy * 45.0)

        # 2. Action density / Cuts component (0 - 35 pts)
        # 1-3 cuts in a 20-30s mobile clip represents build-up + goal + celebration/replay
        if scene_cuts_count == 0:
            cuts_score = 15.0
        elif 1 <= scene_cuts_count <= 4:
            cuts_score = 35.0
        else:
            cuts_score = max(10.0, 35.0 - (scene_cuts_count - 4) * 5.0)

        # 3. Duration pacing penalty (0 - 20 pts)
        duration_diff = abs(duration - target_duration)
        duration_score = max(0.0, 20.0 - (duration_diff / 5.0) * 3.0)

        raw_score = motion_score + cuts_score + duration_score + historical_feedback_bias
        return round(max(5.0, min(99.0, raw_score)), 1)


scorer = HighlightScorer()
