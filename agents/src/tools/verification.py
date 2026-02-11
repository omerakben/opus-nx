"""PRM verification scoring and pattern detection.

Ported from V1 prm-verifier.ts:
- Geometric mean scoring (lines 326-356)
- Pattern detection (lines 362-417)

Based on "Let's Verify Step by Step" (Lightman et al., 2023).
"""

from __future__ import annotations


def compute_chain_score(step_scores: list[dict]) -> float:
    """Compute overall chain score using the PRM approach.

    The chain score is the product of individual step confidence scores
    for correct steps, penalized by incorrect steps. Uses geometric mean
    to prevent very long chains from always scoring near 0.

    Ported from prm-verifier.ts lines 326-356.
    """
    if not step_scores:
        return 0.0

    score = 1.0

    for step in step_scores:
        verdict = step.get("verdict", "uncertain")
        confidence = step.get("confidence", 0.5)

        match verdict:
            case "correct":
                # Multiply by confidence — high confidence correct steps maintain score
                score *= confidence
            case "incorrect":
                # Incorrect steps severely penalize the chain
                score *= (1 - confidence) * 0.3
            case "neutral":
                # Neutral steps slightly reduce score
                score *= 0.9
            case "uncertain":
                # Uncertain steps moderately reduce score
                score *= 0.7

    # Normalize: geometric mean prevents long chains from always scoring near 0
    geo_mean = score ** (1.0 / max(len(step_scores), 1))
    return round(geo_mean, 2)


def detect_patterns(step_scores: list[dict]) -> list[dict]:
    """Detect patterns across verified steps.

    Looks for recurring issues, declining confidence, and
    overconfidence-before-error sequences.

    Ported from prm-verifier.ts lines 362-417.
    """
    patterns: list[dict] = []

    # Pattern: Declining confidence
    confidences = [s.get("confidence", 0.5) for s in step_scores]
    if len(confidences) >= 3:
        is_decreasing = all(
            confidences[i] <= confidences[i - 1]
            for i in range(1, len(confidences))
        )
        if is_decreasing and (confidences[0] - confidences[-1]) > 0.2:
            patterns.append({
                "name": "declining_confidence",
                "description": (
                    "Confidence decreases through the chain, suggesting "
                    "reasoning becomes less certain over time."
                ),
                "affected_steps": list(range(len(confidences))),
            })

    # Pattern: Repeated issue types
    issue_type_counts: dict[str, list[int]] = {}
    for i, step in enumerate(step_scores):
        for issue in step.get("issues", []):
            issue_type = issue.get("type", "unknown")
            issue_type_counts.setdefault(issue_type, []).append(i)

    for issue_type, steps in issue_type_counts.items():
        if len(steps) >= 2:
            patterns.append({
                "name": f"recurring_{issue_type}",
                "description": (
                    f'The issue "{issue_type}" appears in {len(steps)} steps, '
                    "suggesting a systematic problem."
                ),
                "affected_steps": steps,
            })

    # Pattern: Error after high confidence
    for i in range(1, len(step_scores)):
        prev = step_scores[i - 1]
        curr = step_scores[i]
        if (
            prev.get("verdict") == "correct"
            and prev.get("confidence", 0) > 0.8
            and curr.get("verdict") == "incorrect"
        ):
            patterns.append({
                "name": "overconfidence_before_error",
                "description": (
                    "A high-confidence correct step is immediately followed "
                    "by an error, suggesting overconfidence may have led to "
                    "less careful reasoning."
                ),
                "affected_steps": [i - 1, i],
            })

    return patterns
