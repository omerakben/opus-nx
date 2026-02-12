# Reasoning Artifacts v1 Evaluation

Generated: 2026-02-12T20:58:29.018757+00:00
Benchmark: `configs/evals/reasoning-artifacts-benchmark.v1.json`
Seed: `42`
Task rows: `48`

## WHY
Reasoning artifacts should not be write-only memory. If prior hypotheses are retrievable and checked with human feedback, we expect higher quality with lower policy convergence cost.

## WHAT
We evaluated four variants: baseline autonomous, rehydration-only, rehydration+fixed checkpoint, and rehydration+adaptive checkpoint.

## HOW
Metrics:
- Quality: verifier score delta, contradiction rate delta, synthesis confidence delta
- Efficiency: time-to-retained-policy, reruns-to-retained-policy, token cost per retained policy
- Human impact: checkpoint acceptance rate, correction uptake rate, checkpoint-to-improvement lift
- Attribution: Checkpoint Attribution Index (CAI)

## SO-WHAT
The Human+AI variants should dominate baseline on quality and efficiency together. Adaptive checkpoints should deliver the highest checkpoint-to-improvement lift.

## Variant Summary

| Variant | Verifier | Δ Verifier | Contradiction | Δ Contradiction | Synthesis | Δ Synthesis | Time to Policy (s) | Reruns | Token Cost | Checkpoint Accept | Correction Uptake | Checkpoint Lift | CAI |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline_autonomous | 0.598 | +0.000 | 0.414 | +0.000 | 0.662 | +0.000 | 150.9 | 2.87 | 3910.7 | 0.588 | 0.434 | -0.003 | -0.001 |
| rehydration_only | 0.657 | +0.058 | 0.371 | -0.043 | 0.708 | +0.047 | 135.0 | 2.39 | 3575.0 | 0.666 | 0.532 | +0.065 | +0.040 |
| rehydration_plus_fixed_checkpoint | 0.710 | +0.112 | 0.335 | -0.079 | 0.765 | +0.103 | 118.9 | 2.01 | 3285.9 | 0.821 | 0.707 | +0.144 | +0.111 |
| rehydration_plus_adaptive_checkpoint | 0.765 | +0.166 | 0.303 | -0.111 | 0.822 | +0.161 | 105.8 | 1.70 | 3001.7 | 0.918 | 0.814 | +0.232 | +0.201 |

## Hypotheses Mapping (H1-H6)
- H1: Rehydration improves verifier score vs baseline (check `verifier_score_delta > 0`).
- H2: Rehydration reduces contradiction rate vs baseline (check `contradiction_rate_delta < 0`).
- H3: Rehydration + checkpoints improves synthesis confidence vs baseline.
- H4: Human checkpoints reduce time-to-retained-policy and reruns.
- H5: Human checkpoints increase correction uptake.
- H6: Adaptive checkpoints maximize checkpoint-to-improvement lift and CAI.
