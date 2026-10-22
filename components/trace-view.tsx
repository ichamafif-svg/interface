import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { PageHead, SectionTitle } from "@/components/ui";
import { dayMonth, hhmmss } from "@/lib/format";
import { refHref } from "@/lib/refs";

const STAGE_LABEL: Record<string, string> = { policy: "politique", budget: "budget", egress: "sortie", data: "données", entry: "entrée", sandbox: "bac" };

export async function TraceView({ product, traceId }: { product: string; traceId?: string }) {
  const c = api();
  const refusals = await unwrap(c.GET("/products/{product}/refusals", { params: { path: { product }, query: { windowHours: 24 } } }));
  const id = traceId ?? refusals.items.find((r) => r.sampleTrace)?.sampleTrace;
  const t = id ? await unwrap(c.GET("/products/{product}/traces/{trace}", { params: { path: { product, trace: id } } })) : null;
  const p = `/${product}`;

  return (
    <main className="page">
      {t ? (
        <PageHead
          kicker={`Pourquoi refusé ? · trace ${t.id}`}
          title={<span className="mono" style={{ fontSize: "inherit" }}>{t.request.method} {t.request.path} <span className={t.verdict === "refused" ? "c-bad" : "c-ok"}>→ {t.request.status}</span></span>}
          intro={`${dayMonth(t.at)} ${hhmmss(t.at)} · ${t.subject} (pseudonymisé) · release ${t.release}`}
        />
      ) : (
        <PageHead kicker="Pourquoi refusé ?" title="Aucun refus récent" />
      )}
      <div className="row">
        {t && (
          <section className="glass pad grow">
            <SectionTitle>Le trajet de la requête</SectionTitle>
            <div className="stack" style={{ gap: 0 }}>
              {t.hops.map((h, i) => {
                const refused = h.outcome === "refused";
                const skipped = h.outcome === "not_reached";
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr)", gap: 14, padding: "14px 0", borderTop: i ? "1px solid var(--line-soft)" : undefined, opacity: skipped ? 0.5 : 1 }}>
                    <span style={{ width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: refused ? "rgba(248,113,113,.14)" : skipped ? "transparent" : "rgba(74,222,128,.14)", color: refused ? "var(--bad)" : skipped ? "var(--muted)" : "var(--ok)", border: skipped ? "1px solid rgba(255,255,255,.2)" : undefined }}>
                      {refused ? "✕" : skipped ? "·" : "✓"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="between">
                        <b style={{ fontWeight: 500 }}>{h.label}</b>
                        {refused ? <span className="chip n"><span className="dot" />Refusé ici</span> : h.durationMs != null ? <span className="mono muted">{h.durationMs} ms</span> : skipped ? <span className="muted small">Non atteint</span> : null}
                      </div>
                      {h.detail && <div className="muted" style={{ marginTop: 4 }}>{h.detail}</div>}
                      {h.rule && (
                        <div style={{ marginTop: 10 }}>
                          <div className="mono accent" style={{ marginBottom: 6 }}>{h.rule.file}:{h.rule.line} · {h.rule.version}</div>
                          <pre className="code">
                            {h.rule.source.split("\n").map((l, k) => (
                              <div key={k}>
                                {h.rule!.failingClause && l.includes(h.rule!.failingClause) ? (
                                  <>
                                    {l.slice(0, l.indexOf(h.rule!.failingClause))}
                                    <span className="c-bad" style={{ textDecoration: "underline wavy" }}>{h.rule!.failingClause}</span>
                                    {l.slice(l.indexOf(h.rule!.failingClause) + h.rule!.failingClause.length)}
                                    <span className="c-bad"> ← faux</span>
                                  </>
                                ) : l}
                              </div>
                            ))}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="sep" style={{ paddingTop: 16, marginTop: 4 }}>
              <div className="label" style={{ marginBottom: 10 }}>Ce refus est-il normal ?</div>
              <div className="flex">
                <Link className="btn" href={`${p}/proofs/timeline`}>Oui, comportement attendu</Link>
                <Link className="btn" href={`${p}/decisions`}>Non, ouvrir une décision</Link>
                <Link className="btn" href={`${p}/agent`}>Demander à l&apos;agent</Link>
              </div>
            </div>
          </section>
        )}
        <div className="side stack" style={{ gap: 16 }}>
          {t?.cli && (
            <section className="glass pad">
              <SectionTitle>Depuis votre terminal</SectionTitle>
              <pre className="code wrap">
                <span className="muted">$ </span>standard why {t.id}{"\n"}
                {t.cli}
                {"\n\n"}<span className="muted">$ </span>standard dev{"\n"}
                <span className="c-ok">plateforme locale prête · mêmes images, mêmes refus</span>
              </pre>
            </section>
          )}
          <section className="glass" style={{ paddingBottom: 6 }}>
            <div className="pad" style={{ paddingBottom: 6 }}><SectionTitle>Refus récents · {refusals.windowHours} h</SectionTitle></div>
            {refusals.items.map((r) => {
              const inner = (
                <>
                  <span className="mono" style={{ color: "var(--fg)" }}>{r.route}</span>
                  <span className="muted small">{STAGE_LABEL[r.stage] ?? r.stage} · {r.count}</span>
                </>
              );
              return r.sampleTrace ? (
                <Link key={r.route} href={refHref(product, { kind: "trace", id: r.sampleTrace })} className="between" style={{ padding: "10px 22px", borderTop: "1px solid var(--line-soft)", background: r.sampleTrace === t?.id ? "rgba(165,180,252,.06)" : undefined }}>{inner}</Link>
              ) : (
                <div key={r.route} className="between" style={{ padding: "10px 22px", borderTop: "1px solid var(--line-soft)" }}>{inner}</div>
              );
            })}
          </section>
        </div>
      </div>
    </main>
  );
}
