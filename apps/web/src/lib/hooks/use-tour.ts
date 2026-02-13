"use client";

import { useState, useCallback } from "react";

export interface TourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: "[data-tour='reasoning-graph']",
    title: "Welcome to Opus Nx",
    description:
      "See how AI actually thinks. This is a live reasoning graph \u2014 every node is a real step from Claude\u2019s extended thinking, not a black box.",
    placement: "bottom",
  },
  {
    id: "extended-thinking",
    target: "[data-tour='thinking-input']",
    title: "Start with Any Question",
    description:
      "Ask anything complex. Opus Nx sends it to Claude Opus 4.6 with up to 50,000 thinking tokens, then captures every reasoning step as navigable graph nodes.",
    placement: "top",
  },
  {
    id: "thinking-nodes",
    target: ".react-flow__node-thinking",
    title: "Live Reasoning Nodes",
    description:
      "Each node is a discrete thinking step \u2014 extracted, scored for confidence, and connected to show how ideas flow, branch, and build on each other.",
    placement: "right",
  },
  {
    id: "human-steering",
    target: ".react-flow__node-thinking",
    title: "Steer the Reasoning",
    description:
      "Hover any node to verify, question, or challenge it. Your feedback creates new branches \u2014 the AI re-reasons from that point with your input baked in.",
    placement: "right",
  },
  {
    id: "swarm-panel",
    target: "[data-tour='swarm-tab']",
    title: "Agent Swarm \u2014 6 AI Specialists",
    description:
      "Deploy a swarm of 6 specialized AI agents that collaborate in real-time. Watch Deep Thinker analyze, Contrarian challenge, Verifier check, and Synthesizer merge \u2014 all streaming live via WebSocket.",
    placement: "bottom",
  },
  {
    id: "got-panel",
    target: "[data-tour='got-tab']",
    title: "Graph of Thoughts",
    description:
      "Explore problems using arbitrary reasoning graphs with BFS, DFS, or best-first search. Thoughts branch, merge, and get verified at each step.",
    placement: "bottom",
  },
  {
    id: "verify-panel",
    target: "[data-tour='verify-tab']",
    title: "Step-by-Step Verification",
    description:
      "Process Reward Model verifies each reasoning step independently. See confidence scores, detected issues, and suggested corrections for every step in the chain.",
    placement: "bottom",
  },
  {
    id: "fork-panel",
    target: "[data-tour='fork-tab']",
    title: "ThinkFork \u2014 4 Perspectives",
    description:
      "Fork any question into 4 concurrent reasoning styles: conservative, aggressive, balanced, and contrarian. Enable Debate mode for adversarial cross-examination.",
    placement: "left",
  },
  {
    id: "insights-panel",
    target: "[data-tour='insights-tab']",
    title: "Metacognitive Insights",
    description:
      "The AI analyzes its own reasoning for biases, patterns, and blind spots. Click any evidence link to jump directly to the source thinking node.",
    placement: "left",
  },
  {
    id: "memory-panel",
    target: "[data-tour='memory-tab']",
    title: "Memory Hierarchy",
    description:
      "A MemGPT-inspired 3-tier memory system: working context, recall buffer, and archival storage. Knowledge entries persist across sessions with semantic search and graph relations.",
    placement: "left",
  },
  {
    id: "sessions",
    target: "[data-tour='session-stats']",
    title: "Persistent Reasoning",
    description:
      "Every session\u2019s reasoning graph is saved. Return anytime to review, extend, or fork from any previous thinking path. Your reasoning library grows over time.",
    placement: "right",
  },
  {
    id: "new-session",
    target: "[data-tour='new-session']",
    title: "Start a New Session",
    description:
      "You\u2019re all set! Click the + button to create a fresh reasoning session and start exploring. Each session gets its own graph.",
    placement: "bottom",
  },
];

const TOUR_STORAGE_KEY = "opus-nx-tour-completed";

interface UseTourReturn {
  isActive: boolean;
  currentStep: TourStep | null;
  currentIndex: number;
  totalSteps: number;
  startTour: () => void;
  restartTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
}

export function useTour(): UseTourReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const startTour = useCallback(() => {
    if (typeof window !== "undefined") {
      const completed = sessionStorage.getItem(TOUR_STORAGE_KEY);
      if (completed) return;
    }
    setCurrentIndex(0);
    setIsActive(true);
  }, []);

  const completeTour = useCallback(() => {
    setIsActive(false);
    setCurrentIndex(0);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(TOUR_STORAGE_KEY, "true");
    }
  }, []);

  const nextStep = useCallback(() => {
    if (currentIndex < TOUR_STEPS.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      completeTour();
    }
  }, [currentIndex, completeTour]);

  const previousStep = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  const restartTour = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(TOUR_STORAGE_KEY);
    }
    setCurrentIndex(0);
    setIsActive(true);
  }, []);

  return {
    isActive,
    currentStep: isActive ? TOUR_STEPS[currentIndex] : null,
    currentIndex,
    totalSteps: TOUR_STEPS.length,
    startTour,
    restartTour,
    nextStep,
    previousStep,
    skipTour,
  };
}
