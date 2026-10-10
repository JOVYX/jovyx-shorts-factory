from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


@dataclass
class CandidateClipData:
    start_time: float
    end_time: float
    duration: float
    score: float
    rank: int = 1
    representative_timestamp: float = 0.0
    detection_method: str = "visual_change"
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseHighlightClassifier(ABC):
    """
    Interface for future vision-model or AI-based highlight classification.
    Allows plugging in lightweight vision models (e.g. goal detection, celebration detection)
    without modifying the core detector pipeline.
    """

    @abstractmethod
    async def classify_clip(
        self,
        video_path: Path,
        start_time: float,
        end_time: float
    ) -> float:
        """
        Returns a confidence score between 0.0 and 1.0 indicating highlight probability.
        """
        pass


class BaseHighlightDetector(ABC):
    """
    Base interface for highlight extraction pipelines.
    """

    @abstractmethod
    async def extract_candidates(
        self,
        video_path: Path,
        target_clip_duration: float = 25.0,
        sensitivity: float = 0.35,
        max_candidates: int = 8,
    ) -> list[CandidateClipData]:
        pass
