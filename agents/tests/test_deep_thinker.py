"""Tests for DeepThinker agent logic (no API calls).

Tests the ported V1 algorithms: confidence scoring, decision point extraction.
"""


from src.agents.deep_thinker import (
    calculate_confidence_score,
    extract_decision_points,
)


class TestConfidenceScoring:
    def test_empty_text_returns_half(self):
        assert calculate_confidence_score("") == 0.5

    def test_high_confidence_language(self):
        text = "I am certainly confident. This is clearly the right approach. The evidence is undoubtedly strong."
        score = calculate_confidence_score(text)
        assert score > 0.7

    def test_low_confidence_language(self):
        text = "I am uncertain about this. It might work, possibly, but I'm unsure."
        score = calculate_confidence_score(text)
        assert score < 0.5

    def test_medium_confidence_language(self):
        text = "This likely works based on the evidence. It appears to be a reasonable approach."
        score = calculate_confidence_score(text)
        assert 0.4 < score < 0.8

    def test_long_text_gets_depth_bonus(self):
        short = "Good analysis."
        long = "Detailed analysis. " * 200  # ~3600 chars
        score_short = calculate_confidence_score(short)
        score_long = calculate_confidence_score(long)
        # Long text gets depth bonus, but both lack explicit indicators
        # so the difference should be visible
        assert score_long > score_short

    def test_decision_language_gets_bonus(self):
        no_decision = "The sky is blue. Water is wet."
        with_decision = "Therefore, I concluded that the best approach is X. I decided to go with option A."
        score_no = calculate_confidence_score(no_decision)
        score_yes = calculate_confidence_score(with_decision)
        assert score_yes > score_no

    def test_score_is_clamped(self):
        """Score should always be between 0.15 and 0.95."""
        score = calculate_confidence_score("certainly definitely clearly absolutely confident")
        assert 0.15 <= score <= 0.95

    def test_deterministic_for_same_input(self):
        """Same input should always produce the same score."""
        text = "Some reasoning about the problem at hand."
        score1 = calculate_confidence_score(text)
        score2 = calculate_confidence_score(text)
        assert score1 == score2

    def test_never_returns_exactly_half(self):
        """The scoring avoids returning exactly 0.5 for visual variety."""
        score = calculate_confidence_score("a")
        assert abs(score - 0.5) >= 0.03


class TestDecisionPointExtraction:
    def test_empty_text(self):
        assert extract_decision_points("") == []

    def test_explicit_decision(self):
        text = "I could either use Python or JavaScript for this project."
        points = extract_decision_points(text)
        assert len(points) >= 1

    def test_option_markers(self):
        text = "Option A provides better performance. Option B is simpler."
        points = extract_decision_points(text)
        assert len(points) >= 1

    def test_on_one_hand(self):
        text = "On one hand we get speed. On the other hand we lose flexibility."
        points = extract_decision_points(text)
        assert len(points) >= 1

    def test_trade_offs(self):
        text = "The trade-off between speed and accuracy is important."
        points = extract_decision_points(text)
        assert len(points) >= 1

    def test_conclusion_markers(self):
        text = "Therefore the best approach is to use caching."
        points = extract_decision_points(text)
        assert len(points) >= 1

    def test_however_rejection(self):
        text = "However, this approach is not ideal for our use case."
        points = extract_decision_points(text)
        assert len(points) >= 1

    def test_one_match_per_sentence(self):
        """Each sentence should produce at most one decision point."""
        text = "I could either choose Option A vs Option B with trade-offs."
        points = extract_decision_points(text)
        assert len(points) == 1  # One sentence = one match max
