import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "green" | "yellow" | "red" | "blue" | "gray";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneStyles: Record<BadgeTone, string> = {
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-rose-100 text-rose-700",
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-slate-100 text-slate-700",
};

export function Badge({ className, tone = "gray", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        toneStyles[tone],
        className
      )}
      {...props}
    />
  );
}
