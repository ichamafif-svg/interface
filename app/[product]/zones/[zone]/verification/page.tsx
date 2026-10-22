import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { Chip, PageHead, SectionTitle } from "@/components/ui";
import { refHref } from "@/lib/refs";

export const metadata = { title: "Vérifier · Comportement" };

const OUT: Record<string, { cls: string; label: string }> = {
  passed: { cls: "q", label: "Réussi" },
  failed: { cls: "n", label: "Échec" },
  not_covered: { cls: "u", label: "Non couvert" },
  out_of_scope: { cls: "p", label: "Hors périmètre" },
};

export default async function Verification({ params }: { params: Promise<{ product: string; zone: string }> }) {
  const { product, zone } = await params;
  const v = await unwrap(api().GET("/products/{product}/zones/{zone}/verification", { params: { path: { product, zone } } }));
  const n = (k: string) => v.scenarios.filter((s) => s.outcome === k).length;

  return (
    <main className="page">
      <PageHead
        kicker={`Vérification · candidat ${v.candidateId} dans le bac`}
        title="On teste le comportement, pas seulement le code"
        right={
          <>
            <Chip cls="q">{n("passed")} réussis</Chip>
            {n("failed") > 0 && <Chip cls="n">{n("failed")} échec renvoyé à l&apos;agent</Chip>}
            {n("out_of_scope") > 0 && <Chip cls="p" dot={false}>{n("out_of_scope")} hors périmètre</Chip>}
            {n("not_covered") > 0 && <Chip cls="u">{n("not_covered")} non couvert</Chip>}
          </>
        }
      />
      <div className="row">
        <section className="glass grow tablewrap">
          <table>
            <thead><tr><th>Scénario</th><th>Attendu</th><th>Résultat</th><th>État</th></tr></thead>
            <tbody>
              {v.scenarios.map((s) => {
                const o = OUT[s.outcome] ?? OUT.out_of_scope;
                return (
                  <tr key={s.title}>
                    <td>{s.title}</td>
                    <td className="muted">{s.expected}</td>
                    <td className="mono">{s.result}</td>
                    <td><Chip cls={o.cls} dot={o.cls !== "p"}>{s.outcomeLabel ?? o.label}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <aside className="side stack" style={{ gap: 16 }}>
          <section className="glass pad">
            <SectionTitle>Scanners activés par la découverte</SectionTitle>
            {v.scanners.map((s) => (
              <div key={s.tool} className="between" style={{ padding: "7px 0", opacity: s.activated ? 1 : 0.55 }}>
                <span>{s.activated ? <span className="c-ok">✓</span> : <span className="muted">○</span>} {s.tool}</span>
                <span className="muted small">{s.activated ? s.reason : `non activé · ${s.reason}`}</span>
              </div>
            ))}
            <div className="muted small" style={{ marginTop: 10 }}>Catalogue complet · {v.catalog ? `${v.catalog.rules} règles ${v.catalog.framework}` : "—"}</div>
          </section>
          {v.failures.map((f) => (
            <section key={f.summary} className="glass pad" style={{ borderColor: "rgba(248,113,113,.3)" }}>
              <SectionTitle>Échec renvoyé</SectionTitle>
              <p style={{ margin: 0 }}>{f.summary}</p>
              <p className="muted" style={{ margin: "6px 0 0" }}>Leçon transmise : {f.lesson}</p>
              {f.missionId && <Link className="btn sm" style={{ marginTop: 12 }} href={refHref(product, { kind: "mission", id: f.missionId })}>Voir la mission</Link>}
            </section>
          ))}
          <p className="muted small" style={{ margin: 0 }}>Les tests écrits par l&apos;agent l&apos;aident à corriger. Seuls les instruments indépendants qualifient une garantie.</p>
        </aside>
      </div>
    </main>
  );
}
