import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { Chip, Diff, PageHead, SectionTitle } from "@/components/ui";
import { duration } from "@/lib/format";

export const metadata = { title: "Coder · Mission" };

const CHECK: Record<string, [string, string]> = { passed: ["c-ok", "✓"], failed: ["c-bad", "✕"], refused: ["c-warn", "!"] };

export default async function ZoneMission({ params, searchParams }: { params: Promise<{ product: string; zone: string }>; searchParams: Promise<{ mission?: string }> }) {
  const { product, zone } = await params;
  const { mission: wanted } = await searchParams;
  const c = api();
  const list = await unwrap(c.GET("/products/{product}/missions", { params: { path: { product } } }));
  const inZone = list.items.filter((m) => m.zoneId === zone);
  const pick = inZone.find((m) => m.id === wanted) ?? inZone.find((m) => m.status === "admitted") ?? inZone[0];
  const p = `/${product}`;
  if (!pick) {
    return (
      <main className="page">
        <PageHead kicker="Coder" title="Aucune mission dans cette zone" />
        <Link className="btn primary" href={`${p}/agent`} style={{ alignSelf: "flex-start" }}>Lancer une mission</Link>
      </main>
    );
  }
  const m = await unwrap(c.GET("/products/{product}/missions/{mission}", { params: { path: { product, mission: pick.id } } }));
  const cand = m.candidateId ? await unwrap(c.GET("/products/{product}/candidates/{candidate}", { params: { path: { product, candidate: m.candidateId } } })) : null;
  const allPassed = cand?.prechecks.every((x) => x.status !== "failed");

  return (
    <main className="page">
      <PageHead
        kicker={`Mission ${m.id} · branche ${m.branch}`}
        title="L'agent code dans le périmètre confirmé"
        right={
          <>
            {cand && (allPassed ? <Chip cls="q">Précontrôles passés</Chip> : <Chip cls="n">Précontrôle en échec</Chip>)}
            <Chip cls="v" dot={false}>{m.model} · 1 écrivain, 2 relecteurs</Chip>
          </>
        }
      />
      {inZone.length > 1 && (
        <nav className="glass subnav" aria-label="Missions de la zone" style={{ alignSelf: "flex-start" }}>
          {inZone.map((x) => <Link key={x.id} href={`?mission=${x.id}`} className={x.id === m.id ? "on" : undefined}><span className="mono">{x.id}</span> {x.title}</Link>)}
        </nav>
      )}
      <div className="row">
        <aside className="glass pad side" style={{ flexBasis: 300 }}>
          <SectionTitle>Ce que l&apos;agent reçoit</SectionTitle>
          {m.context ? (
            <div className="stack" style={{ gap: 14 }}>
              <div><div className="label">Zone confirmée</div><div style={{ marginTop: 4 }}>{m.context.zone}</div></div>
              <div><div className="label">Règles applicables</div><div style={{ marginTop: 4 }}>{m.context.rules}</div></div>
              <div><div className="label">Blocs disponibles</div><div className="flex" style={{ marginTop: 6 }}>{m.context.blocks.map((b) => <Chip key={b} cls="p" dot={false} sm>{b}</Chip>)}</div></div>
              <div><div className="label">Code concerné</div><div className="mono" style={{ marginTop: 4, lineHeight: 1.8 }}>{m.context.files.map((f) => <div key={f}>{f}</div>)}</div></div>
              <div><div className="label">Attentes de test</div><div style={{ marginTop: 4 }}>{m.context.testExpectations}</div></div>
              <div><div className="label">Capacités</div><div style={{ marginTop: 4 }}>{m.context.capabilities}</div></div>
            </div>
          ) : <div className="muted">Contexte non publié.</div>}
        </aside>

        {cand ? (
          <section className="glass pad grow">
            <SectionTitle right={<span className="mono"><span className="add">+{cand.additions}</span> <span className="del">−{cand.deletions}</span> · {cand.files.length} fichiers</span>}>Candidat {cand.id}</SectionTitle>
            <div className="flex small muted" style={{ marginBottom: 10 }}>{cand.files.map((f) => <span key={f} className="mono">{f}</span>)}</div>
            <Diff text={cand.diff} />
            <div className="grid3" style={{ marginTop: 14 }}>
              {cand.reviews.map((r) => (
                <div key={r.reviewer} className="card">
                  <div className="between"><b style={{ fontWeight: 500 }}>{r.reviewer}</b><Chip cls={r.verdict === "conform" ? "q" : r.verdict === "corrected" ? "u" : "n"} sm>{r.verdict === "conform" ? "Conforme" : r.verdict === "corrected" ? "Corrigé" : "Refusé"}</Chip></div>
                  <div className="muted small" style={{ marginTop: 6 }}>{r.note}</div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="glass pad grow empty">Pas encore de candidat : l&apos;agent travaille dans son bac.</section>
        )}

        {cand && (
          <aside className="side stack" style={{ gap: 16, flexBasis: 300 }}>
            <section className="glass pad">
              <SectionTitle>Précontrôles · {duration(cand.precheckSeconds)}</SectionTitle>
              {cand.prechecks.map((x) => {
                const [cls, ic] = CHECK[x.status] ?? ["muted", "·"];
                return (
                  <div key={x.tool} className="between" style={{ padding: "7px 0" }}>
                    <span><span className={cls}>{ic}</span> {x.tool}</span>
                    <span className={`mono ${x.status === "refused" ? "c-warn" : "muted"}`}>{x.detail}</span>
                  </div>
                );
              })}
            </section>
            {cand.lessons.length > 0 && (
              <section className="glass pad">
                <SectionTitle>Leçon transmise à l&apos;agent</SectionTitle>
                {cand.lessons.map((l) => <p key={l} style={{ margin: 0 }}>{l}</p>)}
              </section>
            )}
            <Link className="btn primary" href={`${p}/zones/${zone}/verification`}>Envoyer en vérification</Link>
            <p className="muted small" style={{ margin: 0 }}>L&apos;agent ne choisit ni ses droits, ni ses seuils, ni son admission.</p>
          </aside>
        )}
      </div>
    </main>
  );
}
