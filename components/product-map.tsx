"use client";
/**
 * Carte produit : quatre colonnes lues de gauche à droite (qui arrive → ce qui répond → ce qui est stocké → hors de chez vous).
 * Seuls les éléments du produit sont des nœuds. Standard apparaît là où il agit : un point de contrôle posé sur le lien.
 */
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import type { State, Topology } from "@/lib/api/types";

export const STATE_COLOR: Record<State, string> = {
  qualifie: "#4ade80",
  observe: "#60a5fa",
  propose: "#d4d4dc",
  inconnu: "#fbbf24",
  non_couvert: "#f87171",
  non_etaye: "#c4b5fd",
  hors_standard: "#7c7c8a",
};
export const COLUMNS = [
  { id: "actor", title: "Qui arrive" },
  { id: "service", title: "Ce qui répond" },
  { id: "data", title: "Ce qui est stocké" },
  { id: "outside", title: "Hors de chez vous" },
] as const;

const W = 1180, CW = 178, CH = 58, ROW = 118, TOP = 70;
const CX = [112, 432, 752, 1066];

type Pt = [number, number];
type Route = { d: string; at: (t: number) => Pt; anchor: Pt };
export type ProductMapApi = { pulse: (p: { link?: string; node?: string; color: string }) => void };

function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, u: number): Pt {
  const v = 1 - u;
  return [
    v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
  ];
}

export const ProductMap = forwardRef<
  ProductMapApi,
  {
    topology: Topology;
    focus: { nodes: Set<string>; links: Set<string> } | null;
    broken: boolean;
    selected: string | null;
    onSelectNode: (id: string | null) => void;
    onSelectGuarantee: (id: string) => void;
  }
