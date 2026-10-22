import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { Chip, PageHead, SectionTitle } from "@/components/ui";

export const metadata = { title: "Zones" };

const STATUS: Record<string, string> = { discovery: "u", frozen: "o", transferring: "v", live: "q", not_started: "p" };
const SEV: Record<string, string> = { ok: "q", warn: "u", bad: "n" };
const STEP_SEG = ["inventory", "inventory", "dossier", "policy", "mission", "verification", "transfer"];

export default async function Zones({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const data = await unwrap(api().GET("/products/{product}/zones", { params: { path: { product } } }));
  return (
    <main className="page">
      <PageHead
        kicker="Zones · migration progressive"
        title="Une zone à la fois, chacune devient une release Standard"
        intro="Découvrir, comprendre, délimiter, coder, vérifier, transférer, puis continuer en service. Une zone rouverte refait les étapes touchées, sans perdre ses décisions."
      />
      <div className="row">
        <section className="glass grow tablewrap">
          <table>
            <thead><tr><th>Zone</th><th>Avancement</th><th>Étape</th><th>Politique</th><th>État</th></tr></thead>
            <tbody>
              {data.items.map((z) => (
                <tr key={z.id}>
                  <td><Link href={`/${product}/zones/${z.id}/${STEP_SEG[z.step] ?? "inventory"}`} style={{ color: "var(--fg)", fontWeight: 500 }}>{z.name}</Link></td>
                  <td style={{ minWidth: 180 }}>
                    <div className="flex" style={{ gap: 3 }} aria-label={`Étape ${z.step} sur 7`}>
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => <span key={n} style={{ width: 18, height: 6, borderRadius: 999, background: n < z.step ? "#4ade80" : n === z.step ? "#fbbf24" : "rgba(255,255,255,.08)" }} />)}
                    </div>
                  </td>
                  <td className="muted">{z.step ? `${z.step} / 7` : "—"}</td>
                  <td className="mono muted">{z.policyVersion ?? "—"}</td>
                  <td><Chip cls={STATUS[z.status] ?? "p"}>{z.statusLabel}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="glass pad side">
          <SectionTitle>Dépendances partagées</SectionTitle>
          <p className="muted small" style={{ marginTop: 0 }}>Un changement ici peut rouvrir plusieurs zones.</p>
          {data.sharedDependencies.map((d) => (
            <div key={d.id} className="between" style={{ padding: "8px 0", borderTop: "1px solid var(--line-soft)" }}>
              <span>{d.name}</span>
              <Chip cls={SEV[d.severity] ?? "p"} sm>{d.openIssues ? `${d.openIssues} ouvert${d.openIssues > 1 ? "s" : ""}` : "ok"}</Chip>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}
