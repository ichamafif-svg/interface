"use client";
/**
 * Carte en couches, façon réseau de neurones : chaque colonne est une couche du trajet
 * (entrées → bordure → services → données et sorties → tiers), les connexions sont des courbes,
 * les signaux s'y propagent. SVG pur : net à toutes les tailles, accessible au clavier.
 */
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import type { State, Topology, TopologyNode } from "@/lib/api/types";

export const NN_COLOR: Record<State, string> = {
  qualifie: "#4ade80",
  observe: "#60a5fa",
  propose: "#d4d4dc",
  inconnu: "#fbbf24",
  non_couvert: "#f87171",
  non_etaye: "#c4b5fd",
  hors_standard: "#7c7c8a",
};

const LAYERS: { title: string; kinds: TopologyNode["kind"][] }[] = [
  { title: "Entrées", kinds: ["client", "external"] },
  { title: "Bordure", kinds: ["entry", "identity", "sandbox"] },
  { title: "Services", kinds: ["service", "kernel"] },
  { title: "Données · sorties", kinds: ["datastore", "secrets", "egress"] },
  { title: "Tiers", kinds: ["third_party", "cdn"] },
];
const MANAGED_ORDER: Record<TopologyNode["managed"], number> = { outside: 0, product: 1, standard: 2 };
const W = 1100, COL = 230, X0 = 90, ROW = 96, TOP = 70, R = 15;

export type NeuralApi = { pulse: (p: { edge?: string; node?: string; color: string }) => void };
type Pulse = { key: number; edge?: string; node?: string; color: string };

export const NeuralMap = forwardRef<
  NeuralApi,
  {
    topology: Topology;
    focus: { nodes: Set<string>; edges: Set<string> } | null;
    broken: boolean;
    selected: string | null;
    onSelect: (id: string | null) => void;
    onHover: (id: string | null) => void;
  }
