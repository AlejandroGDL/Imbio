import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700",
        sky: "bg-sky-100 text-sky-700",
        amber: "bg-amber-100 text-amber-700",
        red: "bg-red-100 text-red-700",
        emerald: "bg-emerald-100 text-emerald-700",
        purple: "bg-purple-100 text-purple-700",
        slate: "bg-slate-100 text-slate-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
