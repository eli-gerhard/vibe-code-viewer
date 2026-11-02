import {
  Box,
  Compass,
  Database,
  LayoutPanelTop,
  type LucideIcon,
  Monitor,
  Palette,
  Plug,
  Workflow,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeKind } from "../../shared/api.ts";

const ICONS: Record<NodeKind, LucideIcon> = {
  app: Compass,
  screen: Monitor,
  component: LayoutPanelTop,
  element: Palette,
  action: Zap,
  process: Workflow,
  data: Database,
  connection: Plug,
};

// A map node kind's icon on a tile of its color, shared by the map's boxes and its key.
export function KindIcon({ kind, className }: { kind?: NodeKind; className?: string }) {
  const Icon = kind ? ICONS[kind] : Box;
  return (
    <span
      data-kind={kind}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-kind/15 text-kind [&_svg]:size-4",
        className,
      )}
    >
      <Icon />
    </span>
  );
}
