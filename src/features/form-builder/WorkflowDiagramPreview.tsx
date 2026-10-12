import React, { useMemo, useState, useRef } from 'react';
import {
  GitBranch,
  Clock,
  CheckCircle2,
  Truck,
  Flag,
  RotateCcw,
  XCircle,
  Ban,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronRight,
  Layers,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  FormWorkflow,
  FormField,
  WorkflowStage,
  WorkflowTransition,
  SystemStatusCategory,
} from './types';

export interface WorkflowDiagramPreviewProps {
  workflow: FormWorkflow;
  fields: FormField[];
  onSelectStage?: (stageId: string) => void;
}

// Category visual mapping
const CATEGORY_STYLES: Record<
  SystemStatusCategory,
  {
    border: string;
    bg: string;
    text: string;
    badgeBg: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    glow: string;
    lineColor: string;
  }
> = {
  draft: {
    border: 'border-slate-400/40 dark:border-slate-600/40',
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    text: 'text-slate-700 dark:text-slate-300',
    badgeBg: 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30',
    icon: FileText,
    label: 'Draft',
    glow: 'shadow-slate-500/10',
    lineColor: '#94a3b8', // slate-400
  },
  in_review: {
    border: 'border-amber-500/40 dark:border-amber-500/40',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    badgeBg: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
    icon: Clock,
    label: 'In Review',
    glow: 'shadow-amber-500/15',
    lineColor: '#f59e0b', // amber-500
  },
  approved: {
    border: 'border-emerald-500/40 dark:border-emerald-500/40',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    badgeBg: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: CheckCircle2,
    label: 'Approved',
    glow: 'shadow-emerald-500/15',
    lineColor: '#10b981', // emerald-500
  },
  in_progress: {
    border: 'border-blue-500/40 dark:border-blue-500/40',
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    badgeBg: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
    icon: Truck,
    label: 'In Progress',
    glow: 'shadow-blue-500/15',
    lineColor: '#3b82f6', // blue-500
  },
  completed: {
    border: 'border-purple-500/40 dark:border-purple-500/40',
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    badgeBg: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
    icon: Flag,
    label: 'Completed',
    glow: 'shadow-purple-500/15',
    lineColor: '#8b5cf6', // purple-500
  },
  returned: {
    border: 'border-orange-500/40 dark:border-orange-500/40',
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    text: 'text-orange-700 dark:text-orange-300',
    badgeBg: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
    icon: RotateCcw,
    label: 'Returned',
    glow: 'shadow-orange-500/15',
    lineColor: '#f97316', // orange-500
  },
  rejected: {
    border: 'border-red-500/40 dark:border-red-500/40',
    bg: 'bg-red-500/10 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-300',
    badgeBg: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
    icon: XCircle,
    label: 'Rejected',
    glow: 'shadow-red-500/15',
    lineColor: '#ef4444', // red-500
  },
  cancelled: {
    border: 'border-zinc-500/40 dark:border-zinc-500/40',
    bg: 'bg-zinc-500/10 dark:bg-zinc-500/15',
    text: 'text-zinc-700 dark:text-zinc-300',
    badgeBg: 'bg-zinc-500/20 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
    icon: Ban,
    label: 'Cancelled',
    glow: 'shadow-zinc-500/15',
    lineColor: '#71717a', // zinc-500
  },
};

interface PositionedNode {
  stage: WorkflowStage;
  x: number;
  y: number;
  w: number;
  h: number;
  col: number;
  row: number;
  isInitial: boolean;
}

interface RenderEdge {
  transition: WorkflowTransition;
  fromNode: PositionedNode;
  toNode: PositionedNode;
  pathD: string;
  midX: number;
  midY: number;
  color: string;
  isLoopback: boolean;
  isArching: boolean;
}

