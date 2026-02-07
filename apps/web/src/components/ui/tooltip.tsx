"use client";

import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  delayMs?: number;
}

export function Tooltip({
  content,
  children,
  side = "top",
  className,
  delayMs = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const positions: Record<string, CSSProperties> = {
      top: {
        left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
        top: triggerRect.top - tooltipRect.height - 8,
      },
      bottom: {
        left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
        top: triggerRect.bottom + 8,
      },
      left: {
        left: triggerRect.left - tooltipRect.width - 8,
        top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
      },
      right: {
        left: triggerRect.right + 8,
        top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
      },
    };

    // Clamp to viewport to prevent overflow
    const pos = positions[side];
    const left = Math.max(8, Math.min(
      pos.left as number,
      window.innerWidth - tooltipRect.width - 8
    ));
    const top = Math.max(8, Math.min(
      pos.top as number,
      window.innerHeight - tooltipRect.height - 8
    ));

    setPosition({ left, top });
  };

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);
  };

  const hideTooltip = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={position}
          className={cn(
            "fixed z-50 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--card-foreground)] shadow-md animate-in fade-in-0 zoom-in-95",
            className
          )}
        >
          {content}
        </div>
      )}
    </>
  );
}
