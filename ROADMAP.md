# Opus Nx Roadmap

This roadmap outlines planned features and research directions. Contributions to any item are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Near-Term (Next 1-2 Releases)

- [ ] **TypeScript Agent Package**: Expose 6 TS agents (CodeExplorer, CodeImprover, Documentation, Research, Analyst, ProjectManager) alongside the Python swarm
- [ ] **Improved Onboarding**: Guided setup wizard, environment validation, and first-run experience
- [ ] **Hypothesis Lifecycle UI**: Visual promotion/demotion flow with diff comparison
- [ ] **Export and Sharing**: Export reasoning graphs as JSON, Markdown, or interactive HTML

## Medium-Term (3-6 Months)

- [ ] **Plugin Architecture**: Allow community-contributed agents, verifiers, and graph transformers
- [ ] **Collaborative Sessions**: Multiple users contributing to the same reasoning graph
- [ ] **Evaluation Dashboard**: Visual benchmark tracking with longitudinal comparisons
- [ ] **LLM Provider Abstraction**: Support for OpenAI, Gemini, and open-weight models alongside Claude
- [ ] **Graph Diffing**: Compare reasoning graphs across sessions and interventions

## Long-Term (Research Directions)

- [ ] **Automated Policy Discovery**: Use evaluation results to automatically suggest reasoning policy improvements
- [ ] **Cross-Model Transfer**: Test whether reasoning artifacts transfer across different LLM providers
- [ ] **Formal Verification Integration**: Connect PRM verification with formal methods for mathematical reasoning
- [ ] **Reasoning Curriculum**: Build training curricula from reasoning graph analysis
- [ ] **Federation**: Federated reasoning graph sharing across instances

## Contributing

Pick any item and open an issue to discuss your approach before starting work. Items marked with existing issues have links — check there for current status and discussion.

Labels:
- `good first issue` — Suitable for new contributors
- `help wanted` — Actively seeking contributors
- `research` — Requires experimental evaluation
