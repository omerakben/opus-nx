import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)]",
        secondary:
          "border-transparent bg-[var(--muted)] text-[var(--foreground)]",
        destructive:
          "border-transparent bg-red-500 text-white",
        outline: "text-[var(--foreground)]",
        success:
          "border-transparent bg-green-500/10 text-green-500",
        warning:
          "border-transparent bg-yellow-500/10 text-yellow-500",
        info:
          "border-transparent bg-blue-500/10 text-blue-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
