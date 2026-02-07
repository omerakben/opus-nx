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
    id: "graph-overview",
    target: "[data-tour='reasoning-graph']",
    title: "Reasoning Graph",
    description:
      "This is Claude's reasoning graph. Each node represents a step in extended thinking. Edges show how ideas influence, support, or contradict each other.",
    placement: "bottom",
  },
  {
    id: "node-inspection",
    target: ".react-flow__node-thinking",
    title: "Thinking Nodes",
    description:
      "Click any node to see the full reasoning, confidence score, and token usage. Node colors reflect confidence levels.",
    placement: "right",
  },
  {
    id: "edge-legend",
    target: "[data-tour='graph-legend']",
    title: "Edge Types",
    description:
      "Five relationship types connect reasoning: influences, supports, refines, supersedes, and contradicts.",
    placement: "top",
  },
  {
    id: "session-stats",
    target: "[data-tour='session-stats']",
    title: "Session Statistics",
    description:
      "Track total nodes, edges, thinking tokens used, and average confidence across the session.",
    placement: "right",
  },
  {
    id: "thinking-input",
    target: "[data-tour='thinking-input']",
    title: "Start Thinking",
    description:
      "Ask Claude a complex question to see extended thinking in real-time. The graph builds as Claude reasons through the problem.",
    placement: "top",
  },
  {
    id: "insights-panel",
    target: "[data-tour='insights-tab']",
    title: "Metacognitive Insights",
    description:
      "Claude analyzes its own reasoning for biases, patterns, and improvement hypotheses — AI that reflects on how it thinks.",
    placement: "left",
  },
  {
    id: "fork-panel",
    target: "[data-tour='fork-tab']",
    title: "ThinkFork Analysis",
    description:
      "Fork any question into 4 reasoning perspectives — analytical, creative, critical, and practical — then steer the synthesis.",
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
