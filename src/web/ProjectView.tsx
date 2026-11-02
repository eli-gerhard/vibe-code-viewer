import {
  Background,
  BackgroundVariant,
  Controls,
  type Dimensions,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { flextree } from "d3-flextree";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { createContext, use, useEffect, useMemo, useRef, useState } from "react";
import { KindIcon } from "@/components/kind-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { type MapNode, NODE_KINDS, type NodeKind, type ProjectResponse } from "../shared/api.ts";

interface Props {
  project: ProjectResponse;
  // Label of the part being mapped right now.
  mapping?: string;
  error?: string;
  onRemap: (node?: MapNode) => void;
  onClose: () => void;
}

export function ProjectView({ project, mapping, error, onRemap, onClose }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft />
          Projects
        </Button>
        <h1 className="font-serif text-xl font-medium">{project.name}</h1>
        <span className="mr-auto text-sm text-muted-foreground">
          Click a box to open it. Right-click for more.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSearchOpen(true)}
          disabled={!project.map}
        >
          <Search />
          Search
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={!project.map || !!mapping}>
              <RefreshCw />
              Refresh…
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Refresh the whole map?</AlertDialogTitle>
              <AlertDialogDescription>
                Your AI CLI maps the whole project again, which can take a few minutes. To refresh
                just one part, right-click its box instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onRemap()}>Refresh map</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>
      {mapping && (
        <p className="px-4 py-2 text-sm">Mapping “{mapping}”… this can take a few minutes.</p>
      )}
      {error && <p className="px-4 py-2 text-sm text-destructive">{error}</p>}

      {project.map ? (
        <MapActions value={{ busy: !!mapping, onRemap }}>
          <ReactFlowProvider>
            <MapCanvas
              map={project.map}
              searchOpen={searchOpen}
              onSearchOpenChange={setSearchOpen}
            />
          </ReactFlowProvider>
        </MapActions>
      ) : (
        !mapping && (
          <Button className="m-4 self-start" onClick={() => onRemap()}>
            Try again
          </Button>
        )
      )}
    </main>
  );
}

// Lets each box's right-click menu start a refresh without threading props through React Flow.
const MapActions = createContext({ busy: false, onRemap: (_node: MapNode) => {} });

type ConceptNode = Node<{ node: MapNode; open: boolean }, "concept">;
const NODE_TYPES = { concept: ConceptBox };

interface MapCanvasProps {
  map: MapNode;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
}

function MapCanvas({ map, searchOpen, onSearchOpenChange }: MapCanvasProps) {
  const [openIds, setOpenIds] = useState(() => new Set<string>());
  // Measured box sizes, so the layout makes room for boxes that grow when opened.
  const [sizes, setSizes] = useState<Record<string, Dimensions>>({});
  const { nodes, edges } = useMemo(() => layoutMap(map, openIds, sizes), [map, openIds, sizes]);
  // The box picked in search, centered once every shown box is measured and the layout is final.
  const found = useRef<string>(undefined);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!found.current || !nodes.every((node) => node.measured)) return;
    fitView({ nodes: [{ id: found.current }], maxZoom: 1 });
    found.current = undefined;
  }, [nodes, fitView]);

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={(changes) => {
          const measured = changes.flatMap((change) =>
            change.type === "dimensions" && change.dimensions
              ? [[change.id, change.dimensions]]
              : [],
          );
          if (measured.length)
            setSizes((current) => ({ ...current, ...Object.fromEntries(measured) }));
        }}
        onNodeClick={(_, node) => toggle(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        minZoom={0.2}
        colorMode="system"
        attributionPosition="top-right"
      >
        <Background variant={BackgroundVariant.Lines} gap={32} />
        <Controls
          position="bottom-right"
          showInteractive={false}
          className="overflow-hidden rounded-lg"
        />
        <MapKey />
      </ReactFlow>
      <MapSearch
        map={map}
        open={searchOpen}
        onOpenChange={onSearchOpenChange}
        onFind={(lineage) => {
          found.current = lineage.at(-1)?.id;
          setOpenIds((current) => new Set([...current, ...lineage.map((node) => node.id)]));
        }}
      />
    </>
  );
}

