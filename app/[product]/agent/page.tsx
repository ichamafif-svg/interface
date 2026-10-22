import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { Chip, Diff, PageHead, SectionTitle } from "@/components/ui";
import { MissionReply, NewMission } from "@/components/actions";
import { ago, nf } from "@/lib/format";
import { refHref } from "@/lib/refs";

export const metadata = { title: "Agent · Construire" };

const STATUS: Record<string, { cls: string; label: string }> = {
  running: { cls: "v", label: "En cours" },
  awaiting_decision: { cls: "u", label: "Décision attendue" },
  admitted: { cls: "q", label: "Admis" },
  refused: { cls: "n", label: "Refusé" },
  released: { cls: "q", label: "En production" },
};
const KIND: Record<string, string> = { feature: "Nouvelle fonctionnalité", cve: "CVE", upgrade: "Montée de version", bugfix: "Correction", removal: "Retrait d'ancien code", extractor: "Extracteur" };
const STEP: Record<string, { icon: string; bg: string; fg: string }> = {
  done: { icon: "✓", bg: "rgba(74,222,128,.14)", fg: "var(--ok)" },
  warning: { icon: "!", bg: "rgba(251,191,36,.14)", fg: "var(--warn)" },
  running: { icon: "●", bg: "rgba(165,180,252,.14)", fg: "var(--accent)" },
  pending: { icon: "", bg: "rgba(255,255,255,.05)", fg: "var(--muted)" },
};

export default async function AgentPage({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<{ mission?: string }> }) {
  const { product } = await params;
  const { mission: wanted } = await searchParams;
  const c = api();
  const [list, zones] = await Promise.all([
    unwrap(c.GET("/products/{product}/missions", { params: { path: { product } } })),
    unwrap(c.GET("/products/{product}/zones", { params: { path: { product } } })),
  ]);
  const pick = list.items.find((m) => m.id === wanted) ?? list.items.find((m) => m.status === "awaiting_decision") ?? list.items[0];
  const m = pick ? await unwrap(c.GET("/products/{product}/missions/{mission}", { params: { path: { product, mission: pick.id } } })) : null;
  const zoneName = (id: string) => zones.items.find((z) => z.id === id)?.name ?? id;
  const lastAgent = m ? [...m.messages].reverse().find((x) => x.role === "agent") : undefined;

  return (
    <main className="page">
      {m ? (
        <PageHead
          kicker={`Mission ${m.id} · ${m.model}${m.external ? " · agent externe" : ""}`}
          title={m.title}
          intro={`${KIND[m.kind] ?? m.kind} · zone ${zoneName(m.zoneId)} · démarrée ${ago(m.startedAt)}`}
          right={<Chip cls={STATUS[m.status].cls}>{STATUS[m.status].label}</Chip>}
        />
      ) : (
        <PageHead kicker="Agent" title="Aucune mission" />
      )}
      <div className="row">
        <aside className="stack" style={{ flex: "1 1 260px", maxWidth: 320, gap: 16 }}>
          <section className="glass pad">
            <SectionTitle>Nouvelle mission</SectionTitle>
            <NewMission product={product} zones={zones.items.map((z) => ({ id: z.id, name: z.name }))} />
          </section>
          <section className="glass" style={{ paddingBottom: 6 }}>
            <div className="pad" style={{ paddingBottom: 6 }}><SectionTitle>Missions</SectionTitle></div>
            {list.items.map((x) => (
              <Link key={x.id} href={`?mission=${x.id}`} style={{ display: "block", padding: "10px 22px", borderTop: "1px solid var(--line-soft)", background: x.id === m?.id ? "rgba(165,180,252,.07)" : undefined, color: "var(--fg)" }}>
                <div className="between"><span className="mono accent">{x.id}</span><Chip cls={STATUS[x.status].cls} sm>{STATUS[x.status].label}</Chip></div>
                <div className="small" style={{ marginTop: 4 }}>{x.title}</div>
              </Link>
            ))}
          </section>
        </aside>

        {m && (
          <section className="glass pad" style={{ flex: "999 1 480px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {m.messages.length === 0 && <div className="empty">Pas de conversation pour cette mission.</div>}
            {m.messages.map((msg) => (
              <div key={msg.id} className={`msg ${msg.role}`}>
                {msg.role === "agent" && <div className="label c-agent" style={{ marginBottom: 6 }}>IA</div>}
                {msg.text}
                {msg.question && <div className="question">{msg.question}</div>}
              </div>
            ))}
            <div style={{ marginTop: "auto", paddingTop: 8 }}>
              <MissionReply product={product} missionId={m.id} actions={m.status === "awaiting_decision" ? lastAgent?.actions : undefined} />
            </div>
          </section>
        )}

        {m && (
          <aside className="glass pad" style={{ flex: "1 1 340px", minWidth: 0 }}>
            <SectionTitle right={<span className="mono muted">{m.branch}</span>}>Plan de livraison</SectionTitle>
            <div className="stack" style={{ gap: 0 }}>
              {m.plan.map((s, i) => {
                const st = STEP[s.status] ?? STEP.pending;
                return (
                  <div key={s.key} style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 12, padding: "11px 0", borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, background: st.bg, color: st.fg }}>{st.icon || i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{s.label}</div>
                      {s.detail && <div className="muted small" style={{ marginTop: 2 }}>{s.detail}</div>}
                      {s.code && <div style={{ marginTop: 8 }}><Diff text={s.code} wrap /></div>}
                      {s.link && <Link href={refHref(product, s.link)} className="small accent" style={{ display: "inline-block", marginTop: 6 }}>{s.link.kind === "zone" ? "Voir la vérification" : "Ouvrir"} →</Link>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="between sep small muted" style={{ paddingTop: 12, marginTop: 4 }}>
              <span>Coût de la mission : {m.costEur != null ? `${nf(m.costEur, 2)} €` : "—"}</span>
              <span>Temps agent : {m.agentMinutes != null ? `${m.agentMinutes} min` : "—"}</span>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
