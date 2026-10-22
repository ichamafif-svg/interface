import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { Chip, LevelChip, LEVEL, PageHead, SectionTitle, type ProofLevel } from "@/components/ui";
import { ExportButton } from "@/components/actions";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Export" };

const FRAMEWORKS = [["iso27001", "ISO 27001"], ["dora", "DORA"], ["nis2", "NIS2"]] as const;
type Fw = (typeof FRAMEWORKS)[number][0];
const TARGETS = [
  { format: "audit_bundle", title: "Dossier d'audit", text: "PDF + archive JSON signée", action: "Générer" },
  { format: "oscal", title: "OSCAL", text: "Résultats d'évaluation, format NIST", action: "Exporter" },
  { format: "vanta", title: "Vanta · Drata", text: "Tests et preuves par API", action: "Connecter" },
  { format: "dora", title: "DORA", text: "Registre d'information · notification d'incident", action: "Pré-remplir" },
  { format: "sbom_cyclonedx", title: "SBOM et VEX", text: "CycloneDX · release servie", action: "Télécharger" },
  { format: "siem", title: "SIEM", text: "OpenTelemetry · syslog", action: "Configurer" },
  { format: "exit_bundle", title: "Sortir de Standard", text: "Images OCI, dump Postgres, politiques Cedar, config Envoy", action: "Préparer" },
] as const;
const ORDER: ProofLevel[] = ["verifie", "observe", "lu", "inconnu", "non_couvert", "hors_standard"];

export default async function Export({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<{ fw?: string }> }) {
  const { product } = await params;
  const { fw: raw } = await searchParams;
  const fw: Fw = FRAMEWORKS.some(([k]) => k === raw) ? (raw as Fw) : "iso27001";
  const c = api();
  const [report, exports] = await Promise.all([
    unwrap(c.GET("/products/{product}/compliance/{framework}", { params: { path: { product, framework: fw } } })),
    unwrap(c.GET("/products/{product}/exports", { params: { path: { product } } })),
  ]);

  return (
    <main className="page">
      <PageHead kicker="Export · preuves graduées" title="Le dossier d'audit, avec ses trous" />
      <nav className="glass subnav" aria-label="Référentiel" style={{ alignSelf: "flex-start" }}>
        {FRAMEWORKS.map(([k, l]) => <Link key={k} href={`?fw=${k}`} className={fw === k ? "on" : undefined}>{l}</Link>)}
      </nav>
      <div className="row">
        <section className="glass grow">
          <div className="pad" style={{ paddingBottom: 6 }}>
            <SectionTitle right={<span className="muted small">Une preuve n&apos;est jamais présentée au-dessus de son niveau</span>}>
              {report.title} · {report.totalControls} contrôles
            </SectionTitle>
            <div className="flex">
              {ORDER.map((l) => <Chip key={l} cls={LEVEL[l].cls} dot={l !== "lu" && l !== "hors_standard"}>{LEVEL[l].label} · {report.counts[l]}</Chip>)}
            </div>
            <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", marginTop: 14, background: "rgba(255,255,255,.06)" }} aria-hidden="true">
              {ORDER.map((l) => (
                <span key={l} style={{ width: `${(report.counts[l] / report.totalControls) * 100}%`, background: { verifie: "#4ade80", observe: "#60a5fa", lu: "rgba(255,255,255,.35)", inconnu: "#fbbf24", non_couvert: "#f87171", hors_standard: "rgba(255,255,255,.08)" }[l] }} />
              ))}
            </div>
          </div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Contrôle</th><th>Preuve fournie</th><th>Niveau</th></tr></thead>
              <tbody>
                {report.controls.map((ctl) => (
                  <tr key={ctl.id}>
                    <td><span className="mono accent">{ctl.id}</span> · {ctl.title}</td>
                    <td className="muted">{ctl.evidence}</td>
                    <td><div className="flex">{ctl.levels.map((l) => <LevelChip key={l} level={l} />)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="side stack" style={{ gap: 16 }}>
          <section className="glass pad">
            <SectionTitle>Exporter vers</SectionTitle>
            <div className="stack" style={{ gap: 0 }}>
              {TARGETS.map((t, i) => (
                <div key={t.format} className="between" style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line-soft)" : undefined, flexWrap: "nowrap" }}>
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 500 }}>{t.title}</div><div className="muted small">{t.text}</div></div>
                  <ExportButton product={product} format={t.format} framework={t.format === "audit_bundle" || t.format === "oscal" ? fw : undefined} label={t.action} />
                </div>
              ))}
            </div>
          </section>
          <section className="glass pad">
            <SectionTitle>Dernière photographie</SectionTitle>
            {report.lastSnapshot ? (
              <>
                <div>{dateTime(report.lastSnapshot.at)} · release {report.lastSnapshot.release}</div>
                <div className="mono muted" style={{ marginTop: 4 }}>sha256 {report.lastSnapshot.sha256} · signé Standard</div>
              </>
            ) : <div className="muted">Aucune pour ce référentiel.</div>}
            <p className="muted small" style={{ margin: "10px 0 0" }}>Les écarts sont inclus. Une photographie ne vaut pas garantie pour la suite.</p>
          </section>
          {exports.items.length > 0 && (
            <section className="glass pad">
              <SectionTitle>Exports récents</SectionTitle>
              {exports.items.slice(0, 6).map((x) => (
                <div key={x.id} className="between small" style={{ padding: "5px 0" }}>
                  <span><span className="mono accent">{x.id}</span> · {x.format}</span>
                  <span className={x.status === "ready" ? "c-ok" : x.status === "failed" ? "c-bad" : "muted"}>{x.status === "ready" ? "prêt" : x.status === "failed" ? "échec" : "en cours"}</span>
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