>(function NeuralMap({ topology, focus, broken, selected, onSelect, onHover }, ref) {
  const [pulses, setPulses] = useState<Pulse[]>([]);

  const { pos, height } = useMemo(() => {
    const pos: Record<string, { x: number; y: number; col: number }> = {};
    const cols = LAYERS.map((l) => topology.nodes.filter((n) => l.kinds.includes(n.kind)).sort((a, b) => MANAGED_ORDER[a.managed] - MANAGED_ORDER[b.managed] || a.label.localeCompare(b.label)));
    const tallest = Math.max(...cols.map((c) => c.length));
    const height = TOP + tallest * ROW + 30;
    const place = () =>
      cols.forEach((list, c) => {
        const offset = ((tallest - list.length) * ROW) / 2;
        list.forEach((n, i) => (pos[n.id] = { x: X0 + c * COL, y: TOP + 34 + offset + i * ROW, col: c }));
      });
    place();
    // Ordre barycentrique : chaque nœud se range à la hauteur moyenne de ses voisins, pour limiter les croisements.
    const neighbours = (id: string) => topology.edges.flatMap((e) => (e.from === id ? [e.to] : e.to === id ? [e.from] : [])).filter((x) => pos[x] && pos[x].col !== pos[id].col);
    for (let pass = 0; pass < 6; pass++) {
      const order = pass % 2 === 0 ? cols.map((_, i) => i) : cols.map((_, i) => cols.length - 1 - i);
      for (const c of order) {
        const bary = (id: string) => {
          const ns = neighbours(id);
          return ns.length ? ns.reduce((sum, x) => sum + pos[x].y, 0) / ns.length : pos[id].y;
        };
        const scored = cols[c].map((n) => [n, bary(n.id)] as const);
        cols[c] = scored.sort((a, b) => a[1] - b[1]).map(([n]) => n);
        place();
      }
    }
    return { pos, height };
  }, [topology]);

  // Couloirs libres de chaque couche : milieux entre deux nœuds, plus au-dessus et en dessous.
  const lanes = useMemo(() => {
    const byCol: Record<number, number[]> = {};
    for (const p of Object.values(pos)) (byCol[p.col] ??= []).push(p.y);
    const out: Record<number, number[]> = {};
    for (const [c, ys] of Object.entries(byCol)) {
      const sorted = ys.sort((a, b) => a - b);
      const mids = sorted.slice(1).map((y, i) => (y + sorted[i]) / 2 + 7); // sous l'étiquette du nœud du dessus
      out[Number(c)] = [sorted[0] - ROW / 2, ...mids, sorted[sorted.length - 1] + ROW / 2 + 7];
    }
    return out;
  }, [pos]);

  const path = (from: string, to: string) => {
    const a = pos[from], b = pos[to];
    if (!a || !b) return "";
    if (a.col === b.col) {
      // Même couche : arc latéral, à droite.
      const bend = 46 + Math.abs(b.y - a.y) * 0.12;
      return `M${a.x + R} ${a.y} C${a.x + R + bend} ${a.y}, ${b.x + R + bend} ${b.y}, ${b.x + R} ${b.y}`;
    }
    const dir = b.x > a.x ? 1 : -1;
    const pts: [number, number][] = [[a.x + R * dir, a.y]];
    // Une connexion qui saute des couches passe par les couloirs, jamais à travers un nœud.
    for (let c = a.col + dir; c !== b.col; c += dir) {
      const t = (c - a.col) / (b.col - a.col);
      const want = a.y + (b.y - a.y) * t;
      const lane = (lanes[c] ?? [want]).reduce((best, y) => (Math.abs(y - want) < Math.abs(best - want) ? y : best));
      pts.push([X0 + c * COL, lane]);
    }
    pts.push([b.x - R * dir, b.y]);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      const dx = (x2 - x1) * 0.5;
      d += ` C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    }
    return d;
  };

  useImperativeHandle(ref, () => ({
    pulse: (p) => {
      const key = Date.now() + Math.random();
      setPulses((ps) => [...ps.slice(-12), { ...p, key }]);
      setTimeout(() => setPulses((ps) => ps.filter((x) => x.key !== key)), 1800);
    },
  }));

  const on = (kind: "nodes" | "edges", id: string) => !focus || focus[kind].has(id);
  const edgeTarget = (id?: string) => (id ? topology.edges.find((e) => e.id === id)?.to : undefined);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Carte en couches des ressources, chemins et garanties" style={{ display: "block" }}>
      <defs>
        <filter id="nn-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Couches */}
      {LAYERS.map((l, c) => (
        <g key={l.title}>
          <rect x={X0 + c * COL - 62} y={TOP - 6} width={124} height={height - TOP - 10} rx={18} fill="rgba(255,255,255,.018)" stroke="rgba(255,255,255,.05)" />
          <text x={X0 + c * COL} y={TOP - 22} textAnchor="middle" className="nn-layer">{l.title.toUpperCase()}</text>
          <text x={X0 + c * COL} y={TOP - 8} textAnchor="middle" className="nn-layer-n">{c + 1}</text>
        </g>
      ))}

      {/* Connexions */}
      {topology.edges.map((e) => {
        const d = path(e.from, e.to);
        const lit = on("edges", e.id);
        const red = broken && !!focus && lit;
        const color = red ? "#f87171" : e.kind === "bypass" ? "#f87171" : NN_COLOR[e.state];
        return (
          <g key={e.id} opacity={lit ? 1 : 0.07}>
            <path d={d} fill="none" stroke={color} strokeOpacity={focus && lit ? 0.75 : 0.32} strokeWidth={focus && lit ? 2 : 1.4} strokeDasharray={e.kind === "control" ? "2 5" : e.kind === "bypass" ? "7 6" : undefined} className={red ? "nn-blink" : undefined} />
            {e.kind !== "control" && <path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" pathLength={100} className="nn-flow" style={{ animationDelay: `${-((e.id.length * 37) % 30) / 10}s` }} />}
            {focus && lit && e.label && <text className="nn-edge-label"><textPath href={`#nn-${e.id}`} startOffset="50%" textAnchor="middle">{e.label}</textPath></text>}
            <path id={`nn-${e.id}`} d={d} fill="none" stroke="none" />
          </g>
        );
      })}

      {/* Signaux réels */}
      {pulses.map((p) =>
        p.edge && pos[topology.edges.find((e) => e.id === p.edge)?.from ?? ""] ? (
          <path key={`e${p.key}`} d={path(topology.edges.find((e) => e.id === p.edge)!.from, topology.edges.find((e) => e.id === p.edge)!.to)} fill="none" stroke={p.color} strokeWidth={4} strokeLinecap="round" pathLength={100} className="nn-pulse" filter="url(#nn-glow)" />
        ) : null,
      )}

      {/* Neurones */}
      {topology.nodes.map((n) => {
        const p = pos[n.id];
        if (!p) return null;
        const lit = on("nodes", n.id);
        const red = broken && !!focus && lit;
        const color = red ? "#f87171" : NN_COLOR[n.state];
        const pinged = pulses.filter((x) => x.node === n.id || edgeTarget(x.edge) === n.id);
        return (
          <g
            key={n.id}
            transform={`translate(${p.x} ${p.y})`}
            opacity={lit ? 1 : 0.18}
            className="nn-node"
            role="button"
            tabIndex={0}
            aria-label={`${n.label}, ${n.stateLabel ?? n.state}`}
            aria-pressed={selected === n.id}
            onClick={() => onSelect(selected === n.id ? null : n.id)}
            onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), onSelect(selected === n.id ? null : n.id))}
            onMouseEnter={() => onHover(n.id)}
            onMouseLeave={() => onHover(null)}
          >
            {pinged.map((x) => <circle key={x.key} r={R} fill="none" stroke={x.color} strokeWidth={2} className={x.edge ? "nn-ping late" : "nn-ping"} />)}
            <circle r={R + 9} fill={color} opacity={selected === n.id ? 0.22 : 0.08} className={red ? "nn-blink" : undefined} />
            <circle r={R} fill="#07090f" stroke={color} strokeWidth={2} strokeDasharray={n.managed === "outside" ? "3 3" : undefined} />
            <circle r={n.managed === "standard" ? 6 : 4.5} fill={color} filter="url(#nn-glow)" />
            {n.managed === "standard" && <circle r={R + 4} fill="none" stroke={color} strokeOpacity={0.35} />}
            <text y={R + 17} textAnchor="middle" className="nn-label">{n.label}</text>
            <text y={R + 31} textAnchor="middle" className="nn-sub" fill={n.state === "non_couvert" ? "#fca5a5" : n.state === "inconnu" ? "#fcd34d" : undefined}>
              {n.stateLabel ?? { qualifie: "qualifié", observe: "observé", propose: "proposé", inconnu: "inconnu", non_couvert: "non couvert", non_etaye: "non étayé", hors_standard: "hors Standard" }[n.state]}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
