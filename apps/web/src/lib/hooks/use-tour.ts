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
      "Opus Nx makes AI reasoning visible, steerable, and persistent. You're looking at a live reasoning graph — every node is a step in Claude Opus 4.6's extended thinking.",
    placement: "bottom",
  },
  {
    id: "graph-overview",
    target: "[data-tour='graph-legend']",
    title: "Reasoning Graph",
    description:
      "Nodes connect via 5 edge types: influences, supports, refines, supersedes, and contradicts. Special node types show compaction boundaries, fork branches, and human annotations.",
    placement: "top",
  },
  {
    id: "node-checkpoints",
    target: ".react-flow__node-thinking",
    title: "Human-in-the-Loop Checkpoints",
    description:
      "Hover any thinking node to verify, question, or disagree with the reasoning. Disagreements trigger re-reasoning and create a new branch in the graph.",
    placement: "right",
  },
  {
    id: "fork-panel",
    target: "[data-tour='fork-tab']",
    title: "ThinkFork — 4 Divergent Paths",
    description:
      "Fork any question into 4 reasoning perspectives with different assumptions. Toggle to Debate mode for multi-round adversarial reasoning where perspectives challenge each other.",
    placement: "left",
  },
  {
    id: "insights-panel",
    target: "[data-tour='insights-tab']",
    title: "Metacognitive Insights",
    description:
      "Claude analyzes its own reasoning patterns for biases, recurring structures, and improvement hypotheses — AI self-reflection powered by 50k thinking tokens.",
    placement: "left",
  },
  {
    id: "evidence-nav",
    target: "[data-tour='insights-tab']",
    title: "Evidence Navigation",
    description:
      "Click any evidence link in an insight to animate the graph to the referenced reasoning node. Every insight is grounded in specific thinking steps.",
    placement: "left",
  },
];

const TOUR_STORAGE_KEY = "opus-nx-tour-completed";

interface UseTourReturn {
  isActive: boolean;
  currentStep: TourStep | null;
  currentIndex: number;
  totalSteps: number;
  startTour: () => void;
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

  return {
    isActive,
    currentStep: isActive ? TOUR_STEPS[currentIndex] : null,
    currentIndex,
    totalSteps: TOUR_STEPS.length,
    startTour,
    nextStep,
    previousStep,
    skipTour,
  };
}
