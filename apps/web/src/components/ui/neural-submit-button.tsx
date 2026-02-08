"use client";

import { forwardRef, useId, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface NeuralSubmitButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

const NeuralSubmitButton = forwardRef<HTMLButtonElement, NeuralSubmitButtonProps>(
  ({ isLoading = false, className, disabled, ...props }, ref) => {
    const uid = useId();
    const gradId = (suffix: string) => `neural-${uid}-${suffix}`;

    return (
      <button
        ref={ref}
        type="submit"
        disabled={disabled || isLoading}
        aria-label={isLoading ? "Processing..." : "Submit"}
        className={cn(
          "neural-btn",
          isLoading && "neural-btn--loading",
          className
        )}
        {...props}
      >
        <svg
          viewBox="0 0 40 40"
          width={32}
          height={32}
          aria-hidden="true"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Radial glow */}
            <radialGradient id={gradId("glow")}>
              <stop offset="0%" stopColor="#C4654A" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#C4654A" stopOpacity="0" />
            </radialGradient>

            {/* Center node gradient */}
            <radialGradient id={gradId("center")}>
              <stop offset="0%" stopColor="#8B3D2E" />
              <stop offset="60%" stopColor="#C4654A" />
              <stop offset="100%" stopColor="var(--neural-node-fill)" />
            </radialGradient>
          </defs>

          {/* Backdrop glow */}
          <circle
            className="neural-glow"
            cx="20"
            cy="20"
            r="16"
            fill={`url(#${gradId("glow")})`}
            opacity="0.25"
          />

          {/* Orbital group — rotates during loading */}
          <g className="neural-orbit">
            {/* Connection lines: center → satellites */}
            <line x1="20" y1="20" x2="30" y2="12" stroke="#C4654A" strokeWidth="0.8" opacity="0.4" />
            <line x1="20" y1="20" x2="31" y2="29" stroke="#C4654A" strokeWidth="0.8" opacity="0.4" />
            <line x1="20" y1="20" x2="10" y2="28" stroke="var(--neural-blue-fill)" strokeWidth="0.8" opacity="0.4" />

            {/* Satellite A — terracotta, top-right */}
            <circle className="neural-node-brighten" cx="30" cy="12" r="2.5" fill="#C4654A" />
            <circle cx="30" cy="12" r="1.2" fill="var(--neural-node-fill)" />

            {/* Satellite B — terracotta, bottom-right */}
            <circle className="neural-node-brighten" cx="31" cy="29" r="2" fill="#C4654A" />
            <circle cx="31" cy="29" r="1" fill="var(--neural-node-fill)" />

            {/* Satellite C — blue accent, left */}
            <circle className="neural-node-brighten" cx="10" cy="28" r="2.2" fill="var(--neural-blue-fill)" />
            <circle cx="10" cy="28" r="1.1" fill="var(--neural-node-fill)" />
          </g>

          {/* Center node — concentric rings */}
          <circle cx="20" cy="20" r="5.5" fill="var(--neural-node-fill)" />
          <circle cx="20" cy="20" r="4" fill="#C4654A" />
          <circle cx="20" cy="20" r="2" fill={`url(#${gradId("center")})`} />

          {/* Scatter particles */}
          <circle className="neural-particle" cx="34" cy="7" r="0.8" fill="#C4654A" opacity="0.5" style={{ ["--drift-x" as string]: "4px", ["--drift-y" as string]: "-3px" }} />
          <circle className="neural-particle" cx="7" cy="34" r="0.7" fill="var(--neural-blue-fill)" opacity="0.5" style={{ ["--drift-x" as string]: "-3px", ["--drift-y" as string]: "4px" }} />
          <circle className="neural-particle" cx="35" cy="24" r="0.6" fill="#C4654A" opacity="0.4" style={{ ["--drift-x" as string]: "5px", ["--drift-y" as string]: "1px" }} />
          <circle className="neural-particle" cx="12" cy="8" r="0.7" fill="var(--neural-blue-fill)" opacity="0.4" style={{ ["--drift-x" as string]: "-2px", ["--drift-y" as string]: "-4px" }} />
        </svg>
      </button>
    );
  }
);
NeuralSubmitButton.displayName = "NeuralSubmitButton";

export { NeuralSubmitButton };
