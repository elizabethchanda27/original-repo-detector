"""Check whether GitHub records a repository as the original, a fork, or generated from a template."""

from original_repo_detector.detect import Detection, detect

__all__ = ["Detection", "detect"]
