"use client";
/**
 * Page Carte : trois vues sur la même topologie.
 *  - Carte        : le produit de gauche à droite, Standard posé sur les liens (points de contrôle).
 *  - Parcours     : une ligne par usage, lisible comme une phrase.
 *  - Sous le capot: ce qui ne concerne que Standard (plateforme, agent, preuves).
 * Le panneau de droite montre l'effet d'une garantie : ce qu'elle protège, en parcours, et ce qui est exposé si elle tombe.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LiveEvent, State, Topology } from "@/lib/api/types";
import { StateChip, Chip } from "@/components/ui";
import { refHref } from "@/lib/refs";
import { openStream } from "@/lib/stream";
import { ProductMap, STATE_COLOR, type ProductMapApi } from "@/components/product-map";

/** Petit bouclier : marque ce que Standard contrôle. */
function Shield({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="11" height="12" viewBox="0 0 12 13" aria-hidden="true" style={{ flex: "none", verticalAlign: "-1px" }}>
      <path d="M6 0.5 l5.5 2.2 v3.9 c0 3.3-2.4 5.3-5.5 6.2 c-3.1-0.9-5.5-2.9-5.5-6.2 v-3.9 z" fill={color} />
    </svg>
  );
}

type Tab = "map" | "journeys" | "platform";
const TONE_COLOR: Record<string, string> = { ok: "#86efac", info: "#93c5fd", warn: "#fcd34d", bad: "#fca5a5", agent: "#c4b5fd" };
const PLAIN: Record<State, string> = {
  qualifie: "Protégé et prouvé",
  observe: "Observé, pas encore prouvé",
  propose: "À mettre en place",
  inconnu: "Inconnu",
  non_couvert: "Pas protégé",
  non_etaye: "Non étayé",
  hors_standard: "Hors Standard",
};
const SEV: Record<string, [string, string]> = { high: ["n", "Exposition forte"], medium: ["u", "Exposition moyenne"], low: ["o", "Exposition faible"] };
const PLATFORM_ROLE: Record<string, string> = {
  envoy: "Seule porte d'entrée : session, budget d'appels, corps des requêtes, politique.",
  keycloak: "Identité des utilisateurs et contenu de leur jeton.",
  cedar: "Règles métier écrites dans le dépôt : qui peut faire quoi.",
  egress: "Seules sorties possibles vers l'extérieur, sur liste.",
  openbao: "Coffre des secrets : clés, mots de passe, rotation.",
  probes: "Essaient les garanties sur le vrai système, en continu.",
  sandbox: "Où l'agent code : isolé, sans réseau direct, sans secret.",
  kernel: "Admet les changements, publie les releases, tient le journal.",
};

