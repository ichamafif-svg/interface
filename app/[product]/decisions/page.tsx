import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { PageHead, SectionTitle } from "@/components/ui";
import { DecisionOptions } from "@/components/actions";
import { ago, hhmm } from "@/lib/format";
import { refHref } from "@/lib/refs";

export const metadata = { title: "À décider" };

const KIND = {
  access: { label: "Accès d'urgence", cls: "n" },
  business: { label: "Métier", cls: "o" },
  irreversible: { label: "Irréversible", cls: "u" },
  rule: { label: "Règle · geste signé", cls: "v" },
} as const;
const TABS = [
  ["", "Toutes"],
  ["business", "Métier"],
  ["irreversible", "Irréversible"],
  ["access", "Accès"],
  ["rule", "Règle"],
] as const;

export default async function Decisions({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { product } = await params;
  const { kind = "" } = await searchParams;
  const data = await unwrap(api().GET("/products/{product}/decisions", { params: { path: { product }, query: { status: "all" } } }));
  const pending = data.items.filter((d) => d.status !== "resolved");
  const shown = pending.filter((d) => !kind || d.kind === kind);
  const resolved = data.items.filter((d) => d.status === "resolved");
  const p = `/${product}`;
  const humans = pending.filter((d) => d.status === "open").length;

  return (
    <main className="page">
      <PageHead kicker={`Décisions · ${humans} pour un humain`} title="Ce qui demande vraiment un humain" intro="Chaque choix est un geste signé, inscrit au journal. Le reste, l'agent le décide seul et vous le montre." />
      <nav className="glass subnav" aria-label="Filtrer par type" style={{ alignSelf: "flex-start" }}>
        {TABS.map(([k, l]) => {
          const n = k ? pending.filter((d) => d.kind === k).length : pending.length;
          return (
            <Link key={k} href={k ? `?kind=${k}` : "?"} className={kind === k ? "on" : undefined}>
              {l} · {n}
            </Link>
          );
        })}
      </nav>
      <div className="row">
        <div className="grow stack" style={{ gap: 14 }}>
          {shown.length === 0 && <div className="glass empty">Rien à décider ici.</div>}
          {shown.map((d) => {
            const k = KIND[d.kind];
            return (
              <article key={d.id} id={d.id} className="glass pad" style={d.kind === "access" ? { borderColor: "rgba(248,113,113,.35)" } : undefined}>
                <div className="between">
                  <div className="flex">
                    <span className={`chip ${k.cls}`}><span className="dot" />{k.label}</span>
                    <span className="muted small">
                      {ago(d.createdAt)}
                      {d.status === "auto_granted" && " · accordé automatiquement, à revoir"}
                      {d.expiresAt && ` · expire à ${hhmm(d.expiresAt)}`}
                    </span>
                  </div>
                  {d.scope && <span className="muted small">{d.scope}</span>}
                </div>
                <h2 style={{ fontSize: 20, marginTop: 12, letterSpacing: "-.01em" }}>{d.title}</h2>
                <p className="muted" style={{ margin: "8px 0 0" }}>{d.context}</p>
                {d.recommendation && (
                  <div className="card" style={{ marginTop: 12, borderColor: "rgba(196,181,253,.25)" }}>
                    <span className="c-agent">{d.recommendation.source === "IA" ? "Recommandation de l'IA" : d.recommendation.source}</span> · {d.recommendation.text}
                  </div>
                )}
                <div style={{ marginTop: 14 }}>
                  <DecisionOptions
                    product={product}
                    decisionId={d.id}
                    options={d.options}
                    extra={d.links?.map((l) => (
                      <Link key={l.kind + l.id} className="btn ghost" href={l.kind === "zone" ? `${p}/zones/${l.id}/dossier` : refHref(product, l)}>
                        {l.kind === "zone" ? "Voir le dossier" : "Voir"}
                      </Link>
                    ))}
                  />
                </div>
              </article>
            );
          })}
        </div>
        <aside className="side stack" style={{ gap: 16 }}>
          <section className="glass pad">
            <SectionTitle>Décidé par l&apos;IA · {data.agentDecided.windowDays} jours</SectionTitle>
            <div style={{ fontSize: 34, fontWeight: 300 }}>{data.agentDecided.total} <span className="muted" style={{ fontSize: 15 }}>décisions, sans vous</span></div>
            <div className="stack" style={{ marginTop: 12, gap: 8 }}>
              {data.agentDecided.breakdown.map((b) => (
                <div key={b.label} className="between"><span>{b.label}</span><span className="mono">{b.count}</span></div>
              ))}
            </div>
            <Link href={`${p}/proofs/timeline?actor=agent`} className="small accent" style={{ display: "inline-block", marginTop: 14 }}>Tout voir dans la chronologie →</Link>
          </section>
          {resolved.length > 0 && (
            <section className="glass pad">
              <SectionTitle>Signées pendant cette session</SectionTitle>
              {resolved.map((d) => <div key={d.id} className="small" style={{ padding: "6px 0" }}>✓ {d.title}</div>)}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
