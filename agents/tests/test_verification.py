"""Tests for PRM chain scoring and pattern detection.

Verifies the scoring algorithm from prm-verifier.ts is faithfully ported.
"""


from src.tools.verification import compute_chain_score, detect_patterns


class TestComputeChainScore:
    def test_empty_returns_zero(self):
        assert compute_chain_score([]) == 0.0

    def test_all_correct_high_confidence(self):
        steps = [
            {"verdict": "correct", "confidence": 0.9, "issues": []},
            {"verdict": "correct", "confidence": 0.9, "issues": []},
            {"verdict": "correct", "confidence": 0.9, "issues": []},
        ]
        score = compute_chain_score(steps)
        # geo_mean(0.9^3) = 0.9
        assert score == 0.9

    def test_single_incorrect_penalizes(self):
        steps = [
            {"verdict": "correct", "confidence": 0.9, "issues": []},
            {"verdict": "incorrect", "confidence": 0.7, "issues": []},
            {"verdict": "correct", "confidence": 0.9, "issues": []},
        ]
        score = compute_chain_score(steps)
        # 0.9 * (1-0.7)*0.3 * 0.9 = 0.9 * 0.09 * 0.9 = 0.0729
        # geo_mean = 0.0729^(1/3) ≈ 0.4176 → rounds to 0.42
        assert score == 0.42

    def test_all_uncertain(self):
        steps = [
            {"verdict": "uncertain", "confidence": 0.5, "issues": []},
            {"verdict": "uncertain", "confidence": 0.5, "issues": []},
        ]
        score = compute_chain_score(steps)
        # 0.7 * 0.7 = 0.49, geo_mean = 0.49^(1/2) = 0.7
        assert score == 0.7

    def test_all_neutral(self):
        steps = [
            {"verdict": "neutral", "confidence": 0.5, "issues": []},
            {"verdict": "neutral", "confidence": 0.5, "issues": []},
            {"verdict": "neutral", "confidence": 0.5, "issues": []},
        ]
        score = compute_chain_score(steps)
        # 0.9^3 = 0.729, geo_mean = 0.729^(1/3) = 0.9
        assert score == 0.9

    def test_mixed_verdicts(self):
        steps = [
            {"verdict": "correct", "confidence": 0.9, "issues": []},
            {"verdict": "correct", "confidence": 0.85, "issues": []},
            {"verdict": "incorrect", "confidence": 0.7, "issues": []},
            {"verdict": "correct", "confidence": 0.8, "issues": []},
        ]
        score = compute_chain_score(steps)
        # Manual: 0.9 * 0.85 * 0.09 * 0.8 = 0.05508
        # geo_mean = 0.05508^(1/4) ≈ 0.4843 → 0.48
        assert score == 0.48

    def test_confidence_matters_for_incorrect(self):
        """High confidence incorrect is MORE penalizing than low confidence incorrect."""
        high_conf = [{"verdict": "incorrect", "confidence": 0.95, "issues": []}]
        low_conf = [{"verdict": "incorrect", "confidence": 0.3, "issues": []}]

        # incorrect: (1-conf)*0.3
        # high: (1-0.95)*0.3 = 0.015
        # low: (1-0.3)*0.3 = 0.21
        assert compute_chain_score(high_conf) < compute_chain_score(low_conf)


class TestDetectPatterns:
    def test_empty_returns_empty(self):
        assert detect_patterns([]) == []

    def test_declining_confidence(self):
        steps = [
            {"verdict": "correct", "confidence": 0.9, "issues": []},
            {"verdict": "correct", "confidence": 0.7, "issues": []},
            {"verdict": "correct", "confidence": 0.6, "issues": []},
        ]
        patterns = detect_patterns(steps)
        names = [p["name"] for p in patterns]
        assert "declining_confidence" in names

    def test_no_declining_if_drop_too_small(self):
        steps = [
            {"verdict": "correct", "confidence": 0.9, "issues": []},
            {"verdict": "correct", "confidence": 0.85, "issues": []},
            {"verdict": "correct", "confidence": 0.8, "issues": []},
        ]
        patterns = detect_patterns(steps)
        names = [p["name"] for p in patterns]
        assert "declining_confidence" not in names  # Drop = 0.1, threshold = 0.2

    def test_recurring_issues(self):
        steps = [
            {"verdict": "incorrect", "confidence": 0.6, "issues": [{"type": "logical_error"}]},
            {"verdict": "correct", "confidence": 0.9, "issues": []},
            {"verdict": "incorrect", "confidence": 0.5, "issues": [{"type": "logical_error"}]},
        ]
        patterns = detect_patterns(steps)
        names = [p["name"] for p in patterns]
        assert "recurring_logical_error" in names

    def test_overconfidence_before_error(self):
        steps = [
            {"verdict": "correct", "confidence": 0.95, "issues": []},
            {"verdict": "incorrect", "confidence": 0.6, "issues": []},
        ]
        patterns = detect_patterns(steps)
        names = [p["name"] for p in patterns]
        assert "overconfidence_before_error" in names

    def test_no_overconfidence_if_below_threshold(self):
        steps = [
            {"verdict": "correct", "confidence": 0.7, "issues": []},
            {"verdict": "incorrect", "confidence": 0.6, "issues": []},
        ]
        patterns = detect_patterns(steps)
        names = [p["name"] for p in patterns]
        assert "overconfidence_before_error" not in names  # 0.7 < 0.8 threshold
