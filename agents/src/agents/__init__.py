"""Opus NX swarm agents."""

from .base import BaseOpusAgent
from .contrarian import ContrarianAgent
from .deep_thinker import DeepThinkerAgent
from .maestro import MaestroAgent
from .metacognition import MetacognitionAgent
from .synthesizer import SynthesizerAgent
from .verifier import VerifierAgent

__all__ = [
    "BaseOpusAgent",
    "ContrarianAgent",
    "DeepThinkerAgent",
    "MaestroAgent",
    "MetacognitionAgent",
    "SynthesizerAgent",
    "VerifierAgent",
]