export function WorkflowDiagramPreview({
  workflow,
  fields,
  onSelectStage,
}: WorkflowDiagramPreviewProps) {
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [hoveredStageId, setHoveredStageId] = useState<string | null>(null);
  const [hoveredTransitionIndex, setHoveredTransitionIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const NODE_WIDTH = 210;
  const NODE_HEIGHT = 80;
  const COL_SPACING = 270;
  const ROW_SPACING = 150;
  const PADDING_X = 50;
  const PADDING_Y = 65;

  // Compute Layout of Stages
  const { nodes, edges, canvasWidth, canvasHeight } = useMemo(() => {
    const stageMap = new Map<string, WorkflowStage>();
    workflow.stages.forEach((s) => stageMap.set(s.id, s));

    const isException = (s: WorkflowStage) =>
      ['returned', 'rejected', 'cancelled'].includes(s.statusCategory);

    const mainStages = workflow.stages.filter((s) => !isException(s));
    const exceptionStages = workflow.stages.filter((s) => isException(s));

    // Calculate forward topological/BFS column for main stages
    const colRank = new Map<string, number>();

    // Start with draft at 0, or initialStage at 0 if no draft
    const draftStage = mainStages.find((s) => s.id === 'draft' || s.statusCategory === 'draft');
    const initialStageId = workflow.initialStage || mainStages[0]?.id || 'submitted';

    if (draftStage) {
      colRank.set(draftStage.id, 0);
      if (initialStageId !== draftStage.id) {
        colRank.set(initialStageId, 1);
      }
    } else {
      colRank.set(initialStageId, 0);
    }

    // Forward BFS progression
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 20) {
      changed = false;
      iterations++;
      for (const t of workflow.transitions) {
        if (colRank.has(t.from) && stageMap.has(t.to)) {
          const target = stageMap.get(t.to)!;
          if (!isException(target)) {
            const currentToRank = colRank.get(t.to) ?? 0;
            const fromRank = colRank.get(t.from)!;
            const nextRank = Math.max(currentToRank, fromRank + 1);
            if (nextRank !== currentToRank) {
              colRank.set(t.to, nextRank);
              changed = true;
            }
          }
        }
      }
    }

    // Ensure any remaining main stages are placed
    let maxMainCol = 0;
    colRank.forEach((rank) => {
      if (rank > maxMainCol) maxMainCol = rank;
    });

    mainStages.forEach((s) => {
      if (!colRank.has(s.id)) {
        maxMainCol++;
        colRank.set(s.id, maxMainCol);
      }
    });

    // Handle column collisions in main line (row offset)
    const colGroups = new Map<number, WorkflowStage[]>();
    mainStages.forEach((s) => {
      const col = colRank.get(s.id) ?? 0;
      if (!colGroups.has(col)) colGroups.set(col, []);
      colGroups.get(col)!.push(s);
    });

    const positionedNodes: PositionedNode[] = [];
    const nodeLookup = new Map<string, PositionedNode>();

    colGroups.forEach((stagesInCol, col) => {
      stagesInCol.forEach((stage, rowIndex) => {
        const x = PADDING_X + col * COL_SPACING;
        const y = PADDING_Y + rowIndex * ROW_SPACING;
        const node: PositionedNode = {
          stage,
          x,
          y,
          w: NODE_WIDTH,
          h: NODE_HEIGHT,
          col,
          row: rowIndex,
          isInitial: stage.id === workflow.initialStage,
        };
        positionedNodes.push(node);
        nodeLookup.set(stage.id, node);
      });
    });

    // Place exception stages on row 1 (or 2)
    // Position each exception stage near the column of its primary feeder transition
    const exceptionRowY = PADDING_Y + ROW_SPACING + 15;
    let exceptionColTracker = 0.5;

    exceptionStages.forEach((stage, index) => {
      // Find incoming sources
      const incoming = workflow.transitions.filter((t) => t.to === stage.id);
      let targetCol: number;

      if (incoming.length > 0) {
        const sourceCols = incoming
          .map((t) => nodeLookup.get(t.from)?.col)
          .filter((c): c is number => c !== undefined);
        targetCol = sourceCols.length > 0 ? Math.min(...sourceCols) + 0.4 : exceptionColTracker;
      } else {
        targetCol = exceptionColTracker;
      }

      // Avoid exact collision with other exception stages
      if (
        positionedNodes.some(
          (n) => n.row === 1 && Math.abs(n.x - (PADDING_X + targetCol * COL_SPACING)) < 80,
        )
      ) {
        targetCol += 0.8;
      }
      exceptionColTracker = targetCol + 1.2;

      const x = PADDING_X + targetCol * COL_SPACING;
      const y = exceptionRowY + (index % 2 === 1 ? 25 : 0); // slight stagger if multiple

      const node: PositionedNode = {
        stage,
        x,
        y,
        w: NODE_WIDTH,
        h: NODE_HEIGHT,
        col: targetCol,
        row: 1,
        isInitial: stage.id === workflow.initialStage,
      };
      positionedNodes.push(node);
      nodeLookup.set(stage.id, node);
    });

    // Build SVG Connector Paths
    const renderEdges: RenderEdge[] = [];

    workflow.transitions.forEach((t) => {
      const fromNode = nodeLookup.get(t.from);
      const toNode = nodeLookup.get(t.to);
      if (!fromNode || !toNode) return;

      const isLoopback = fromNode.col >= toNode.col;
      const isArching =
        !isLoopback && fromNode.row === toNode.row && toNode.col > fromNode.col + 1.2;

      let startX: number;
      let startY: number;
      let endX: number;
      let endY: number;
      let pathD = '';
      let midX = 0;
      let midY = 0;

      if (isLoopback) {
        // Return / loopback arrow: curves up or around
        startX = fromNode.x + fromNode.w * 0.35;
        startY = fromNode.y;
        endX = toNode.x + toNode.w * 0.65;
        endY = toNode.y + toNode.h;

        const controlY = Math.min(startY, endY) - 30;
        pathD = `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY + 20}, ${endX} ${endY}`;
        midX = (startX + endX) / 2;
        midY = controlY + 10;
      } else if (isArching) {
        // Arching over the top across multiple columns
        startX = fromNode.x + fromNode.w * 0.5;
        startY = fromNode.y;
        endX = toNode.x + toNode.w * 0.5;
        endY = toNode.y;

        const archY = Math.min(startY, endY) - (45 + (toNode.col - fromNode.col) * 12);
        pathD = `M ${startX} ${startY} C ${startX} ${archY}, ${endX} ${archY}, ${endX} ${endY}`;
        midX = (startX + endX) / 2;
        midY = archY + 15;
      } else if (fromNode.row === toNode.row) {
        // Direct forward horizontal connector
        startX = fromNode.x + fromNode.w;
        startY = fromNode.y + fromNode.h / 2;
        endX = toNode.x;
        endY = toNode.y + toNode.h / 2;

        const cpX = (startX + endX) / 2;
        pathD = `M ${startX} ${startY} C ${cpX} ${startY}, ${cpX} ${endY}, ${endX} ${endY}`;
        midX = (startX + endX) / 2;
        midY = (startY + endY) / 2;
      } else {
        // Between rows (downward branching or exception)
        startX = fromNode.x + fromNode.w / 2;
        startY = fromNode.y + fromNode.h;
        endX = toNode.x + toNode.w / 2;
        endY = toNode.y;

        const cpY = (startY + endY) / 2;
        pathD = `M ${startX} ${startY} C ${startX} ${cpY}, ${endX} ${cpY}, ${endX} ${endY}`;
        midX = (startX + endX) / 2;
        midY = (startY + endY) / 2;
      }

      const category = stageMap.get(t.to)?.statusCategory ?? 'in_review';
      const color = CATEGORY_STYLES[category]?.lineColor ?? '#64748b';

      renderEdges.push({
        transition: t,
        fromNode,
        toNode,
        pathD,
        midX,
        midY,
        color,
        isLoopback,
        isArching,
      });
    });

    // Compute bounding canvas size
    let maxX = 800;
    let maxY = 380;
    positionedNodes.forEach((n) => {
      if (n.x + n.w + 100 > maxX) maxX = n.x + n.w + 100;
      if (n.y + n.h + 100 > maxY) maxY = n.y + n.h + 100;
    });

    return {
      nodes: positionedNodes,
      edges: renderEdges,
      canvasWidth: Math.max(maxX, 1100),
      canvasHeight: Math.max(maxY, 420),
    };
  }, [workflow, NODE_WIDTH, NODE_HEIGHT, COL_SPACING, ROW_SPACING, PADDING_X, PADDING_Y]);

  // Extract unique roles from workflow
  const allWorkflowRoles = useMemo(() => {
    const rolesSet = new Set<string>();
    workflow.transitions.forEach((t) => t.roles.forEach((r) => rolesSet.add(r)));
    return Array.from(rolesSet);
  }, [workflow]);

  // Inspect selected stage details
  const activeStage = useMemo(() => {
    if (!selectedStageId) return null;
    return workflow.stages.find((s) => s.id === selectedStageId) ?? null;
  }, [workflow, selectedStageId]);

  const activeStageIncoming = useMemo(() => {
    if (!selectedStageId) return [];
    return workflow.transitions.filter((t) => t.to === selectedStageId);
  }, [workflow, selectedStageId]);

  const activeStageOutgoing = useMemo(() => {
    if (!selectedStageId) return [];
    return workflow.transitions.filter((t) => t.from === selectedStageId);
  }, [workflow, selectedStageId]);

  const activeStageRequiredFields = useMemo(() => {
    if (!selectedStageId) return [];
    const fieldKeys = new Set<string>();
    workflow.transitions
      .filter((t) => t.from === selectedStageId)
      .forEach((t) => t.requiredFields?.forEach((f) => fieldKeys.add(f)));
    return Array.from(fieldKeys).map((key) => {
      const fieldDef = fields.find((f) => f.key === key);
      return fieldDef ? fieldDef.label : key;
    });
  }, [workflow, selectedStageId, fields]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border/80 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Approval Flow Diagram</h3>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium">
                {workflow.stages.length} Stages · {workflow.transitions.length} Transitions
              </Badge>
              {workflow.initialStage && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="h-2.5 w-2.5" /> Start:{' '}
                  {workflow.stages.find((s) => s.id === workflow.initialStage)?.label ??
                    workflow.initialStage}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Interactive visualization of workflow progression, decision branches, and role
              permissions
            </p>
          </div>
        </div>

        {/* View & Role Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Role Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground text-[11px] font-medium hidden md:inline">
              Role Filter:
            </span>
            <select
              aria-label="Filter by role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Roles ({allWorkflowRoles.length})</option>
              {allWorkflowRoles.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg border border-border bg-background p-0.5 shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md"
              title="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.1).toFixed(2))))}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="px-1.5 text-[11px] font-mono text-muted-foreground min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md"
              title="Zoom in"
              onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-[10px]"
              title="Reset Zoom"
              onClick={() => setZoom(1)}
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>

          {/* Collapse / Expand toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? 'Show Diagram' : 'Hide Diagram'}
            <ChevronDown
              className={`ml-1 h-3.5 w-3.5 transition-transform duration-200 ${
                isCollapsed ? '-rotate-90' : 'rotate-0'
              }`}
            />
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Legend Banner */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2 bg-muted/10 border-b border-border/50 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Layers className="h-3 w-3" /> Status Legend:
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> Draft
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> In Review / Verification
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Approved / Dispatched
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> In Progress
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-500" /> Completed
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> Returned
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Rejected / Cancelled
            </span>
            <span className="ml-auto text-[10px] italic hidden lg:inline">
              Tip: Click any stage card to highlight connections or jump to editor
            </span>
          </div>

          {/* Interactive Scrollable Canvas */}
          <div
            ref={canvasRef}
            className="relative w-full overflow-x-auto overflow-y-hidden bg-dot-grid p-6 min-h-[360px] select-none"
            style={{
              backgroundImage:
                'radial-gradient(circle, hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <div
              className="relative transition-transform duration-150 origin-top-left"
              style={{
                width: canvasWidth,
                height: canvasHeight,
                transform: `scale(${zoom})`,
              }}
            >
              {/* SVG Layer for Curves and Arrows */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={canvasWidth}
                height={canvasHeight}
              >
                <defs>
                  {/* Color-specific Arrowheads */}
                  {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
                    <marker
                      key={`arrow-${key}`}
                      id={`arrow-${key}`}
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={style.lineColor} />
                    </marker>
                  ))}
                  <marker
                    id="arrow-default"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
                  </marker>
                  <marker
                    id="arrow-highlight"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="hsl(var(--primary))" />
                  </marker>
                </defs>

                {/* Render Transition Connectors */}
                {edges.map((edge, idx) => {
                  const isRoleMatch =
                    selectedRole === 'all' || edge.transition.roles.includes(selectedRole);

                  const isConnectedToSelected =
                    selectedStageId &&
                    (edge.transition.from === selectedStageId ||
                      edge.transition.to === selectedStageId);

                  const isConnectedToHovered =
                    hoveredStageId &&
                    (edge.transition.from === hoveredStageId ||
                      edge.transition.to === hoveredStageId);

                  const isEdgeHovered = hoveredTransitionIndex === idx;

                  const isHighlighted = Boolean(
                    isConnectedToSelected || isConnectedToHovered || isEdgeHovered,
                  );

                  const isDimmed =
                    !isRoleMatch || (Boolean(selectedStageId || hoveredStageId) && !isHighlighted);

                  const strokeColor = isHighlighted
                    ? 'hsl(var(--primary))'
                    : isRoleMatch
                      ? edge.color
                      : '#94a3b8';

                  const markerId = isHighlighted
                    ? 'url(#arrow-highlight)'
                    : `url(#arrow-${edge.toNode.stage.statusCategory})`;

                  return (
                    <g
                      key={`edge-${edge.transition.from}-${edge.transition.to}-${idx}`}
                      className="transition-opacity duration-200 pointer-events-auto"
                      style={{ opacity: isDimmed ? 0.2 : 1 }}
                      onMouseEnter={() => setHoveredTransitionIndex(idx)}
                      onMouseLeave={() => setHoveredTransitionIndex(null)}
                    >
                      {/* Glow background stroke on highlight */}
                      {isHighlighted && (
                        <path
                          d={edge.pathD}
                          fill="none"
                          stroke="hsl(var(--primary) / 0.25)"
                          strokeWidth="8"
                          strokeLinecap="round"
                        />
                      )}

                      {/* Main Connector Path */}
                      <path
                        d={edge.pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isHighlighted ? 3 : 2}
                        strokeDasharray={
                          edge.isLoopback ? '5,4' : isHighlighted ? '6,3' : undefined
                        }
                        markerEnd={markerId}
                        className={isHighlighted ? 'animate-pulse' : ''}
                      />

                      {/* Transition Action / Roles Pill */}
                      {isRoleMatch && (
                        <g
                          transform={`translate(${edge.midX}, ${edge.midY})`}
                          className="cursor-pointer"
                        >
                          <rect
                            x="-32"
                            y="-11"
                            width="64"
                            height="22"
                            rx="11"
                            fill="hsl(var(--card))"
                            stroke={isHighlighted ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                            strokeWidth="1"
                            className="shadow-xs transition-colors"
                          />
                          <text
                            x="0"
                            y="4"
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="600"
                            fill="hsl(var(--foreground))"
                            className="font-mono select-none pointer-events-none"
                          >
                            {edge.transition.action === 'resubmitted'
                              ? '↺ Return'
                              : edge.transition.reasonRequired
                                ? '⚠️ Req.'
                                : `${edge.transition.roles.length} role${
                                    edge.transition.roles.length === 1 ? '' : 's'
                                  }`}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* HTML Stage Node Cards */}
              {nodes.map((node) => {
                const style = CATEGORY_STYLES[node.stage.statusCategory] ?? CATEGORY_STYLES.draft;
                const IconComponent = style.icon;
                const isSelected = selectedStageId === node.stage.id;
                const isHovered = hoveredStageId === node.stage.id;

                const hasRoleTransition =
                  selectedRole === 'all' ||
                  workflow.transitions.some(
                    (t) =>
                      (t.from === node.stage.id || t.to === node.stage.id) &&
                      t.roles.includes(selectedRole),
                  );

                const isConnectedToSelected =
                  selectedStageId &&
                  workflow.transitions.some(
                    (t) =>
                      (t.from === selectedStageId && t.to === node.stage.id) ||
                      (t.to === selectedStageId && t.from === node.stage.id),
                  );

                const isDimmed =
                  !hasRoleTransition ||
                  (Boolean(selectedStageId) && !isSelected && !isConnectedToSelected);

                return (
                  <div
                    key={node.stage.id}
                    id={`diagram-node-${node.stage.id}`}
                    onClick={() => {
                      setSelectedStageId(isSelected ? null : node.stage.id);
                      if (onSelectStage) onSelectStage(node.stage.id);
                    }}
                    onMouseEnter={() => setHoveredStageId(node.stage.id)}
                    onMouseLeave={() => setHoveredStageId(null)}
                    className={`absolute flex flex-col justify-between rounded-xl border p-3 cursor-pointer transition-all duration-200 select-none bg-card ${
                      style.border
                    } ${style.glow} ${
                      isSelected
                        ? 'ring-2 ring-primary shadow-lg scale-105 z-30'
                        : isHovered
                          ? 'shadow-md scale-102 z-20'
                          : 'shadow-xs z-10'
                    }`}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.w,
                      height: node.h,
                      opacity: isDimmed ? 0.35 : 1,
                    }}
                  >
                    {/* Top line: Initial Badge / Category Badge */}
                    <div className="flex items-center justify-between gap-1 w-full">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.text}`}
                        >
                          <IconComponent className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs font-bold text-foreground truncate">
                          {node.stage.label}
                        </span>
                      </div>

                      {node.isInitial ? (
                        <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          ENTRY
                        </span>
                      ) : (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.2 text-[9px] font-semibold border ${style.badgeBg}`}
                        >
                          {style.label}
                        </span>
                      )}
                    </div>

                    {/* Bottom line: Stage ID & Transition Counts */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                      <code className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[120px]">
                        {node.stage.id}
                      </code>

                      {/* In/Out badges */}
                      <div className="flex items-center gap-1 shrink-0 font-mono">
                        <span
                          title="Incoming transitions"
                          className="text-emerald-600 dark:text-emerald-400"
                        >
                          ↓{workflow.transitions.filter((t) => t.to === node.stage.id).length}
                        </span>
                        <span title="Outgoing transitions" className="text-primary">
                          ↑{workflow.transitions.filter((t) => t.from === node.stage.id).length}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Stage Detail / Inspector Banner */}
          {activeStage && (
            <div className="px-5 py-3.5 border-t border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs animate-fade-in">
              <div className="flex items-start md:items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    CATEGORY_STYLES[activeStage.statusCategory]?.bg
                  } ${CATEGORY_STYLES[activeStage.statusCategory]?.text} ${
                    CATEGORY_STYLES[activeStage.statusCategory]?.border
                  }`}
                >
                  {React.createElement(
                    CATEGORY_STYLES[activeStage.statusCategory]?.icon ?? FileText,
                    { className: 'h-4 w-4' },
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      Stage: {activeStage.label}
                    </span>
                    <code className="font-mono text-[11px] bg-muted px-1.5 py-0.2 rounded">
                      {activeStage.id}
                    </code>
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORY_STYLES[activeStage.statusCategory]?.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
                    <span>
                      <strong>{activeStageIncoming.length}</strong> incoming transition(s)
                    </span>
                    <span>
                      <strong>{activeStageOutgoing.length}</strong> next path(s) to:{' '}
                      {activeStageOutgoing
                        .map((t) => workflow.stages.find((s) => s.id === t.to)?.label ?? t.to)
                        .join(', ') || 'Terminal'}
                    </span>
                    {activeStageRequiredFields.length > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Required fields:{' '}
                        <span className="font-normal text-foreground">
                          {activeStageRequiredFields.join(', ')}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => {
                    const el = document.getElementById(`stage-label-${activeStage.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el?.focus();
                  }}
                >
                  <span>Edit Stage Fields ↓</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => setSelectedStageId(null)}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