>(function ProductMap({ topology, focus, broken, selected, onSelectNode, onSelectGuarantee }, ref) {
  const view = topology.productView;
  const byId = useMemo(() => Object.fromEntries(topology.nodes.map((n) => [n.id, n])), [topology]);
  const [pulses, setPulses] = useState<{ key: number; link?: string; node?: string; color: string }[]>([]);

  const { pos, height, lanes, cards } = useMemo(() => {
    // Position verticale : `row` fourni par le backend, sinon ordre d'arrivée.
    const rowOf = (n: { row?: number }, i: number) => n.row ?? i;
    const cols = COLUMNS.map((c) => view.nodes.filter((n) => n.column === c.id).map((n, i) => ({ ...n, r: rowOf(n, i) })));
    const all = cols.flat();
    const minRow = Math.min(...all.map((n) => n.r)), maxRow = Math.max(...all.map((n) => n.r));
    const y = (r: number) => TOP + CH / 2 + 8 + (r - minRow) * ROW;
    const height = y(maxRow) + CH / 2 + 24;
    const pos: Record<string, { x: number; y: number; col: number }> = {};
    const lanes: number[][] = [];
    cols.forEach((list, c) => {
      const ys = list.map((n) => y(n.r)).sort((a, b) => a - b);
      list.forEach((n) => (pos[n.id] = { x: CX[c], y: y(n.r), col: c }));
      // Couloirs libres : au-dessus, entre les cartes, en dessous, et la ligne du haut si elle est vide.
      const free = ys.length ? [ys[0] - ROW / 2, ...ys.slice(1).map((v, i) => (v + ys[i]) / 2), ys[ys.length - 1] + ROW / 2] : [];
      if (!ys.some((v) => Math.abs(v - y(minRow)) < CH)) free.push(y(minRow));
      lanes[c] = free.length ? free : [height / 2];
    });
    const cards = Object.values(pos).map((p) => ({ x0: p.x - CW / 2, x1: p.x + CW / 2, y0: p.y - CH / 2, y1: p.y + CH / 2 }));
    return { pos, height, lanes, cards };
  }, [view]);

  const routes = useMemo(() => {
    const out: Record<string, Route> = {};
    for (const l of view.links) {
      const a = pos[l.from], b = pos[l.to];
      if (!a || !b) continue;
      const pts: Pt[] = [[a.x + CW / 2, a.y]];
      for (let c = a.col + 1; c < b.col; c++) {
        const want = b.y; // rejoindre tout de suite la hauteur de la cible, puis aller droit
        const lane = lanes[c].reduce((best, y) => (Math.abs(y - want) < Math.abs(best - want) ? y : best));
        pts.push([CX[c] - CW / 2 - 10, lane], [CX[c] + CW / 2 + 10, lane]);
      }
      pts.push([b.x - CW / 2, b.y]);
      const segs: [Pt, Pt, Pt, Pt][] = [];
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1], p3 = pts[i];
        const dx = (p3[0] - p0[0]) * 0.5;
        segs.push([p0, [p0[0] + dx, p0[1]], [p3[0] - dx, p3[1]], p3]);
      }
      const d = segs.map((s, i) => `${i ? "" : `M${s[0][0]} ${s[0][1]} `}C${s[1][0]} ${s[1][1]}, ${s[2][0]} ${s[2][1]}, ${s[3][0]} ${s[3][1]}`).join(" ");
      const lens = segs.map((s) => Math.hypot(s[3][0] - s[0][0], s[3][1] - s[0][1]));
      const total = lens.reduce((x, y) => x + y, 0);
      out[l.id] = {
        d,
        // Entrées et contournements : contrôle côté départ. Données et sorties : contrôle juste avant la destination.
        anchor: bez(...(l.kind === "request" && b.col - a.col < 2 || l.kind === "bypass" ? segs[0] : segs[segs.length - 1]), 0.5),
        at: (t) => {
          let r = t * total;
          for (let i = 0; i < segs.length; i++) {
            if (r <= lens[i] || i === segs.length - 1) return bez(...segs[i], Math.min(1, r / lens[i]));
            r -= lens[i];
          }
          return segs[0][0];
        },
      };
    }
    return out;
  }, [view, pos, lanes]);

  useImperativeHandle(ref, () => ({
    pulse: (p) => {
      const key = Date.now() + Math.random();
      setPulses((ps) => [...ps.slice(-10), { ...p, key }]);
      setTimeout(() => setPulses((ps) => ps.filter((x) => x.key !== key)), 1800);
    },
  }));

  // Badges : empilés au milieu du premier tronçon, puis écartés s'ils se chevauchent ou touchent une carte.
  const badges = useMemo(() => {
    type B = { l: (typeof view.links)[number]; c: (typeof view.links)[number]["checkpoints"][number]; x: number; y: number; w: number };
    const list: B[] = [];
    for (const l of view.links) {
      const r = routes[l.id];
      if (!r) continue;
      l.checkpoints.forEach((c, i) => {
        list.push({ l, c, x: r.anchor[0], y: r.anchor[1] + (i - (l.checkpoints.length - 1) / 2) * 26, w: c.short.length * 6.6 + 30 });
      });
    }
    for (let it = 0; it < 60; it++) {
      let moved = false;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const A = list[i], B = list[j];
          const ox = (A.w + B.w) / 2 + 6 - Math.abs(A.x - B.x), oy = 26 - Math.abs(A.y - B.y);
          if (ox > 0 && oy > 0) {
            const push = oy / 2 + 0.5, dir = A.y <= B.y ? -1 : 1;
            A.y += dir * push;
            B.y -= dir * push;
            moved = true;
          }
        }
        const A = list[i];
        for (const k of cards) {
          if (A.x + A.w / 2 > k.x0 - 4 && A.x - A.w / 2 < k.x1 + 4 && A.y + 11 > k.y0 - 4 && A.y - 11 < k.y1 + 4) {
            A.y = A.y < (k.y0 + k.y1) / 2 ? k.y0 - 16 : k.y1 + 16;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    return list;
  }, [view, routes, cards]);

  const litLink = (id: string) => !focus || focus.links.has(id);
  const litNode = (id: string) => !focus || focus.nodes.has(id);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Carte du produit : qui arrive, ce qui répond, ce qui est stocké, et ce que Standard contrôle sur chaque chemin" style={{ display: "block" }}>
      <defs>
        <filter id="pm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="pm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
        </marker>
      </defs>

      {COLUMNS.map((c, i) => (
        <g key={c.id}>
          <text x={CX[i]} y={34} textAnchor="middle" className="pm-col">{c.title}</text>
          <line x1={CX[i] - CW / 2} x2={CX[i] + CW / 2} y1={46} y2={46} stroke="rgba(255,255,255,.08)" />
          {i < COLUMNS.length - 1 && <text x={(CX[i] + CX[i + 1]) / 2} y={38} textAnchor="middle" className="pm-arrow-h">→</text>}
        </g>
      ))}

      {/* Liens */}
      {view.links.map((l) => {
        const r = routes[l.id];
        if (!r) return null;
        const lit = litLink(l.id);
        const red = broken && !!focus && lit;
        const color = red || l.kind === "bypass" ? "#f87171" : STATE_COLOR[l.state];
        return (
          <g key={l.id} opacity={lit ? 1 : 0.1} className="pm-link">
            <path d={r.d} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={focus && lit ? 2.6 : 1.8} strokeDasharray={l.kind === "bypass" || l.blocked ? "7 6" : undefined} markerEnd="url(#pm-arrow)" className={red ? "nn-blink" : undefined} />
            {!l.blocked && <path d={r.d} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" pathLength={100} className="nn-flow" style={{ animationDelay: `${-((l.id.length * 37) % 30) / 10}s` }} />}
          </g>
        );
      })}

      {pulses.map((p) => (p.link && routes[p.link] ? <path key={p.key} d={routes[p.link].d} fill="none" stroke={p.color} strokeWidth={4} strokeLinecap="round" pathLength={100} className="nn-pulse" filter="url(#pm-glow)" /> : null))}

      {/* Points de contrôle Standard, posés sur les liens (entre deux colonnes, jamais sur une carte) */}
      {badges.map(({ l, c, x, y, w }) => {
        const lit = litLink(l.id);
        const color = broken && !!focus && lit ? "#f87171" : STATE_COLOR[c.state];
        return (
          <g
            key={c.id}
            transform={`translate(${x - w / 2} ${y - 11})`}
            opacity={lit ? 1 : 0.12}
            className={c.guaranteeId ? "pm-check click" : "pm-check"}
            onClick={() => c.guaranteeId && onSelectGuarantee(c.guaranteeId)}
            role={c.guaranteeId ? "button" : undefined}
            tabIndex={c.guaranteeId ? 0 : undefined}
            aria-label={`${c.short} : ${c.detail}`}
            onKeyDown={(ev) => c.guaranteeId && (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), onSelectGuarantee(c.guaranteeId))}
          >
            <title>{`Standard · ${c.short} — ${c.detail}`}</title>
            <rect width={w} height={22} rx={11} fill="#0b0d14" stroke={color} strokeWidth={1.2} />
            <path d="M12 5 l6 2.4 v4.2 c0 3.6-2.6 5.8-6 6.8 c-3.4-1-6-3.2-6-6.8 v-4.2 z" fill={color} fillOpacity={0.9} transform="translate(0 -0.5) scale(0.95)" />
            <text x={24} y={15} className="pm-check-text" fill={color}>{c.short}</text>
          </g>
        );
      })}

      {/* Nœuds du produit */}
      {view.nodes.map((vn) => {
        const n = byId[vn.id];
        const p = pos[vn.id];
        if (!n || !p) return null;
        const lit = litNode(n.id);
        const red = broken && !!focus && lit;
        const color = red ? "#f87171" : STATE_COLOR[n.state];
        const pinged = pulses.some((x) => x.node === n.id);
        return (
          <g
            key={n.id}
            transform={`translate(${p.x - CW / 2} ${p.y - CH / 2})`}
            opacity={lit ? 1 : 0.2}
            className="pm-node"
            role="button"
            tabIndex={0}
            aria-pressed={selected === n.id}
            aria-label={`${n.label}, ${vn.role ?? ""}`}
            onClick={() => onSelectNode(selected === n.id ? null : n.id)}
            onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), onSelectNode(selected === n.id ? null : n.id))}
          >
            <rect width={CW} height={CH} rx={14} fill={selected === n.id ? "#141826" : "#0c0f17"} stroke={selected === n.id ? "#ffffff" : color} strokeOpacity={selected === n.id ? 0.9 : 0.55} strokeWidth={1.3} strokeDasharray={n.managed === "outside" ? "4 4" : undefined} className={red ? "nn-blink" : undefined} />
            {pinged && <rect width={CW} height={CH} rx={14} fill="none" stroke="#ffffff" className="pm-ping" />}
            <circle cx={18} cy={CH / 2} r={5} fill={color} filter="url(#pm-glow)" />
            <text x={32} y={25} className="pm-node-label">{n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label}</text>
            <text x={32} y={42} className="pm-node-role">{vn.role}{n.managed === "outside" ? " · hors Standard" : ""}</text>
          </g>
        );
      })}
    </svg>
  );
});
