# Opus Nx — Research Overview

Opus Nx is an open-source research platform for **persistent reasoning artifacts** and **hypothesis lifecycle management**. It transforms extended thinking traces into navigable reasoning graphs and deploys specialized AI agent swarms for multi-perspective analysis.

## Research Questions

1. **Persistent Reasoning Artifacts**: How does structuring model reasoning as persistent, queryable graph artifacts improve downstream task quality compared to ephemeral chain-of-thought?

2. **Multi-Agent Verification**: Can a swarm of specialized agents (contrarian, verifier, synthesizer) systematically reduce reasoning errors through structured disagreement and synthesis?

3. **Process Reward Models in Practice**: Does step-level verification (PRM) surface reasoning failures that outcome-level evaluation misses, and at what cost?

4. **Metacognitive Feedback Loops**: When models audit their own reasoning traces for bias and pattern drift, do the resulting policy corrections transfer across sessions?

5. **Memory Hierarchy for Reasoning**: Does a MemGPT-style tiered memory (working → recall → archival) improve cross-session reasoning continuity compared to flat context windows?

## Implemented Contributions

| Module | Research Basis | Implementation |
|--------|---------------|----------------|
| ThinkGraph | Original | Parses extended thinking into persistent graph nodes with typed edges (influence, support, contradiction, refinement) |
| ThinkFork | Tree of Thoughts (Yao et al., 2023) | 4-style concurrent reasoning (conservative/aggressive/balanced/contrarian) with live branch steering |
| PRM Verifier | Let's Verify Step by Step (Lightman et al., 2023) | Step-level verification with geometric mean scoring and confidence calibration |
| GoT Engine | Graph of Thoughts (Besta et al., 2023) | BFS/DFS/best-first search over thought graphs with aggregation and refinement operations |
| Memory Hierarchy | MemGPT (Packer et al., 2023) | 3-tier memory (main context / recall / archival) with auto-eviction and semantic retrieval |
| Agent Swarm | Multi-Agent Debate Literature | 6 specialized agents (Maestro, DeepThinker, Contrarian, Verifier, Synthesizer, Metacognition) with 3-phase orchestration |

## Evaluation Infrastructure

The platform includes evaluation harnesses for measuring reasoning quality:

- **Retrieval Benchmarks**: Precision@k, MRR, cross-session hit rate for memory and knowledge retrieval
- **Verification Metrics**: Step accuracy, false positive/negative rates for PRM verification
- **Swarm Quality**: Agent agreement rates, synthesis coherence, metacognitive audit coverage
- **Lifecycle Metrics**: Hypothesis promotion rates, policy improvement deltas, rerun efficiency

See `docs/evals/` for benchmark definitions and `agents/src/evals/` for harness implementations.

## How to Cite

If you use Opus Nx in your research, please cite:

```bibtex
@software{opus_nx_2025,
  title = {Opus Nx: Persistent Reasoning Artifacts and Hypothesis Lifecycle Management},
  author = {Akben, Omer and {Claude (Anthropic)}},
  year = {2025},
  url = {https://github.com/omerakben/opus-nx},
  note = {Open-source research platform for AI reasoning research}
}
```

## Key References

1. Yao, S. et al. (2023). *Tree of Thoughts: Deliberate Problem Solving with Large Language Models*. [arXiv:2305.10601](https://arxiv.org/abs/2305.10601)
2. Lightman, H. et al. (2023). *Let's Verify Step by Step*. [arXiv:2305.20050](https://arxiv.org/abs/2305.20050)
3. Besta, M. et al. (2023). *Graph of Thoughts: Solving Elaborate Problems with Large Language Models*. [arXiv:2308.09687](https://arxiv.org/abs/2308.09687)
4. Packer, C. et al. (2023). *MemGPT: Towards LLMs as Operating Systems*. [arXiv:2310.08560](https://arxiv.org/abs/2310.08560)

## Collaboration

Built by **[Ozzy](https://omerakben.com)** + **[Claude](https://tuel.ai)** — a human-AI collaboration exploring what happens when reasoning becomes a first-class, persistent artifact.

Contributions welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.
