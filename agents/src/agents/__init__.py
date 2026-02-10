"""Opus NX swarm agents."""

from .base import BaseOpusAgent
from .contrarian import ContrarianAgent
from .deep_thinker import DeepThinkerAgent
from .metacognition import MetacognitionAgent
from .synthesizer import SynthesizerAgent
from .verifier import VerifierAgent

__all__ = [
    "BaseOpusAgent",
    "ContrarianAgent",
    "DeepThinkerAgent",
    "MetacognitionAgent",
    "SynthesizerAgent",
    "VerifierAgent",
]
