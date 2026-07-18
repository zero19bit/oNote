import { useEffect, useRef, useState } from "react";
import { listNotes, listSkills, listProjects, Note, Skill, Project } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import {
  Share2,
  RotateCcw,
  FileText,
  Sparkles,
  Target,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn, truncate } from "@/lib/utils";

type NodeType = "note" | "skill" | "project";
type FilterMode = "all" | NodeType;

interface Node {
  id: string;
  title: string;
  type: NodeType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  degree: number;
}

interface Edge {
  from: string;
  to: string;
}

/** Fixed color per type so the legend stays stable across themes.
 *  Skill nodes use their own `color` for the fill. */
const TYPE_COLOR: Record<NodeType, string> = {
  note:    "#22d3ee", // accent (matches the app)
  skill:   "#a78bfa", // brand purple
  project: "#fbbf24", // brand amber
};

/** Deterministic PRNG seeded by an id so the initial scatter is the same
 *  every render — Obsidian's graph also has stable positions across opens. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

export function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [layout, setLayout] = useState<{ nodes: Node[]; edges: Edge[] }>({
    nodes: [],
    edges: [],
  });
  const [filter, setFilter] = useState<FilterMode>("all");
  const [hideOrphans, setHideOrphans] = useState(false);
  const [hovered, setHovered] = useState<Node | null>(null);
  const [tickGen, setTickGen] = useState(0);
  const navigate = useNavigate();
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const movedRef = useRef(false);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });

  // Load all three data sources
  useEffect(() => {
    (async () => {
      const [n, s, p] = await Promise.all([
        listNotes(true),
        listSkills(),
        listProjects(),
      ]);
      setNotes(n);
      setSkills(s);
      setProjects(p);
    })();
  }, []);

  // Build graph + run force simulation (fixed iteration, with cooling)
  useEffect(() => {
    if (notes.length + skills.length + projects.length === 0) return;
    const canvas = canvasRef.current;
    const W = canvas?.clientWidth ?? 800;
    const H = canvas?.clientHeight ?? 600;
    const cx = W / 2, cy = H / 2;

    const skillIds = new Set(skills.map((s) => s.id));
    const projectIds = new Set(projects.map((p) => p.id));

    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];
    const degree = new Map<string, number>();

    const addEdge = (a: string, b: string) => {
      if (a === b) return;
      // Avoid duplicate edges
      if (allEdges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a))) {
        return;
      }
      allEdges.push({ from: a, to: b });
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    };

    // Initial positions: deterministic so the same data → same starting layout
    const placeInitial = (n: Node, baseR: number, jitter: number, seed: string) => {
      const rand = seededRandom(seed);
      const a = rand() * Math.PI * 2;
      const r = baseR + (rand() - 0.5) * jitter;
      n.x = cx + Math.cos(a) * r;
      n.y = cy + Math.sin(a) * r;
    };

    for (const s of skills) {
      const n: Node = {
        id: s.id, title: s.name, type: "skill",
        x: 0, y: 0, vx: 0, vy: 0,
        color: s.color || TYPE_COLOR.skill, degree: 0,
      };
      placeInitial(n, Math.min(W, H) * 0.10, Math.min(W, H) * 0.10, s.id);
      allNodes.push(n);
    }
    for (const p of projects) {
      const n: Node = {
        id: p.id, title: p.name, type: "project",
        x: 0, y: 0, vx: 0, vy: 0,
        color: TYPE_COLOR.project, degree: 0,
      };
      placeInitial(n, Math.min(W, H) * 0.30, Math.min(W, H) * 0.10, p.id);
      allNodes.push(n);
    }
    for (const n of notes) {
      const node: Node = {
        id: n.id, title: n.title, type: "note",
        x: 0, y: 0, vx: 0, vy: 0,
        color: TYPE_COLOR.note, degree: 0,
      };
      placeInitial(node, Math.min(W, H) * 0.18, Math.min(W, H) * 0.25, n.id);
      allNodes.push(node);
    }

    // Edges
    for (const n of notes) {
      if (n.skill_id && skillIds.has(n.skill_id)) {
        addEdge(n.skill_id, n.id);
      }
      if (n.project_id && projectIds.has(n.project_id)) {
        addEdge(n.project_id, n.id);
      }
      for (const m of n.content.matchAll(/\[\[([^\]]+)\]\]/g)) {
        const target = notes.find((x) => x.title.toLowerCase() === m[1].toLowerCase());
        if (target && target.id !== n.id) addEdge(n.id, target.id);
      }
    }

    for (const node of allNodes) node.degree = degree.get(node.id) ?? 0;

    // === Force simulation: fixed iterations + cooling alpha ===
    // Obsidian-style: run N iterations, then stop. No per-frame force.
    const MAX_ITER = 350;
    const REPEL_BASE = 5500;
    const SPRING_K = 0.045;
    const SPRING_LEN = 115;
    const CENTER_PULL = 0.010;
    const DAMPING = 0.86;
    const maxR = Math.min(W, H) * 0.42;

    for (let iter = 0; iter < MAX_ITER; iter++) {
      const t = iter / MAX_ITER;
      const alpha = (1 - t) * (1 - t); // quadratic cooling: 1 → 0

      // Repulsion (all pairs; alpha scales it)
      for (let i = 0; i < allNodes.length; i++) {
        const a = allNodes[i];
        for (let j = i + 1; j < allNodes.length; j++) {
          const b = allNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy || 0.01;
          const dist = Math.sqrt(dist2);
          const force = (REPEL_BASE * alpha) / dist2;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }

      // Springs
      for (const e of allEdges) {
        const a = allNodes.find((x) => x.id === e.from);
        const b = allNodes.find((x) => x.id === e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const diff = dist - SPRING_LEN;
        const k = SPRING_K * alpha;
        const fx = (dx / dist) * diff * k;
        const fy = (dy / dist) * diff * k;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Center pull + soft boundary
      for (const n of allNodes) {
        n.vx += (cx - n.x) * CENTER_PULL * alpha;
        n.vy += (cy - n.y) * CENTER_PULL * alpha;
        const ddx = n.x - cx;
        const ddy = n.y - cy;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d > maxR) {
          const over = (d - maxR) / maxR;
          const k = 0.06 * over * over;
          n.vx -= (ddx / (d || 1)) * k * maxR;
          n.vy -= (ddy / (d || 1)) * k * maxR;
        }
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    for (const n of allNodes) { n.vx = 0; n.vy = 0; }
    setLayout({ nodes: allNodes, edges: allEdges });
  }, [notes, skills, projects, filter, hideOrphans, tickGen]);

  // Apply filter on top of the layout
  const visibleIds = new Set<string>();
  for (const n of layout.nodes) {
    if (hideOrphans && n.degree === 0) continue;
    if (filter === "all") visibleIds.add(n.id);
    else if (filter === n.type) visibleIds.add(n.id);
  }
  const visibleEdges = layout.edges.filter(
    (e) => visibleIds.has(e.from) && visibleIds.has(e.to)
  );

  // Connected to hovered
  const highlightedIds = new Set<string>();
  if (hovered) {
    highlightedIds.add(hovered.id);
    for (const e of layout.edges) {
      if (e.from === hovered.id) highlightedIds.add(e.to);
      if (e.to === hovered.id) highlightedIds.add(e.from);
    }
  }

  // Render loop — drawing only, no forces
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const nodeRadius = (n: Node) => {
      const base = n.type === "skill" ? 6 : n.type === "project" ? 5 : 4;
      return base + Math.min(n.degree, 8) * 0.6;
    };

    const tick = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const t = transformRef.current;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // Edges
      for (const e of visibleEdges) {
        const a = layout.nodes.find((x) => x.id === e.from);
        const b = layout.nodes.find((x) => x.id === e.to);
        if (!a || !b) continue;
        const isHL = hovered && (e.from === hovered.id || e.to === hovered.id);
        const dim = hovered && !isHL;
        ctx.strokeStyle = isHL
          ? "rgba(34, 211, 238, 0.55)"
          : dim
          ? "rgba(120, 120, 140, 0.04)"
          : "rgba(120, 120, 140, 0.22)";
        ctx.lineWidth = isHL ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes
      for (const n of layout.nodes) {
        if (!visibleIds.has(n.id)) continue;
        const r = nodeRadius(n);
        const dim = hovered && !highlightedIds.has(n.id);
        ctx.globalAlpha = dim ? 0.18 : 1;
        // Skill gets a faint outer ring (like a "halo" in Obsidian)
        if (n.type === "skill") {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
          ctx.strokeStyle = n.color;
          ctx.globalAlpha = dim ? 0.08 : 0.35;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = dim ? 0.18 : 1;
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        if (hovered?.id === n.id) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 2, 0, Math.PI * 2);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Labels (always visible; brighter on hover / direct neighbor)
      ctx.textAlign = "center";
      for (const n of layout.nodes) {
        if (!visibleIds.has(n.id)) continue;
        const isHover = hovered?.id === n.id;
        const isNeighbor = hovered && highlightedIds.has(n.id) && !isHover;
        const r = nodeRadius(n);
        const fontSize = isHover ? 12 : 10;
        ctx.font = isHover
          ? `600 ${fontSize}px Inter, sans-serif`
          : `${fontSize}px Inter, sans-serif`;
        if (isHover) ctx.fillStyle = "#ffffff";
        else if (isNeighbor) ctx.fillStyle = "rgba(229, 231, 235, 0.85)";
        else if (hovered) ctx.fillStyle = "rgba(229, 231, 235, 0.18)";
        else ctx.fillStyle = "rgba(229, 231, 235, 0.55)";
        ctx.fillText(
          truncate(n.title || "Untitled", 26),
          n.x,
          n.y + r + 12
        );
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [layout, hovered, visibleIds, visibleEdges, highlightedIds]);

  // Mouse handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const nodes = layout.nodes;

    const toCanvas = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      return {
        x: (e.clientX - rect.left - t.x) / t.k,
        y: (e.clientY - rect.top - t.y) / t.k,
      };
    };

    const findNode = (p: { x: number; y: number }) => {
      let best: { n: Node; d: number } | null = null;
      for (const n of nodes) {
        const r = n.type === "skill" ? 9 : n.type === "project" ? 7 : 6;
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < r + 2 && (!best || d < best.d)) best = { n, d };
      }
      return best;
    };

    const onDown = (e: MouseEvent) => {
      const p = toCanvas(e);
      const hit = findNode(p);
      if (hit) {
        movedRef.current = false;
        dragRef.current = { id: hit.n.id, ox: hit.n.x - p.x, oy: hit.n.y - p.y };
      } else {
        panRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onMove = (e: MouseEvent) => {
      const p = toCanvas(e);
      if (dragRef.current) {
        const n = nodes.find((x) => x.id === dragRef.current!.id);
        if (n) {
          n.x = p.x + dragRef.current.ox;
          n.y = p.y + dragRef.current.oy;
          movedRef.current = true;
        }
      } else if (panRef.current) {
        const t = transformRef.current;
        t.x += e.clientX - panRef.current.x;
        t.y += e.clientY - panRef.current.y;
        panRef.current = { x: e.clientX, y: e.clientY };
      } else {
        const hit = findNode(p);
        setHovered(hit?.n ?? null);
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        // Click (no drag) → navigate
        if (!movedRef.current) {
          const n = nodes.find((x) => x.id === dragRef.current!.id);
          if (n) {
            if (n.type === "note") navigate(`/notes/${n.id}`);
            else if (n.type === "skill") navigate(`/skills/${n.id}`);
            else if (n.type === "project") navigate(`/projects?focus=${n.id}`);
          }
        }
      }
      dragRef.current = null;
      panRef.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = transformRef.current;
      const delta = -e.deltaY * 0.0015;
      t.k = Math.max(0.2, Math.min(4, t.k + delta));
    };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [layout.nodes, navigate]);

  const totalNodes = layout.nodes.length;
  const totalEdges = layout.edges.length;

  return (
    <div className="h-full p-6 flex flex-col">
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-fg-muted">
          <Share2 size={14} className="text-accent" />
          <span>
            {visibleIds.size} of {totalNodes} nodes
            {visibleEdges.length !== totalEdges && (
              <span className="opacity-60"> · {visibleEdges.length} links</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-2">
          {([
            { id: "all",      label: "All" },
            { id: "note",     label: "Notes",    Icon: FileText },
            { id: "skill",    label: "Skills",   Icon: Sparkles },
            { id: "project",  label: "Projects", Icon: Target },
          ] as { id: FilterMode; label: string; Icon?: any }[]).map((f) => {
            const active = filter === f.id;
            const Icon = f.Icon;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 border transition-colors",
                  active
                    ? "bg-accent/20 border-accent/50 text-accent"
                    : "border-border text-fg-muted hover:text-fg hover:bg-bg-elevated"
                )}
              >
                {Icon && <Icon size={11} />}
                {f.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setHideOrphans((v) => !v)}
          className={cn(
            "ml-1 px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 border transition-colors",
            hideOrphans
              ? "bg-brand-amber/20 border-brand-amber/50 text-brand-amber"
              : "border-border text-fg-muted hover:text-fg hover:bg-bg-elevated"
          )}
          title="Hide nodes with no connections"
        >
          {hideOrphans ? <EyeOff size={11} /> : <Eye size={11} />}
          Orphans
        </button>

        <button
          onClick={() => setTickGen((g) => g + 1)}
          className="ml-auto btn-ghost text-xs"
          title="Re-run force simulation from scratch"
        >
          <RotateCcw size={12} /> Reset layout
        </button>
      </div>

      <div className="surface-elevated flex-1 overflow-hidden relative bg-grid-fade">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ cursor: hovered ? "pointer" : "grab" }}
        />
        {totalNodes === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-fg-muted text-sm">
            Add notes, skills, or projects to see your knowledge graph
          </div>
        )}

        {/* Legend — like Obsidian's bottom-left strip */}
        {totalNodes > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[11px] text-fg-muted bg-bg-elevated/80 backdrop-blur px-3 py-1.5 rounded-md border border-border">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLOR.note }} />
              Note
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLOR.skill }} />
              Skill
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLOR.project }} />
              Project
            </span>
          </div>
        )}

        {/* Hover hint */}
        {totalNodes > 0 && (
          <div className="absolute bottom-3 right-3 text-[10px] text-fg-subtle bg-bg-elevated/80 backdrop-blur px-2.5 py-1.5 rounded-md border border-border">
            Drag to move · scroll to zoom · click to open
          </div>
        )}
      </div>
    </div>
  );
}