// Lays out the open part of the map left to right as a tidy tree that keeps the AI's ordering,
// sized by each box's measured size. flextree lays out top-down, so its x and y are swapped here.
function layoutMap(map: MapNode, openIds: Set<string>, sizes: Record<string, Dimensions>) {
  const layout = flextree<MapNode>({
    children: (node) => (openIds.has(node.id) ? node.children : []),
    nodeSize: ({ data }) => [(sizes[data.id]?.height ?? 0) + 16, (sizes[data.id]?.width ?? 0) + 80],
  });
  const tree = layout(layout.hierarchy(map));
  const nodes = tree.descendants().map(
    ({ data, x, y }): ConceptNode => ({
      id: data.id,
      type: "concept",
      position: { x: y, y: x - (sizes[data.id]?.height ?? 0) / 2 },
      measured: sizes[data.id],
      data: { node: data, open: openIds.has(data.id) },
    }),
  );
  const edges = tree.links().map(
    ({ source, target }): Edge => ({
      id: target.data.id,
      source: source.data.id,
      target: target.data.id,
      className: "animate-in fade-in duration-300",
      style: { stroke: target.data.kind && `var(--kind-${target.data.kind})` },
    }),
  );
  return { nodes, edges };
}

function ConceptBox({ data: { node, open } }: NodeProps<ConceptNode>) {
  const { busy, onRemap } = use(MapActions);
  const app = node.kind === "app";
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          size="sm"
          data-kind={node.kind}
          className={cn(
            "w-64 border-l-3 border-kind shadow-sm animate-in fade-in duration-300",
            open && "ring-kind",
            app && "border-l-0 bg-foreground text-background",
          )}
        >
          <Handle type="target" position={Position.Left} className="invisible" />
          <Collapsible asChild open={open}>
            <CardHeader>
              <CardTitle className={cn("flex items-center gap-3", app && "font-serif text-lg")}>
                <KindIcon
                  kind={node.kind}
                  className={cn(app && "bg-kind text-primary-foreground")}
                />
                {node.label}
              </CardTitle>
              {node.children.length > 0 && (
                <CardAction className="row-span-1 self-center">
                  <Badge variant="secondary">{node.children.length}</Badge>
                </CardAction>
              )}
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <CardDescription className={cn(app && "text-background/70")}>
                  {node.description}
                </CardDescription>
              </CollapsibleContent>
            </CardHeader>
          </Collapsible>
          <Handle type="source" position={Position.Right} className="invisible" />
        </Card>
      </ContextMenuTrigger>
      {/* React bubbles clicks out of the menu's portal, which would also toggle the box. */}
      <ContextMenuContent onClick={(event) => event.stopPropagation()}>
        {/* TODO: add "Open in editor" and "Copy" actions for this location. */}
        <ContextMenuLabel className="font-mono">
          {node.file ? `${node.file}:${node.line}` : "No matching code line found"}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={busy} onSelect={() => onRemap(node)}>
          <RefreshCw />
          Refresh from here
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function MapKey() {
  const [shown, setShown] = useState(true);
  return (
    <Panel position="bottom-left">
      {shown ? (
        <Card size="sm" className="shadow-sm">
          <CardHeader>
            <CardTitle>Key</CardTitle>
            <CardAction>
              <Button variant="ghost" size="xs" onClick={() => setShown(false)}>
                Hide
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
              {(Object.entries(NODE_KINDS) as [NodeKind, string][]).map(([kind, hint]) => (
                <li key={kind} className="flex items-center gap-2">
                  <KindIcon kind={kind} className="size-6 [&_svg]:size-3.5" />
                  <span>
                    <span className="font-medium capitalize">{kind}</span>
                    <span className="text-muted-foreground"> · {hint}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShown(true)}>
          Key
        </Button>
      )}
    </Panel>
  );
}

interface MapSearchProps {
  map: MapNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called with the picked node and every node above it, from the top down.
  onFind: (lineage: MapNode[]) => void;
}

function MapSearch({ map, open, onOpenChange, onFind }: MapSearchProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Find a part of the map"
      description="Pick a part to open it on the map."
    >
      <Command>
        <CommandInput placeholder="Search for a part…" />
        <CommandList>
          <CommandEmpty>No matching parts.</CommandEmpty>
          {flatten(map).map(({ node, above }) => {
            const trail = above.map((parent) => parent.label).join(" › ");
            return (
              <CommandItem
                key={node.id}
                value={`${node.label} ${trail}`}
                keywords={[node.description]}
                onSelect={() => {
                  onOpenChange(false);
                  onFind([...above, node]);
                }}
              >
                <span className="shrink-0">{node.label}</span>
                {trail && <span className="truncate text-muted-foreground">{trail}</span>}
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

// Every node in the map, each with the nodes above it.
function flatten(node: MapNode, above: MapNode[] = []): { node: MapNode; above: MapNode[] }[] {
  const below = node.children.flatMap((child) => flatten(child, [...above, node]));
  return [{ node, above }, ...below];
}