export function TopologyView({ product, topology }: { product: string; topology: Topology }) {
  const [tab, setTab] = useState<Tab>("map");
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selG, setSelG] = useState<string | null>(null);
  const [simulate, setSimulate] = useState(false);
  const [feed, setFeed] = useState<LiveEvent[]>([]);
  const map = useRef<ProductMapApi | null>(null);
  const view = topology.productView;
  const nodeById = useMemo(() => Object.fromEntries(topology.nodes.map((n) => [n.id, n])), [topology]);
  const linkById = useMemo(() => Object.fromEntries(view.links.map((l) => [l.id, l])), [view]);
  const effect = topology.guarantees.find((g) => g.guaranteeId === selG) ?? null;

  /** Liens concernés par une garantie : point de contrôle explicite, ou arête protégée regroupée dans le lien. */
  const linksOf = (gid: string) => {
    const g = topology.guarantees.find((x) => x.guaranteeId === gid);
    return view.links.filter((l) => l.checkpoints.some((c) => c.guaranteeId === gid) || (g && l.edgeIds.some((e) => g.protects.edges.includes(e)))).map((l) => l.id);
  };

  const focus = useMemo(() => {
    if (!effect && !selNode) return null;
    const links = new Set<string>(effect ? linksOf(effect.guaranteeId) : []);
    if (selNode) view.links.forEach((l) => (l.from === selNode || l.to === selNode) && links.add(l.id));
    const nodes = new Set<string>(selNode ? [selNode] : []);
    links.forEach((id) => { nodes.add(linkById[id].from); nodes.add(linkById[id].to); });
    return { nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect, selNode, view, linkById]);

  const journeysOf = (links: Set<string>) => topology.journeys.filter((j) => j.linkIds.some((id) => links.has(id)));

  useEffect(() => {
    const edgeToLink = new Map<string, string>();
    view.links.forEach((l) => l.edgeIds.forEach((e) => edgeToLink.set(e, l.id)));
    const inView = new Set(view.nodes.map((n) => n.id));
    return openStream(`/products/${encodeURIComponent(product)}/live/stream`, (e) => {
      const link = e.edge ? edgeToLink.get(e.edge) : undefined;
      const node = e.node && inView.has(e.node) ? e.node : undefined;
      if (!link && !node) return; // le travail interne de Standard reste dans « Sous le capot » et En direct
      map.current?.pulse({ link, node, color: TONE_COLOR[e.tone ?? "info"] ?? "#93c5fd" });
      setFeed((f) => [e, ...f].slice(0, 4));
    });
  }, [product, view]);

  const node = selNode ? nodeById[selNode] : null;
  const nodeLinks = node ? view.links.filter((l) => l.from === node.id || l.to === node.id) : [];
  const exposed = view.links.filter((l) => l.state === "non_couvert").length;
  const platform = topology.nodes.filter((n) => n.managed === "standard");
  const actsOn = (sid: string) => topology.journeys.filter((j) => j.linkIds.some((id) => linkById[id]?.checkpoints.some((c) => c.standardNodeId === sid)));

  return (
    <div className="row">
      <section className="glass grow" style={{ padding: 0, overflow: "hidden" }}>
        <div className="between" style={{ padding: "14px 20px" }}>
          <nav className="subnav" aria-label="Vue" style={{ background: "rgba(255,255,255,.04)", borderRadius: 12 }}>
            {([["map", "Carte"], ["journeys", "Parcours"], ["platform", "Sous le capot · Standard"]] as const).map(([k, l]) => (
              <button key={k} type="button" className={tab === k ? "on" : undefined} onClick={() => setTab(k)} aria-pressed={tab === k} style={{ border: 0, cursor: "pointer", font: "inherit", height: 30, padding: "0 12px", borderRadius: 9, color: tab === k ? "#fff" : "var(--link)", background: tab === k ? "rgba(255,255,255,.1)" : "transparent" }}>{l}</button>
            ))}
          </nav>
          {tab !== "platform" && (
            <div className="flex small muted" style={{ gap: 14 }}>
              {(["qualifie", "observe", "propose", "inconnu", "non_couvert"] as State[]).map((s) => (
                <span key={s} className="flex" style={{ gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: STATE_COLOR[s] }} />{PLAIN[s]}</span>
              ))}
            </div>
          )}
        </div>

        {tab === "map" && (
          <>
            <div className="small muted" style={{ padding: "0 20px" }}>
              Les cartes sont votre produit. Les badges <Shield /> sur les flèches sont ce que Standard contrôle à cet endroit. {exposed} chemin{exposed > 1 ? "s" : ""} sans protection.
            </div>
            <div className="tablewrap" style={{ padding: "4px 8px 0" }}>
              <div style={{ minWidth: 860 }}>
                <ProductMap ref={map} topology={topology} focus={focus} broken={simulate && !!effect} selected={selNode} onSelectNode={setSelNode} onSelectGuarantee={(g) => { setSelG(g); setSimulate(false); }} />
              </div>
            </div>
            <div className="between small" style={{ padding: "0 20px 16px", alignItems: "flex-end" }}>
              <span className="muted">Pointillés : hors Standard ou chemin bloqué · rouge pointillé : contourne l&apos;entrée</span>
              <div aria-live="polite" style={{ textAlign: "right" }}>
                {feed.slice(0, 2).map((e, i) => <div key={e.id} style={{ opacity: 1 - i * 0.4, color: TONE_COLOR[e.tone ?? "info"] }}>{e.summary}</div>)}
              </div>
            </div>
          </>
        )}

        {tab === "journeys" && (
          <div className="stack" style={{ gap: 10, padding: "0 20px 20px" }}>
            <div className="small muted">Chaque ligne est un usage réel du produit, de qui le fait jusqu&apos;à ce qu&apos;il touche, avec ce que Standard contrôle en chemin.</div>
            {topology.journeys.map((j) => {
              const lit = !focus || j.linkIds.some((id) => focus.links.has(id));
              return (
                <article key={j.id} className="card" style={{ opacity: lit ? 1 : 0.25, borderColor: simulate && effect && lit ? "rgba(248,113,113,.5)" : undefined, display: "grid", gridTemplateColumns: "minmax(170px, 210px) minmax(0, 1fr)", gap: 16, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{j.title}</div>
                    <div className="muted small">{j.who}{j.volume ? ` · ${j.volume}` : ""}</div>
                  </div>
                  <div className="stack" style={{ gap: 8 }}>
                    <div className="flex" style={{ gap: 6 }}>
                      {j.steps.map((sid, i) => {
                        const n = nodeById[sid];
                        const l = i > 0 ? view.links.find((x) => x.from === j.steps[i - 1] && x.to === sid) : undefined;
                        return (
                          <span key={sid + i} className="flex" style={{ gap: 6 }}>
                            {l && (
                              <span className="flex" style={{ gap: 4 }}>
                                <span className="muted">→</span>
                                {l.checkpoints.length === 0 && <span className="journey-check" style={{ color: "var(--muted)", borderColor: "rgba(255,255,255,.15)" }}>sans contrôle</span>}
                                {l.checkpoints.map((c) => (
                                  <button key={c.id} type="button" className="journey-check" title={c.detail} onClick={() => c.guaranteeId && setSelG(c.guaranteeId)} style={{ color: STATE_COLOR[c.state], borderColor: STATE_COLOR[c.state], cursor: c.guaranteeId ? "pointer" : "default" }}><Shield /> {c.short}</button>
                                ))}
                                <span className="muted">→</span>
                              </span>
                            )}
                            <span className="journey-node" style={{ borderStyle: n?.managed === "outside" ? "dashed" : "solid" }}>{n?.label ?? sid}</span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex small"><span style={{ width: 8, height: 8, borderRadius: "50%", background: STATE_COLOR[j.state], flex: "none" }} /><span style={{ color: j.state === "non_couvert" ? "var(--bad)" : j.state === "inconnu" ? "var(--warn)" : "var(--fg)" }}>{j.verdict}</span></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {tab === "platform" && (
          <div style={{ padding: "0 20px 20px" }}>
            <p className="small muted" style={{ marginTop: 0, maxWidth: 720 }}>
              Ce que l&apos;équipe produit n&apos;a pas besoin de manipuler : les composants de Standard, ce qu&apos;ils font, et sur quels parcours ils agissent. Le travail de l&apos;agent se suit en direct.
            </p>
            <div className="grid3">
              {platform.map((n) => {
                const js = actsOn(n.id);
                return (
                  <div key={n.id} className="card">
                    <div className="between"><b style={{ fontWeight: 500 }}>{n.label}</b><StateChip state={n.state} label={n.stateLabel} sm /></div>
                    <div className="muted small" style={{ marginTop: 6 }}>{PLATFORM_ROLE[n.id] ?? n.detail}</div>
                    {js.length > 0 && <div className="small" style={{ marginTop: 8 }}>Agit sur : {js.map((j) => j.title).join(" · ")}</div>}
                    {(n.kind === "sandbox" || n.kind === "kernel") && <Link className="small accent" href={`/${product}/run/live`} style={{ display: "inline-block", marginTop: 8 }}>Voir en direct →</Link>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <aside className="side stack" style={{ gap: 16 }}>
        <section className="glass pad">
          <div className="label" style={{ marginBottom: 10 }}>Garanties · cliquer pour voir ce qu&apos;elles protègent</div>
          <div className="stack" style={{ gap: 6 }}>
            {topology.guarantees.map((g) => (
              <button
                key={g.guaranteeId}
                type="button"
                onClick={() => { setSelG(selG === g.guaranteeId ? null : g.guaranteeId); setSimulate(false); if (tab === "platform") setTab("map"); }}
                className="card"
                style={{ textAlign: "left", cursor: "pointer", font: "inherit", padding: "9px 12px", borderColor: selG === g.guaranteeId ? "rgba(165,180,252,.5)" : undefined, background: selG === g.guaranteeId ? "rgba(165,180,252,.08)" : undefined }}
                aria-pressed={selG === g.guaranteeId}
              >
                <div className="between" style={{ flexWrap: "nowrap" }}>
                  <span style={{ fontSize: 13 }}>{g.title}</span>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: STATE_COLOR[g.state], flex: "none" }} title={PLAIN[g.state]} />
                </div>
              </button>
            ))}
          </div>
        </section>

        {effect && (
          <section className="glass pad" style={{ borderColor: simulate ? "rgba(248,113,113,.45)" : undefined }}>
            <div className="between"><div className="label">Effet de la garantie</div><StateChip state={effect.state} label={PLAIN[effect.state]} /></div>
            <div style={{ marginTop: 8, fontWeight: 500 }}>{effect.title}</div>
            <div className="small" style={{ marginTop: 8 }}>
              <span className="muted">Parcours protégés : </span>
              {journeysOf(new Set(linksOf(effect.guaranteeId))).map((j) => j.title).join(" · ") || "—"}
            </div>
            <div className="card" style={{ marginTop: 12, borderColor: "rgba(248,113,113,.25)" }}>
              <div className="between"><span className="label c-bad">Si elle tombe</span><Chip cls={SEV[effect.severity][0]} sm>{SEV[effect.severity][1]}</Chip></div>
              <div style={{ marginTop: 6 }}>{effect.ifBroken}</div>
            </div>
            <div className="flex" style={{ marginTop: 12 }}>
              <button type="button" className={`btn sm${simulate ? " danger" : ""}`} onClick={() => setSimulate(!simulate)} aria-pressed={simulate}>{simulate ? "Arrêter la simulation" : "Simuler la chute"}</button>
              <Link className="btn sm ghost" href={refHref(product, { kind: "guarantee", id: effect.guaranteeId })}>Chaîne de preuve</Link>
              <button type="button" className="btn sm ghost" onClick={() => { setSelG(null); setSimulate(false); }}>Fermer</button>
            </div>
          </section>
        )}

        {node && (
          <section className="glass pad">
            <div className="between"><div className="label">{view.nodes.find((v) => v.id === node.id)?.role}</div><StateChip state={node.state} label={node.stateLabel} /></div>
            <div style={{ marginTop: 8, fontSize: 17 }}>{node.label}</div>
            {node.detail && <div className="muted small" style={{ marginTop: 4 }}>{node.detail}</div>}
            {node.metrics && (
              <div className="flex" style={{ gap: 20, marginTop: 12 }}>
                {node.metrics.map((m) => <div key={m.key}><div className="label">{m.label}</div><div style={{ fontSize: 18, fontWeight: 300 }}>{m.display ?? m.value ?? "—"} <span className="muted small">{m.unit}</span></div></div>)}
              </div>
            )}
            <div className="label" style={{ marginTop: 14, marginBottom: 6 }}>Ce que Standard contrôle autour</div>
            {nodeLinks.flatMap((l) => l.checkpoints).length === 0 && <div className="muted small">Rien : aucun contrôle Standard sur ses chemins.</div>}
            {nodeLinks.flatMap((l) => l.checkpoints.map((c) => ({ c, l }))).map(({ c, l }) => (
              <div key={c.id} className="small" style={{ padding: "5px 0" }}>
                <span style={{ color: STATE_COLOR[c.state] }}><Shield /> {c.short}</span> <span className="muted">· {nodeById[l.from]?.label} → {nodeById[l.to]?.label}</span>
                <div className="muted">{c.detail}</div>
              </div>
            ))}
            {node.zoneId && <Link className="btn sm" style={{ marginTop: 12 }} href={`/${product}/zones/${node.zoneId}/dossier`}>Ouvrir la zone</Link>}
          </section>
        )}
      </aside>
    </div>
  );
}
