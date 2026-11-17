import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { CheckLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP = {
  critical: { Icon: CircleX, cls: "text-critical", label: "Critical" },
  warning: { Icon: TriangleAlert, cls: "text-warning", label: "Warning" },
  info: { Icon: Info, cls: "text-info", label: "Note" },
  pass: { Icon: CircleCheck, cls: "text-good", label: "Passed" },
} as const;

export function StatusIcon({ level, className }: { level: CheckLevel; className?: string }) {
  const { Icon, cls } = MAP[level];
  return <Icon aria-hidden className={cn("size-4 shrink-0", cls, className)} />;
}

export const levelLabel = (l: CheckLevel) => MAP[l].label;
