import {
  Compass,
  Eye,
  FlaskConical,
  GitBranch,
  Layers3,
  Lightbulb,
  Network,
  Shield,
  Users,
} from "lucide-react";

export const FEATURES = [
  {
    icon: Network,
    title: "Persistent Reasoning Graphs",
    description:
      "Every thinking session becomes a queryable graph with explicit edges for influence, support, contradiction, and refinement.",
    color: "text-[#C4654A]",
  },
  {
    icon: GitBranch,
    title: "ThinkFork Analysis",
    description:
      "Fork hard problems into competing reasoning styles, steer branches in flight, and inspect convergence over time.",
    color: "text-[#7BA3BE]",
  },
  {
    icon: Lightbulb,
    title: "Metacognitive Insights",
    description:
      "Generate structured audits of bias, patterns, and improvement hypotheses from the model's own reasoning traces.",
    color: "text-emerald-400",
  },
];

export const HIGHLIGHTS = [
  { icon: Users, label: "6-agent swarm orchestration" },
  { icon: Layers3, label: "Persistent session memory and artifacts" },
  { icon: FlaskConical, label: "Research-first evaluation loops" },
];

export const MISSION_PILLARS = [
  {
    icon: Shield,
    pillar: "Reliable",
    color: "text-[#C4654A]",
    borderColor: "border-[#C4654A]/30",
    bgColor: "bg-[#C4654A]/10",
    tagline: "Verified reasoning you can trust",
    description:
      "Process Reward Model scores every reasoning step. The 6-agent swarm cross-validates conclusions. Nothing is accepted on faith — every claim is checked.",
    features: [
      "PRM step-by-step verification",
      "Multi-agent cross-validation",
      "Geometric mean confidence scoring",
    ],
  },
  {
    icon: Eye,
    pillar: "Interpretable",
    color: "text-[#7BA3BE]",
    borderColor: "border-[#7BA3BE]/30",
    bgColor: "bg-[#7BA3BE]/10",
    tagline: "See every reasoning step",
    description:
      "Extended thinking becomes a persistent, navigable graph. Decision points are explicit nodes. Metacognitive audits surface hidden biases and patterns.",
    features: [
      "ThinkGraph persistent reasoning",
      "Explicit decision point nodes",
      "Metacognitive bias detection",
    ],
  },
  {
    icon: Compass,
    pillar: "Steerable",
    color: "text-emerald-400",
    borderColor: "border-emerald-400/30",
    bgColor: "bg-emerald-400/10",
    tagline: "Direct reasoning in real-time",
    description:
      "Fork reasoning into competing styles and steer branches mid-flight. Human-in-the-loop checkpoints let you course-correct at any decision point.",
    features: [
      "ThinkFork 4-style branching",
      "Mid-flight branch steering",
      "Human-in-the-loop checkpoints",
    ],
  },
];

export const PAPERS = [
  {
    title: "Tree of Thoughts",
    authors: "Yao et al., 2023",
    module: "ThinkFork",
    url: "https://arxiv.org/abs/2305.10601",
    description: "BFS/DFS search over reasoning trees with state evaluation",
  },
  {
    title: "Let's Verify Step by Step",
    authors: "Lightman et al., 2023",
    module: "PRM Verifier",
    url: "https://arxiv.org/abs/2305.20050",
    description:
      "Process supervision — verify each reasoning step independently",
  },
  {
    title: "Graph of Thoughts",
    authors: "Besta et al., 2023",
    module: "GoT Engine",
    url: "https://arxiv.org/abs/2308.09687",
    description:
      "Arbitrary thought graph topology with aggregation and refinement",
  },
  {
    title: "MemGPT",
    authors: "Packer et al., 2023",
    module: "Memory Hierarchy",
    url: "https://arxiv.org/abs/2310.08560",
    description: "3-tier memory hierarchy with paging and auto-eviction",
  },
];

export const TECH_STACK = [
  "Next.js 16",
  "Python 3.12",
  "Supabase",
  "Claude Opus 4.6",
  "TypeScript",
];
