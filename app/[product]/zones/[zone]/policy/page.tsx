import { api, unwrap } from "@/lib/api/server";
import { Chip, PageHead, SectionTitle } from "@/components/ui";
import { ShadowRefusalActions } from "@/components/actions";
import { nf } from "@/lib/format";

export const metadata = { title: "Zone · Politique Cedar" };

const COLS = [["actor", "Acteur"], ["object", "Objet"], ["precondition", "Précondition"], ["budget", "Budget"], ["channel", "Canal"]] as const;

function compact(n: number) {
  return n >= 1_000_000 ? `${nf(n / 1_000_000, 1)} M` : n >= 1000 ? `${nf(n / 1000, 1)} k` : nf(n);
}

export default async function Policy({ params }: { params: Promise<{ product: string; zone: string }> }) {
  const { product, zone } = await params;
  const c = api();
  const path = { params: { path: { product, zone } } };
  const [pol, sh] = await Promise.all([
    unwrap(c.GET("/products/{product}/zones/{zone}/policy", path)),
    unwrap(c.GET("/products/{product}/zones/{zone}/policy/shadow-refusals", path)),
  ]);
  const r = pol.readiness;
  const ready = r.defaultsFilled === r.defaultsTotal && r.gapsResolved === r.gapsTotal && r.quietHoursReached;
  const max = Math.max(...sh.perDay.map((d) => d.primary + d.others), 1);

  return (
    <main className="page">
      <PageHead
        kicker={`Politique Cedar · ${pol.file} · ${pol.version}`}
        title="Observer d'abord, appliquer ensuite"
        right={
          <>
            <span className="glass subnav" role="status">
              <span className={pol.mode === "observation" ? "on" : undefined}><span className="live" style={{ width: 6, height: 6 }} />Observation</span>
              <span className={pol.mode === "enforcement" ? "on" : undefined}>Application</span>
            </span>
            <button className="btn primary" type="button" disabled={!ready} title={ready ? undefined : "Conditions non remplies"}>Passer en application</button>
          </>
        }
      />
      <div className="row">
        <section className="glass pad grow">
          <SectionTitle>Refus hypothétiques · {sh.windowDays} jours</SectionTitle>
          <div style={{ fontSize: 26, fontWeight: 300 }}>{nf(sh.total)} <span className="muted" style={{ fontSize: 14 }}>sur {compact(sh.requests)} requêtes · rien n&apos;a été bloqué</span></div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140, marginTop: 16 }} role="img" aria-label="Refus hypothétiques par jour">
            {sh.perDay.map((d) => (
              <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: "46%", minWidth: 14, height: `${(d.others / max) * 120}px`, background: "rgba(255,255,255,.28)", borderRadius: "4px 4px 0 0" }} title={`Autres : ${d.others}`} />
                <div style={{ width: "46%", minWidth: 14, height: `${(d.primary / max) * 120}px`, background: "linear-gradient(180deg,rgba(252,211,77,.85),rgba(245,158,11,.35))", borderRadius: 2 }} title={`${sh.primaryLabel} : ${d.primary}`} />
                <div className="muted small" style={{ textAlign: "center", marginTop: 4 }}>{new Date(d.date).getUTCDate()}</div>
              </div>
            ))}
          </div>
          <div className="flex small muted" style={{ marginTop: 8 }}><span className="c-warn">■</span> {sh.primaryLabel} <span style={{ marginLeft: 12 }}>■</span> Autres</div>
        </section>
        <aside className="glass pad side">
          <SectionTitle>Prêt à appliquer ?</SectionTitle>
          <div className="stack" style={{ gap: 10 }}>
            <div className="between"><span>Champs remplis par défaut</span><span className="mono">{r.defaultsFilled} / {r.defaultsTotal}</span></div>
            <div className="between"><span>Écarts tranchés</span><span className={`mono ${r.gapsResolved < r.gapsTotal ? "c-warn" : ""}`}>{r.gapsResolved} / {r.gapsTotal}</span></div>
            <div className="between"><span>{r.quietHoursRequired} h sans nouveau refus</span>{r.quietHoursReached ? <Chip cls="q">Oui</Chip> : <Chip cls="u">Non</Chip>}</div>
          </div>
          <p className="muted small" style={{ margin: "12px 0 0" }}>Un nouveau cas après application = une nouvelle version, repassée en observation sur l&apos;opération concernée.</p>
        </aside>
      </div>

      <section className="glass">
        <div className="pad" style={{ paddingBottom: 4 }}>
          <SectionTitle right={<span className="muted small">Gris : valeur de l&apos;IA avec sa source · ambre : à trancher</span>}>Opérations autorisées</SectionTitle>
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Opération</th>{COLS.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
            <tbody>
              {pol.operations.map((o) => (
                <tr key={o.name}>
                  <td className="mono" style={{ fontSize: 13 }}>{o.name}</td>
                  {COLS.map(([k]) => {
                    const f = o[k];
                    return (
                      <td key={k}>
                        {f.gap ? <Chip cls="u" dot={false}>{f.value}</Chip> : <span>{f.value}</span>}
                        {f.source && <span className="muted small"> · {f.source}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="row">
        <section className="glass pad grow">
          <SectionTitle>{pol.file}</SectionTitle>
          <pre className="code">{pol.source}</pre>
        </section>
        <aside className="glass pad side">
          <SectionTitle>Ce qui aurait été refusé</SectionTitle>
          {sh.top.map((t, i) => (
            <div key={t.route} style={{ padding: "12px 0", borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
              <div className="between"><span className="mono" style={{ fontSize: 13 }}>{t.route}</span><span className="mono c-warn">{nf(t.count)}</span></div>
              <div className="muted small" style={{ marginTop: 2 }}>{t.note}</div>
              {t.options && <ShadowRefusalActions product={product} zone={zone} route={t.route} options={t.options} />}
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}
