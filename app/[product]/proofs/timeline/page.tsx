import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { Chip, PageHead, SectionTitle } from "@/components/ui";
import { JournalVerify, ExportButton } from "@/components/actions";
import { dayKey, dayMonth, hhmm, nf } from "@/lib/format";
import { refHref } from "@/lib/refs";
import type { TimelineEntry } from "@/lib/api/types";

export const metadata = { title: "Chronologie" };

type Actor = TimelineEntry["actor"];
const ACTOR: Record<Actor, { mark: string; label: string; color: string }> = {
  human: { mark: "H", label: "Humain", color: "var(--info)" },
  agent: { mark: "IA", label: "Agent", color: "var(--agent)" },
  kernel: { mark: "K", label: "Noyau et juges", color: "var(--ok)" },
  probe: { mark: "S", label: "Sondes et instruments", color: "var(--warn)" },
  change: { mark: "Δ", label: "Changement détecté", color: "var(--warn)" },
  platform: { mark: "P", label: "Plateforme", color: "var(--muted)" },
};
const FILTERS: [Actor | "", string][] = [["", "Tout"], ["human", "Humain"], ["agent", "Agent"], ["kernel", "Noyau"], ["probe", "Sondes"]];
const REF_LABEL: Record<string, string> = { mission: "Voir la mission", decision: "Voir la décision", zone: "Voir la zone", guarantee: "Voir la garantie", candidate: "Voir le candidat", trace: "Voir la trace" };

export default async function Timeline({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<{ actor?: string }> }) {
  const { product } = await params;
  const { actor = "" } = await searchParams;
  const c = api();
  const isActor = (a: string): a is Actor => a in ACTOR;
  const [tl, integrity] = await Promise.all([
    unwrap(c.GET("/products/{product}/timeline", { params: { path: { product }, query: isActor(actor) ? { actor } : {} } })),
    unwrap(c.GET("/products/{product}/journal/integrity", { params: { path: { product } } })),
  ]);
  const days = new Map<string, TimelineEntry[]>();
  for (const e of [...tl.items].sort((a, b) => b.at.localeCompare(a.at))) {
    const k = dayKey(e.at);
    days.set(k, [...(days.get(k) ?? []), e]);
  }

  return (
    <main className="page">
      <PageHead kicker="Chronologie · lecture du journal" title="Tout ce qui s'est passé, et pourquoi" />
      <nav className="glass subnav" aria-label="Filtrer par acteur" style={{ alignSelf: "flex-start" }}>
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={k ? `?actor=${k}` : "?"} className={actor === k ? "on" : undefined}>{l}</Link>
        ))}
      </nav>
      <div className="row">
        <section className="glass pad grow">
          {tl.items.length === 0 && <div className="empty">Aucune entrée pour ce filtre.</div>}
          {[...days.entries()].map(([k, entries]) => (
            <div key={k} style={{ marginBottom: 18 }}>
              <div className="label" style={{ marginBottom: 6 }}>{dayMonth(entries[0].at)}</div>
              {entries.map((e) => {
                const a = ACTOR[e.actor];
                return (
                  <div key={e.id} style={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr)", gap: 14, padding: "12px 0", borderTop: "1px solid var(--line-soft)" }}>
                    <span style={{ width: 32, height: 32, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: a.color, background: "rgba(255,255,255,.05)", border: "1px solid var(--line)" }} title={a.label}>{a.mark}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="between"><b style={{ fontWeight: 500 }}>{e.title}</b><span className="mono muted">{hhmm(e.at)}</span></div>
                      {e.detail && <div className="muted" style={{ marginTop: 4 }}>{e.detail}</div>}
                      <div className="flex" style={{ marginTop: 8 }}>
                        {e.badge && <Chip cls="q" sm>{e.badge}</Chip>}
                        {e.refs?.map((r) => <Link key={r.kind + r.id} href={refHref(product, r)} className="small accent">{REF_LABEL[r.kind] ?? r.id} →</Link>)}
                        <span className="mono muted" style={{ marginLeft: "auto" }}>j#{e.journal.entry} · {e.journal.hash}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
        <aside className="side stack" style={{ gap: 16 }}>
          <section className="glass pad">
            <SectionTitle>Intégrité du journal</SectionTitle>
            <div className="stack" style={{ gap: 8 }}>
              <div className="between"><span>Chaînage</span>{integrity.chained ? <Chip cls="q">Continu</Chip> : <Chip cls="n">Rompu</Chip>}</div>
              <div className="between"><span>Rejeu des deux juges</span>{integrity.replayMatches ? <Chip cls="q">Identique</Chip> : <Chip cls="n">Divergent</Chip>}</div>
              <div className="between"><span>Dernier ancrage</span><span className="mono">{hhmm(integrity.lastAnchor.at)} · j#{integrity.lastAnchor.entry}</span></div>
              <div className="between"><span>Entrées</span><span className="mono">{nf(integrity.entries)}</span></div>
            </div>
            <div className="flex" style={{ marginTop: 14 }}>
              <JournalVerify product={product} />
              <ExportButton product={product} format="siem" label="Exporter" />
            </div>
          </section>
          <section className="glass pad">
            <SectionTitle>Acteurs</SectionTitle>
            {Object.values(ACTOR).map((a) => (
              <div key={a.mark} className="flex" style={{ padding: "5px 0" }}><span className="mono" style={{ color: a.color, width: 22 }}>{a.mark}</span>{a.label}</div>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}
