import { api, unwrap } from "@/lib/api/server";
import { Chip, Kpi, PageHead, SectionTitle } from "@/components/ui";
import { duration, nf, pct } from "@/lib/format";

export const metadata = { title: "Agent · Métriques" };

const LOC: Record<string, string> = { self_hosted: "q", frontier: "o", external_agent: "p" };

export default async function Metrics({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const c = api();
  const path = { params: { path: { product } } };
  const [m, ladder, models] = await Promise.all([
    unwrap(c.GET("/products/{product}/agent/metrics", path)),
    unwrap(c.GET("/products/{product}/agent/autonomy", path)),
    unwrap(c.GET("/products/{product}/agent/models", path)),
  ]);
  const r = m.sandboxRefusalsPerMission;
  const max = Math.max(...r, 1);
  const w = 320, h = 90;
  const line = r.map((v, i) => `${i ? "L" : "M"}${((i / (r.length - 1)) * w).toFixed(1)} ${(h - (v / max) * (h - 10) - 4).toFixed(1)}`).join("");

  return (
    <main className="page">
      <PageHead
        kicker={`Agent · ${m.windowDays} derniers jours`}
        title="L'autonomie se gagne, preuve par preuve"
        right={<Chip cls="q">{m.missions} missions · {m.admitted} admises · {m.rollbacks} rollback</Chip>}
      />
      <div className="kpis">
        <Kpi label="Admis au 1er passage" value={pct(m.firstPassRate)} sub={`${m.firstPassDelta >= 0 ? "+" : ""}${nf(m.firstPassDelta * 100)} pts sur ${m.windowDays} jours`} />
        <Kpi label="Reprises par mission" value={nf(m.reworkAvg, 1)} sub="corrections avant admission" />
        <Kpi label="Coût par changement" value={`${nf(m.costPerChangeEur, 2)} €`} sub="calcul et modèles inclus" />
        <Kpi label="Proposition → release" value={duration(m.medianLeadTimeSeconds)} sub="médiane, décisions humaines incluses" />
      </div>
      <div className="row">
        <section className="glass grow">
          <div className="pad" style={{ paddingBottom: 4 }}>
            <SectionTitle right={<span className="muted small">1 observe · 2 propose · 3 agit, l&apos;humain valide · 4 agit seul</span>}>Échelle d&apos;autonomie par classe de tâches</SectionTitle>
          </div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Classe de tâches</th><th>Palier</th><th>Preuve accumulée</th><th>Prochain palier</th></tr></thead>
              <tbody>
                {ladder.items.map((x) => (
                  <tr key={x.id}>
                    <td>{x.label}</td>
                    <td>
                      <div className="flex" style={{ gap: 4 }} aria-label={`Palier ${x.tier} sur 4`}>
                        {[1, 2, 3, 4].map((n) => <span key={n} style={{ width: 22, height: 6, borderRadius: 999, background: n <= x.tier ? "linear-gradient(90deg,#818CF8,#22D3EE)" : "rgba(255,255,255,.08)" }} />)}
                      </div>
                    </td>
                    <td className="muted">{x.evidence}</td>
                    <td>{x.alwaysHuman ? <Chip cls="o">{x.next}</Chip> : x.tier === 4 ? <Chip cls="q">{x.next}</Chip> : <span className="muted">{x.next}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="side stack" style={{ gap: 16 }}>
          <section className="glass pad">
            <SectionTitle>Refus du bac par mission</SectionTitle>
            <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`De ${nf(r[0], 1)} à ${nf(r[r.length - 1], 1)} refus par mission`}>
              <path d={line} fill="none" stroke="url(#rf)" strokeWidth="2" />
              <defs><linearGradient id="rf" x1="0" x2="1"><stop offset="0" stopColor="#818CF8" /><stop offset="1" stopColor="#22D3EE" /></linearGradient></defs>
            </svg>
            <div className="between muted small"><span>{nf(r[0], 1)} il y a {m.windowDays} j</span><span>{nf(r[r.length - 1], 1)} aujourd&apos;hui</span></div>
            <p className="muted small" style={{ margin: "10px 0 0" }}>Les refus deviennent des leçons : l&apos;agent apprend les murs de ce produit.</p>
          </section>
          <section className="glass pad">
            <SectionTitle>Routage des modèles</SectionTitle>
            {models.items.map((x, i) => (
              <div key={x.task} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
                <div className="between"><span style={{ fontWeight: 500 }}>{x.task}</span><Chip cls={LOC[x.location] ?? "p"} sm dot={false}>{x.model}</Chip></div>
                <div className="muted small" style={{ marginTop: 2 }}>{x.share}</div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}
