import { useEffect, useRef, useState } from "react";
import { listNotes, listSkills, Note, Skill } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Share2 } from "lucide-react";

interface Node {
  id: string;
  title: string;
  type: "note" | "skill";
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

interface Edge {
  from: string;
  to: string;
}

export function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hovered, setHovered] = useState<Node | null>(null);
  const navigate = useNavigate();
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    (async () => {
      const [n, s] = await Promise.all([listNotes(true), listSkills()]);
      setNotes(n);
      setSkills(s);
    })();
  }, []);

  useEffect(() => {
    if (notes.length + skills.length === 0) return;
    // Build nodes
    const W = canvasRef.current?.clientWidth ?? 800;
    const H = canvasRef.current?.clientHeight ?? 600;
    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];

    // Place skills in a circle
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) * 0.35;
    skills.forEach((s, i) => {
      const angle = (i / Math.max(1, skills.length)) * Math.PI * 2;
      allNodes.push({
        id: s.id,
        title: s.name,
        type: "skill",
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        color: s.color,
      });
    });

    // Notes orbit around their skill (or random if no skill)
    notes.forEach((n, i) => {
      const skill = skills.find((s) => s.id === n.skill_id);
      if (skill) {
        const parent = allNodes.find((x) => x.id === skill.id)!;
        const angle = (i * 1.618) % (Math.PI * 2);
        const r2 = 80 + ((i * 13) % 60);
        allNodes.push({
          id: n.id,
          title: n.title,
          type: "note",
          x: parent.x + Math.cos(angle) * r2,
          y: parent.y + Math.sin(angle) * r2,
          vx: 0,
          vy: 0,
          color: "#22d3ee",
        });
        allEdges.push({ from: skill.id, to: n.id });
      } else {
        allNodes.push({
          id: n.id,
          title: n.title,
          type: "note",
          x: cx + (Math.random() - 0.5) * 300,
          y: cy + (Math.random() - 0.5) * 300,
          vx: 0,
          vy: 0,
          color: "#a78bfa",
        });
      }
    });

    // Wikilinks between notes
    notes.forEach((n) => {
      const matches = n.content.matchAll(/\[\[([^\]]+)\]\]/g);
      for (const m of matches) {
        const target = notes.find((x) => x.title.toLowerCase() === m[1].toLowerCase());
        if (target && target.id !== n.id) {
          allEdges.push({ from: n.id, to: target.id });
        }
      }
    });

    setNodes(allNodes);
    setEdges(allEdges);
  }, [notes, skills]);

  // Force simulation + render
  useEffect(() => {
    if (nodes.length === 0) return;
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

    const tick = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      const t = transformRef.current;

      // Apply transform
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // Force simulation
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (dragRef.current?.id === a.id) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 8000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (dragRef.current?.id !== b.id) { b.vx -= fx; b.vy -= fy; }
          if (dragRef.current?.id !== a.id) { a.vx += fx; a.vy += fy; }
        }
      }
      // Spring edges
      for (const e of edges) {
        const a = nodes.find((x) => x.id === e.from);
        const b = nodes.find((x) => x.id === e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const target = 140;
        const diff = dist - target;
        const fx = (dx / dist) * diff * 0.05;
        const fy = (dy / dist) * diff * 0.05;
        if (dragRef.current?.id !== b.id) { b.vx -= fx; b.vy -= fy; }
        if (dragRef.current?.id !== a.id) { a.vx += fx; a.vy += fy; }
      }
      // Center pull
      const W = canvas.clientWidth, H = canvas.clientHeight;
      for (const n of nodes) {
        if (dragRef.current?.id === n.id) continue;
        n.vx += (W / 2 - n.x) * 0.001;
        n.vy += (H / 2 - n.y) * 0.001;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      }

      // Edges
      ctx.strokeStyle = "rgba(34, 211, 238, 0.15)";
      ctx.lineWidth = 1;
      for (const e of edges) {
        const a = nodes.find((x) => x.id === e.from);
        const b = nodes.find((x) => x.id === e.to);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const isHover = hovered?.id === n.id;
        ctx.beginPath();
        ctx.arc(n.x, n.y, isHover ? 9 : n.type === "skill" ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        if (n.type === "skill") {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 10, 0, Math.PI * 2);
          ctx.strokeStyle = n.color;
          ctx.globalAlpha = 0.4;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (isHover) {
          ctx.font = "12px Inter, sans-serif";
          ctx.fillStyle = "#e5e7eb";
          ctx.fillText(n.title, n.x + 12, n.y + 4);
        }
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [nodes, edges, hovered]);

  // Mouse handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toCanvas = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      return {
        x: (e.clientX - rect.left - t.x) / t.k,
        y: (e.clientY - rect.top - t.y) / t.k,
      };
    };

    const onDown = (e: MouseEvent) => {
      const p = toCanvas(e);
      // Find nearest node
      let best: { n: Node; d: number } | null = null;
      for (const n of nodes) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < 15 && (!best || d < best.d)) best = { n, d };
      }
      if (best) {
        dragRef.current = { id: best.n.id, ox: best.n.x - p.x, oy: best.n.y - p.y };
      } else {
        panRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onMove = (e: MouseEvent) => {
      const p = toCanvas(e);
      if (dragRef.current) {
        const n = nodes.find((x) => x.id === dragRef.current!.id);
        if (n) { n.x = p.x + dragRef.current.ox; n.y = p.y + dragRef.current.oy; n.vx = 0; n.vy = 0; }
      } else if (panRef.current) {
        const t = transformRef.current;
        t.x += e.clientX - panRef.current.x;
        t.y += e.clientY - panRef.current.y;
        panRef.current = { x: e.clientX, y: e.clientY };
      } else {
        // hover
        let best: { n: Node; d: number } | null = null;
        for (const n of nodes) {
          const d = Math.hypot(n.x - p.x, n.y - p.y);
          if (d < 15 && (!best || d < best.d)) best = { n, d };
        }
        setHovered(best?.n ?? null);
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        const n = nodes.find((x) => x.id === dragRef.current!.id);
        if (n) {
          if (n.type === "note") navigate(`/notes/${n.id}`);
          else navigate(`/skills/${n.id}`);
        }
      }
      dragRef.current = null;
      panRef.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = transformRef.current;
      const delta = -e.deltaY * 0.001;
      t.k = Math.max(0.3, Math.min(3, t.k + delta));
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
  }, [nodes, navigate]);

  return (
    <div className="h-full p-6">
      <div className="flex items-center gap-2 mb-3 text-sm text-fg-muted">
        <Share2 size={14} className="text-accent" />
        <span>{nodes.length} nodes, {edges.length} connections</span>
        <span className="ml-2">•</span>
        <span>Drag nodes, click to navigate, scroll to zoom, drag empty space to pan</span>
      </div>
      <div className="surface-elevated h-[calc(100%-3rem)] overflow-hidden relative bg-grid-fade">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ cursor: hovered ? "pointer" : "grab" }}
        />
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-fg-muted text-sm">
            Add notes and skills to see your knowledge graph
          </div>
        )}
      </div>
    </div>
  );
}
