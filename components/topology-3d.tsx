"use client";
/**
 * Carte 3D du produit, sans dépendance : projection en perspective sur un <canvas>.
 * Trois plans de profondeur : plateforme Standard (devant), produit, hors Standard (derrière).
 * Les impulsions viennent du flux SSE réel (LiveEvent.edge / LiveEvent.node).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LiveEvent, State, Topology, TopologyNode } from "@/lib/api/types";
import { StateChip, Chip } from "@/components/ui";
import { refHref } from "@/lib/refs";

const STATE_COLOR: Record<State, string> = {
  qualifie: "#4ade80",
  observe: "#60a5fa",
  propose: "#d4d4dc",
  inconnu: "#fbbf24",
  non_couvert: "#f87171",
  non_etaye: "#c4b5fd",
  hors_standard: "#7c7c8a",
};
const TONE_COLOR: Record<string, string> = { ok: "#86efac", info: "#93c5fd", warn: "#fcd34d", bad: "#fca5a5", agent: "#c4b5fd" };
const COLUMN: Record<TopologyNode["kind"], number> = {
  client: 0, external: 0, entry: 1, identity: 1, sandbox: 1, service: 2, kernel: 2, datastore: 3, secrets: 3, egress: 3, third_party: 4, cdn: 4,
};
const PLANE: Record<TopologyNode["managed"], { z: number; label: string; color: string }> = {
  standard: { z: -170, label: "Plateforme Standard", color: "129,140,248" },
  product: { z: 0, label: "Produit sous Standard", color: "34,211,238" },
  outside: { z: 170, label: "Hors Standard", color: "255,255,255" },
};
const STATE_LABEL: Record<State, string> = { qualifie: "Qualifié", observe: "Observé", propose: "Proposé", inconnu: "Inconnu", non_couvert: "Non couvert", non_etaye: "Non étayé", hors_standard: "Hors Standard" };
const MANAGED_LABEL: Record<TopologyNode["managed"], string> = { standard: "Plateforme Standard", product: "Code du produit", outside: "Hors Standard" };
const SEV: Record<string, [string, string]> = { high: ["n", "Exposition forte"], medium: ["u", "Exposition moyenne"], low: ["o", "Exposition faible"] };

type P3 = { x: number; y: number; z: number };
type Pulse = { edge?: string; node?: string; t0: number; color: string };

function layout(t: Topology): Record<string, P3> {
  const cols = new Map<number, TopologyNode[]>();
  for (const n of t.nodes) {
    const c = COLUMN[n.kind] ?? 2;
    cols.set(c, [...(cols.get(c) ?? []), n]);
  }
  const pos: Record<string, P3> = {};
  for (const [c, list] of cols) {
    // Au sein d'une colonne : groupé par plan, réparti verticalement.
    const sorted = [...list].sort((a, b) => PLANE[a.managed].z - PLANE[b.managed].z);
    sorted.forEach((n, i) => {
      const lift = { standard: 46, product: 0, outside: -46 }[n.managed];
      const y = (i - (sorted.length - 1) / 2) * 138 + lift;
      pos[n.id] = { x: (c - 2) * 270 + (i % 2) * 34, y, z: PLANE[n.managed].z };
    });
  }
  return pos;
}

export function TopologyView({ product, topology }: { product: string; topology: Topology }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selG, setSelG] = useState<string | null>(null);
  const [simulate, setSimulate] = useState(false);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [feed, setFeed] = useState<LiveEvent[]>([]);
  const ui = useRef({ selNode, selG, simulate, hover: null as string | null });
  ui.current = { selNode, selG, simulate, hover: hover?.id ?? null };
  const pulses = useRef<Pulse[]>([]);
  const pos = useMemo(() => layout(topology), [topology]);
  const nodeById = useMemo(() => Object.fromEntries(topology.nodes.map((n) => [n.id, n])), [topology]);
  const effect = topology.guarantees.find((g) => g.guaranteeId === selG) ?? null;

  // Flux SSE : chaque événement porteur d'une arête ou d'un nœud devient une impulsion.
  useEffect(() => {
    const es = new EventSource(`/api/v1/products/${encodeURIComponent(product)}/live/stream`);
    const on = (m: MessageEvent<string>) => {
      try {
        const e = JSON.parse(m.data) as LiveEvent;
        if (!e.edge && !e.node) return;
        pulses.current.push({ edge: e.edge, node: e.node, t0: performance.now(), color: TONE_COLOR[e.tone ?? "info"] ?? "#93c5fd" });
        setFeed((f) => [e, ...f].slice(0, 6));
      } catch {
        /* ignoré */
      }
    };
    es.onmessage = on;
    ["agent.step", "agent.question", "human.gesture", "precheck.progress", "judge.verdict", "release.progress", "probe.result", "fact.admitted", "refusal"].forEach((t) => es.addEventListener(t, on as EventListener));
    return () => es.close();
  }, [product]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, raf = 0;
    let yaw = -0.3, pitch = 0.42, lastInteract = -1e9;
    let fit = { k: 1, ox: 0, oy: 0 };
    let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
    let projected: Record<string, { x: number; y: number; s: number; z: number }> = {};

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth;
      H = W < 640 ? 440 : 600;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const raw = (p: P3) => {
      const ca = Math.cos(yaw), sa = Math.sin(yaw), cb = Math.cos(pitch), sb = Math.sin(pitch);
      const x1 = p.x * ca + p.z * sa;
      const z1 = -p.x * sa + p.z * ca;
      const y1 = p.y * cb - z1 * sb;
      const z2 = p.y * sb + z1 * cb;
      const s = 1000 / (1000 + z2);
      return { x: x1 * s, y: y1 * s, s, z: z2 };
    };
    // Cadrage automatique : toute la scène tient dans le canvas, quel que soit l'angle.
    const refit = () => {
      const pts = Object.values(pos);
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const bx0 = Math.min(...xs) - 90, bx1 = Math.max(...xs) + 90, by0 = Math.min(...ys) - 70, by1 = Math.max(...ys) + 70;
      const corners: P3[] = [];
      for (const z of [-170, 170]) for (const x of [bx0, bx1]) for (const y of [by0, by1]) corners.push({ x, y, z });
      const r = corners.map(raw);
      const minX = Math.min(...r.map((q) => q.x)), maxX = Math.max(...r.map((q) => q.x));
      const minY = Math.min(...r.map((q) => q.y)), maxY = Math.max(...r.map((q) => q.y));
      const k = Math.min((W - 40) / (maxX - minX), (H - 70) / (maxY - minY));
      fit = { k, ox: W / 2 - ((minX + maxX) / 2) * k, oy: H / 2 + 6 - ((minY + maxY) / 2) * k };
    };
    const project = (p: P3) => {
      const q = raw(p);
      return { x: fit.ox + q.x * fit.k, y: fit.oy + q.y * fit.k, s: q.s * fit.k * 1.7, z: q.z };
    };
    const lerp = (a: P3, b: P3, t: number): P3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

    const frame = (now: number) => {
      const { selNode: sn, selG: sg, simulate: sim, hover: hv } = ui.current;
      const eff = topology.guarantees.find((g) => g.guaranteeId === sg);
      const hiN = new Set<string>(eff?.protects.nodes ?? []);
      const hiE = new Set<string>(eff?.protects.edges ?? []);
      if (sn) {
        hiN.add(sn);
        topology.edges.forEach((e) => {
          if (e.from === sn || e.to === sn) { hiE.add(e.id); hiN.add(e.from); hiN.add(e.to); }
        });
      }
      topology.edges.forEach((e) => { if (hiE.has(e.id)) { hiN.add(e.from); hiN.add(e.to); } });
      const focus = hiN.size > 0 || hiE.size > 0;
      const broken = sim && !!eff;

      if (!drag && !reduce && now - lastInteract > 4000) yaw = -0.3 + Math.sin(now / 9000) * 0.24;
      refit();
      ctx.clearRect(0, 0, W, H);

      // Plans
      const xs = Object.values(pos).map((p) => p.x), ys = Object.values(pos).map((p) => p.y);
      const x0 = Math.min(...xs) - 90, x1 = Math.max(...xs) + 90, y0 = Math.min(...ys) - 70, y1 = Math.max(...ys) + 70;
      for (const [pi, key] of (["outside", "product", "standard"] as const).entries()) {
        const pl = PLANE[key];
        const c = [project({ x: x0, y: y0, z: pl.z }), project({ x: x1, y: y0, z: pl.z }), project({ x: x1, y: y1, z: pl.z }), project({ x: x0, y: y1, z: pl.z })];
        ctx.beginPath();
        c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.fillStyle = `rgba(${pl.color},${key === "outside" ? 0.025 : 0.045})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${pl.color},0.16)`;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(${pl.color},0.55)`;
        ctx.font = "11px Geist, system-ui, sans-serif";
        const lx = Math.min(c[0].x, c[3].x), ly = Math.min(c[0].y, c[1].y);
        ctx.fillText(pl.label.toUpperCase(), Math.max(8, lx + 10), Math.max(14, ly + 16 + pi * 4));
      }

      projected = {};
      for (const n of topology.nodes) projected[n.id] = project(pos[n.id]);

      // Arêtes
      const edges = [...topology.edges].sort((a, b) => (projected[b.from].z + projected[b.to].z) - (projected[a.from].z + projected[a.to].z));
      for (const e of edges) {
        const a = projected[e.from], b = projected[e.to];
        const on = !focus || hiE.has(e.id);
        const red = broken && hiE.has(e.id);
        const col = red ? "#f87171" : STATE_COLOR[e.state];
        ctx.globalAlpha = on ? (red ? 0.6 + 0.4 * Math.sin(now / 180) : 0.75) : 0.08;
        ctx.strokeStyle = col;
        ctx.lineWidth = (on && focus ? 2.2 : 1.3) * Math.min(a.s, b.s) * 0.9;
        if (e.kind === "bypass") ctx.setLineDash([6, 6]);
        else if (e.kind === "control") ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Trafic continu le long des chemins de requête / données / sortie
        if (on && !reduce && e.kind !== "control") {
          const speed = e.kind === "request" ? 2600 : 3800;
          for (let k = 0; k < 2; k++) {
            const t = ((now / speed + k / 2 + (e.id.length % 7) / 7) % 1);
            const p = project(lerp(pos[e.from], pos[e.to], t));
            ctx.globalAlpha = (on ? 0.7 : 0.1) * Math.sin(Math.PI * t);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.8 * p.s, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (on && focus && e.label) {
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = "#a3a3b2";
          ctx.font = "10px Geist, system-ui, sans-serif";
          ctx.fillText(e.label, (a.x + b.x) / 2 + 4, (a.y + b.y) / 2 - 4);
        }
      }
      ctx.globalAlpha = 1;

      // Impulsions SSE
      pulses.current = pulses.current.filter((p) => now - p.t0 < 1600);
      for (const p of pulses.current) {
        const t = (now - p.t0) / 1400;
        if (p.edge) {
          const e = topology.edges.find((x) => x.id === p.edge);
          if (e && t <= 1) {
            for (let k = 0; k < 6; k++) {
              const tt = Math.max(0, t - k * 0.035);
              const q = project(lerp(pos[e.from], pos[e.to], tt));
              ctx.globalAlpha = (1 - k / 6) * 0.95;
              ctx.fillStyle = p.color;
              ctx.shadowColor = p.color;
              ctx.shadowBlur = 16;
              ctx.beginPath();
              ctx.arc(q.x, q.y, (4.2 - k * 0.5) * q.s, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.shadowBlur = 0;
          }
        }
        const target = p.node ?? (p.edge ? topology.edges.find((x) => x.id === p.edge)?.to : undefined);
        if (target && projected[target]) {
          const tt = p.node ? t : Math.max(0, t - 0.75) * 4;
          if (tt > 0 && tt < 1) {
            const q = projected[target];
            ctx.globalAlpha = 1 - tt;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(q.x, q.y, (14 + 26 * tt) * q.s, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // Nœuds, du plus loin au plus proche
      const order = [...topology.nodes].sort((a, b) => projected[b.id].z - projected[a.id].z);
      for (const n of order) {
        const p = projected[n.id];
        const on = !focus || hiN.has(n.id);
        const red = broken && hiN.has(n.id);
        const col = red ? "#f87171" : STATE_COLOR[n.state];
        const r = (n.kind === "entry" || n.kind === "kernel" ? 11 : 9) * p.s;
        ctx.globalAlpha = on ? 1 : 0.15;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2);
        g.addColorStop(0, col + "66");
        g.addColorStop(1, col + "00");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        const body = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
        body.addColorStop(0, "#ffffff");
        body.addColorStop(0.25, col);
        body.addColorStop(1, "#05060a");
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (n.managed === "outside") {
          ctx.strokeStyle = "rgba(255,255,255,.35)";
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (n.id === sn || n.id === hv) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = on ? 0.95 : 0.2;
        ctx.fillStyle = "#ededf2";
        ctx.font = `${Math.round(11 + 2 * (p.s - 0.8))}px Geist, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(n.label, p.x, p.y + r + 15);
        ctx.textAlign = "start";
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const hit = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      let best: string | null = null, bd = 1e9;
      for (const [id, p] of Object.entries(projected)) {
        const d = Math.hypot(p.x - mx, p.y - my);
        if (d < 22 * p.s && d < bd) { bd = d; best = id; }
      }
      return { id: best, mx, my };
    };
    const down = (ev: PointerEvent) => {
      drag = { x: ev.clientX, y: ev.clientY, yaw, pitch };
      canvas.setPointerCapture(ev.pointerId);
    };
    const move = (ev: PointerEvent) => {
      if (drag) {
        yaw = drag.yaw + (ev.clientX - drag.x) / 260;
        pitch = Math.max(-0.2, Math.min(0.9, drag.pitch + (ev.clientY - drag.y) / 300));
        lastInteract = performance.now();
        return;
      }
      const h = hit(ev);
      canvas.style.cursor = h.id ? "pointer" : "grab";
      setHover(h.id ? { id: h.id, x: h.mx, y: h.my } : null);
    };
    const up = (ev: PointerEvent) => {
      const moved = drag && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 4;
      drag = null;
      if (!moved) {
        const h = hit(ev);
        setSelNode(h.id);
      }
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", () => setHover(null));
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
    };
  }, [topology, pos]);

  const node = selNode ? nodeById[selNode] : null;
  const nodeGuarantees = node ? topology.guarantees.filter((g) => g.protects.nodes.includes(node.id) || topology.edges.some((e) => (e.from === node.id || e.to === node.id) && g.protects.edges.includes(e.id))) : [];
  const hovered = hover ? nodeById[hover.id] : null;
  const counts = (["standard", "product", "outside"] as const).map((m) => [m, topology.nodes.filter((n) => n.managed === m).length] as const);

  return (
    <div className="row">
      <section className="glass grow" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
        <div className="between" style={{ padding: "16px 20px 0" }}>
          <div className="label">Release {topology.release} · {topology.nodes.length} ressources · {topology.edges.length} chemins</div>
          <div className="flex small muted">
            {(Object.keys(STATE_COLOR) as State[]).filter((s) => topology.nodes.some((n) => n.state === s)).map((s) => (
              <span key={s} className="flex" style={{ gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: STATE_COLOR[s] }} />{STATE_LABEL[s]}</span>
            ))}
          </div>
        </div>
        <div ref={wrapRef} style={{ position: "relative", touchAction: "none" }}>
          <canvas ref={canvasRef} role="img" aria-label="Carte 3D des ressources, chemins et garanties" style={{ display: "block", cursor: "grab" }} />
          {hovered && hover && (
            <div className="glass small" style={{ position: "absolute", left: Math.min(hover.x + 14, 9999), top: hover.y + 10, padding: "8px 10px", borderRadius: 10, pointerEvents: "none", maxWidth: 260 }}>
              <div style={{ fontWeight: 500 }}>{hovered.label}</div>
              <div className="muted">{MANAGED_LABEL[hovered.managed]} · {hovered.stateLabel ?? STATE_LABEL[hovered.state]}</div>
            </div>
          )}
          <div className="small muted" style={{ position: "absolute", left: 20, bottom: 14 }}>Glisser pour tourner · cliquer un nœud</div>
          <div style={{ position: "absolute", right: 14, bottom: 12, width: 290, display: "flex", flexDirection: "column", gap: 4 }} aria-live="polite">
            {feed.slice(0, 4).map((e, i) => (
              <div key={e.id} className="small" style={{ opacity: 1 - i * 0.22, textAlign: "right", color: TONE_COLOR[e.tone ?? "info"] }}>
                {e.summary}
              </div>
            ))}
          </div>
        </div>
        <div className="flex small muted" style={{ padding: "0 20px 16px", gap: 16 }}>
          {counts.map(([m, c]) => <span key={m}>{MANAGED_LABEL[m]} · {c}</span>)}
          <span>── requête</span><span>┄ contrôle</span><span style={{ color: "var(--bad)" }}>- - contournement</span>
        </div>
      </section>

      <aside className="side stack" style={{ gap: 16 }}>
        <section className="glass pad">
          <div className="label" style={{ marginBottom: 10 }}>Garanties · cliquer pour voir ce qu&apos;elles protègent</div>
          <div className="stack" style={{ gap: 6 }}>
            {topology.guarantees.map((g) => (
              <button
                key={g.guaranteeId}
                type="button"
                onClick={() => { setSelG(selG === g.guaranteeId ? null : g.guaranteeId); setSimulate(false); }}
                className="card"
                style={{ textAlign: "left", cursor: "pointer", font: "inherit", borderColor: selG === g.guaranteeId ? "rgba(165,180,252,.5)" : undefined, background: selG === g.guaranteeId ? "rgba(165,180,252,.08)" : undefined, padding: "9px 12px" }}
                aria-pressed={selG === g.guaranteeId}
              >
                <div className="between" style={{ flexWrap: "nowrap" }}>
                  <span style={{ fontSize: 13 }}>{g.title}</span>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: STATE_COLOR[g.state], flex: "none" }} />
                </div>
              </button>
            ))}
          </div>
        </section>
        {effect && (
          <section className="glass pad" style={{ borderColor: simulate ? "rgba(248,113,113,.45)" : undefined }}>
            <div className="between"><div className="label">Effet de la garantie</div><StateChip state={effect.state} /></div>
            <div style={{ marginTop: 8, fontWeight: 500 }}>{effect.title}</div>
            <div className="small muted" style={{ marginTop: 6 }}>
              Protège {effect.protects.nodes.map((id) => nodeById[id]?.label).filter(Boolean).join(", ") || "—"} · {effect.protects.edges.length} chemin{effect.protects.edges.length > 1 ? "s" : ""}
            </div>
            <div className="card" style={{ marginTop: 12, borderColor: "rgba(248,113,113,.25)" }}>
              <div className="between"><span className="label c-bad">Si elle tombe</span><Chip cls={SEV[effect.severity][0]} sm>{SEV[effect.severity][1]}</Chip></div>
              <div style={{ marginTop: 6 }}>{effect.ifBroken}</div>
            </div>
            <div className="flex" style={{ marginTop: 12 }}>
              <button type="button" className={`btn sm${simulate ? " danger" : ""}`} onClick={() => setSimulate(!simulate)} aria-pressed={simulate}>{simulate ? "Arrêter la simulation" : "Simuler la chute"}</button>
              <Link className="btn sm ghost" href={refHref(product, { kind: "guarantee", id: effect.guaranteeId })}>Chaîne de preuve</Link>
            </div>
          </section>
        )}
        {node && (
          <section className="glass pad">
            <div className="between"><div className="label">{MANAGED_LABEL[node.managed]}</div><StateChip state={node.state} label={node.stateLabel} /></div>
            <div style={{ marginTop: 8, fontSize: 17 }}>{node.label}</div>
            {node.detail && <div className="muted small" style={{ marginTop: 4 }}>{node.detail}</div>}
            {node.metrics && (
              <div className="flex" style={{ gap: 20, marginTop: 12 }}>
                {node.metrics.map((m) => (
                  <div key={m.key}><div className="label">{m.label}</div><div style={{ fontSize: 18, fontWeight: 300 }}>{m.display ?? m.value ?? "—"} <span className="muted small">{m.unit}</span></div></div>
                ))}
              </div>
            )}
            <div className="label" style={{ marginTop: 14, marginBottom: 6 }}>Garanties qui le couvrent</div>
            {nodeGuarantees.length === 0 && <div className="muted small">Aucune : rien n&apos;est prouvé sur ce nœud.</div>}
            {nodeGuarantees.map((g) => (
              <button key={g.guaranteeId} type="button" className="between small" onClick={() => setSelG(g.guaranteeId)} style={{ width: "100%", background: "none", border: 0, color: "inherit", padding: "5px 0", cursor: "pointer", font: "inherit" }}>
                <span>{g.title}</span><span style={{ width: 8, height: 8, borderRadius: "50%", background: STATE_COLOR[g.state] }} />
              </button>
            ))}
            {node.zoneId && <Link className="btn sm" style={{ marginTop: 12 }} href={`/${product}/zones/${node.zoneId}/dossier`}>Ouvrir la zone</Link>}
          </section>
        )}
      </aside>
    </div>
  );
}
