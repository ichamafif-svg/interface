import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { Chip, PageHead, SectionTitle, StateChip } from "@/components/ui";
import { refHref } from "@/lib/refs";

export const metadata = { title: "Comprendre · Dossier" };

export default async function Dossier({ params }: { params: Promise<{ product: string; zone: string }> }) {
  const { product, zone } = await params;
  const d = await unwrap(api().GET("/products/{product}/zones/{zone}/dossier", { params: { path: { product, zone } } }));
  const linked = d.links.map((l) => ({ r: d.resources.find((x) => x.id === l.resourceId), o: d.operations.find((x) => x.id === l.operationId) }));

  return (
    <main className="page">
      <PageHead
        kicker={`Dossier produit · snapshot ${d.commit}`}
        title="Deux cartes, un seul produit"
        right={<><StateChip state="qualifie" /><StateChip state="observe" /><StateChip state="propose" label="Suggestion IA" /><StateChip state="inconnu" /><StateChip state="non_couvert" /></>}
      />
      <div className="row">
        <section className="glass pad" style={{ flex: "1 1 380px", minWidth: 0 }}>
          <SectionTitle right={<span className="mono muted">{d.resources.length}</span>}>Ressources et chemins</SectionTitle>
          {d.resources.map((r, i) => (
            <div key={r.id} className="between" style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
              <div style={{ minWidth: 0 }}><div className={r.mono ? "mono" : undefined} style={r.mono ? { fontSize: 13 } : undefined}>{r.name}</div><div className="muted small">{r.detail}</div></div>
              <StateChip state={r.state} label={r.stateLabel} />
            </div>
          ))}
        </section>
        <section className="glass pad" style={{ flex: "1 1 380px", minWidth: 0 }}>
          <SectionTitle right={<span className="mono muted">{d.operations.length}</span>}>Opérations et règles métier</SectionTitle>
          {d.operations.map((o, i) => (
            <div key={o.id} className="between" style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
              <div style={{ minWidth: 0 }}><div className="mono" style={{ fontSize: 13 }}>{o.name}</div><div className="muted small">{o.rule}</div></div>
              <StateChip state={o.state} label={o.stateLabel} />
            </div>
          ))}
          {linked.map(({ r, o }) => r && o && (
            <div key={r.id + o.id} className="card mono" style={{ marginTop: 12, textAlign: "center" }}>{r.name} <span className="accent">⟷</span> {o.name}</div>
          ))}
        </section>
        <aside className="side stack" style={{ gap: 16, flexBasis: 320 }}>
          <section className="glass pad">
            <SectionTitle right={<span className="mono muted">{d.businessQuestions.length}</span>}>Décisions métier</SectionTitle>
            {d.businessQuestions.map((q, i) => (
              <div key={q.title} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
                <div style={{ fontWeight: 500 }}>{q.title}</div>
                {q.detail && <div className="muted small">{q.detail}</div>}
                {q.decisionId && <Link href={refHref(product, { kind: "decision", id: q.decisionId })} className="btn sm" style={{ marginTop: 8 }}>Trancher</Link>}
              </div>
            ))}
          </section>
          <section className="glass pad">
            <SectionTitle>Sécurisation technique</SectionTitle>
            {d.securityRequests.map((s) => (
              <div key={s.title} className="between" style={{ padding: "7px 0" }}>
                <span>{s.title}</span>
                <Chip cls={s.severity === "blocking" ? "n" : "u"} sm>{s.severity === "blocking" ? "Bloquant" : "Ouvert"}</Chip>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}
