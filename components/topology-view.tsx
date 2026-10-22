"use client";
/**
 * Carte du produit : schéma en couches (components/neural-map.tsx) + panneau garanties / nœud.
 * Les signaux viennent du flux SSE réel (LiveEvent.edge / LiveEvent.node).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LiveEvent, State, Topology, TopologyNode } from "@/lib/api/types";
import { StateChip, Chip } from "@/components/ui";
import { refHref } from "@/lib/refs";
import { openStream } from "@/lib/stream";
import { NeuralMap, NN_COLOR, type NeuralApi } from "@/components/neural-map";

const STATE_COLOR = NN_COLOR;
const TONE_COLOR: Record<string, string> = { ok: "#86efac", info: "#93c5fd", warn: "#fcd34d", bad: "#fca5a5", agent: "#c4b5fd" };
const STATE_LABEL: Record<State, string> = { qualifie: "Qualifié", observe: "Observé", propose: "Proposé", inconnu: "Inconnu", non_couvert: "Non couvert", non_etaye: "Non étayé", hors_standard: "Hors Standard" };
const MANAGED_LABEL: Record<TopologyNode["managed"], string> = { standard: "Plateforme Standard", product: "Code du produit", outside: "Hors Standard" };
const SEV: Record<string, [string, string]> = { high: ["n", "Exposition forte"], medium: ["u", "Exposition moyenne"], low: ["o", "Exposition faible"] };

export function TopologyView({ product, topology }: { product: string; topology: Topology }) {
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selG, setSelG] = useState<string | null>(null);
  const [simulate, setSimulate] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [feed, setFeed] = useState<LiveEvent[]>([]);
  const net = useRef<NeuralApi | null>(null);
  const nodeById = useMemo(() => Object.fromEntries(topology.nodes.map((n) => [n.id, n])), [topology]);
  const effect = topology.guarantees.find((g) => g.guaranteeId === selG) ?? null;

  const focus = useMemo(() => {
    if (!effect && !selNode) return null;
    const nodes = new Set<string>(effect?.protects.nodes ?? []);
    const edges = new Set<string>(effect?.protects.edges ?? []);
    if (selNode) {
      nodes.add(selNode);
      topology.edges.forEach((e) => { if (e.from === selNode || e.to === selNode) edges.add(e.id); });
    }
    topology.edges.forEach((e) => { if (edges.has(e.id)) { nodes.add(e.from); nodes.add(e.to); } });
    return { nodes, edges };
  }, [effect, selNode, topology]);

  useEffect(() => {
    return openStream(`/products/${encodeURIComponent(product)}/live/stream`, (e) => {
      if (!e.edge && !e.node) return;
      net.current?.pulse({ edge: e.edge, node: e.node, color: TONE_COLOR[e.tone ?? "info"] ?? "#93c5fd" });
      setFeed((f) => [e, ...f].slice(0, 5));
    });
  }, [product]);

  const node = selNode ? nodeById[selNode] : null;
  const nodeGuarantees = node ? topology.guarantees.filter((g) => g.protects.nodes.includes(node.id) || topology.edges.some((e) => (e.from === node.id || e.to === node.id) && g.protects.edges.includes(e.id))) : [];
  const hovered = hover ? nodeById[hover] : null;
  const counts = (["standard", "product", "outside"] as const).map((m) => [m, topology.nodes.filter((n) => n.managed === m).length] as const);

  return (
    <div className="row">
      <section className="glass grow" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
        <div className="between" style={{ padding: "16px 20px 0" }}>
          <div className="label">Release {topology.release} · {topology.nodes.length} ressources · {topology.edges.length} chemins · {topology.guarantees.filter((g) => g.state === "qualifie").length}/{topology.guarantees.length} garanties qualifiées</div>
          <div className="flex small muted">
            {(Object.keys(STATE_COLOR) as State[]).filter((st) => topology.nodes.some((n) => n.state === st)).map((st) => (
              <span key={st} className="flex" style={{ gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: STATE_COLOR[st] }} />{STATE_LABEL[st]}</span>
            ))}
          </div>
        </div>
        <div className="tablewrap" style={{ padding: "6px 8px 0" }}>
          <div style={{ minWidth: 760 }}>
            <NeuralMap ref={net} topology={topology} focus={focus} broken={simulate && !!effect} selected={selNode} onSelect={setSelNode} onHover={setHover} />
          </div>
        </div>
        {hovered && (
          <div className="glass small" style={{ position: "absolute", top: 52, right: 20, padding: "8px 12px", borderRadius: 10, pointerEvents: "none" }}>
            <div style={{ fontWeight: 500 }}>{hovered.label}</div>
            <div className="muted">{MANAGED_LABEL[hovered.managed]} · {hovered.stateLabel ?? STATE_LABEL[hovered.state]}</div>
          </div>
        )}
        <div className="between small" style={{ padding: "4px 20px 16px", alignItems: "flex-end" }}>
          <div className="flex muted" style={{ gap: 14 }}>
            <span className="flex" style={{ gap: 6 }}><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="#d4d4dc" /><circle cx="7" cy="7" r="6.5" fill="none" stroke="#d4d4dc" strokeOpacity=".4" /></svg>Plateforme Standard · {counts[0][1]}</span>
            <span className="flex" style={{ gap: 6 }}><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="#d4d4dc" /></svg>Produit · {counts[1][1]}</span>
            <span className="flex" style={{ gap: 6 }}><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="#d4d4dc" strokeDasharray="2 2" /></svg>Hors Standard · {counts[2][1]}</span>
            <span>┄ contrôle</span><span className="c-bad">- - contournement</span>
          </div>
          <div aria-live="polite" style={{ textAlign: "right", minWidth: 260 }}>
            {feed.slice(0, 3).map((e, i) => (
              <div key={e.id} style={{ opacity: 1 - i * 0.3, color: TONE_COLOR[e.tone ?? "info"] }}>{e.summary}</div>
            ))}
          </div>
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
