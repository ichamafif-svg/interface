import { api, unwrap } from "@/lib/api/server";
import { Diff, Kpi, PageHead, SectionTitle, StateChip, Chip } from "@/components/ui";
import { InventoryActions } from "@/components/actions";

export const metadata = { title: "Découvrir · Inventaire" };

const SRC: Record<string, [string, string]> = { yes: ["✓", "var(--ok)"], no: ["—", "var(--muted)"], warn: ["?", "var(--warn)"] };

export default async function Inventory({ params }: { params: Promise<{ product: string; zone: string }> }) {
  const { product, zone } = await params;
  const inv = await unwrap(api().GET("/products/{product}/zones/{zone}/inventory", { params: { path: { product, zone } } }));
  const k = inv.counts;
  const unsupported = inv.items.filter((i) => i.unsupported);

  return (
    <main className="page">
      <PageHead
        kicker={`Inventaire · trois sources · commit ${inv.commit}`}
        title="L'IA découvre, le déterministe ancre, le réel tranche"
        right={<span className="muted small"><b className="mono">E</b> Extracteur · <b className="mono">IA</b> Découverte IA · <b className="mono">R</b> Réel</span>}
      />
      <div className="kpis">
        <Kpi label="Concordantes" value={k.concordant} sub="Trois sources d'accord" />
        <Kpi label="IA seule" value={k.aiOnly} sub="Extracteurs proposés" color="var(--accent)" />
        <Kpi label="Non étayées" value={k.unsupported} sub="À votre examen" />
        <Kpi label="Hors code" value={k.outsideCode} sub="Observées, introuvables" color="var(--bad)" />
        <Kpi label="Dormantes" value={k.dormant} sub="Jamais observées" color="var(--warn)" />
      </div>
      <div className="row">
        <section className="glass grow tablewrap">
          <table>
            <thead><tr><th>Ressource</th><th style={{ textAlign: "center" }}>E</th><th style={{ textAlign: "center" }}>IA</th><th style={{ textAlign: "center" }}>R</th><th>Preuve</th><th>État</th><th /></tr></thead>
            <tbody>
              {inv.items.map((it) => (
                <tr key={it.id}>
                  <td><div className="mono" style={{ fontSize: 13 }}>{it.resource}</div><div className="muted small">{it.kind}</div></td>
                  {(["extractor", "ai", "real"] as const).map((s) => {
                    const [ic, col] = SRC[it.sources[s]] ?? SRC.no;
                    return <td key={s} style={{ textAlign: "center", color: col }}>{ic}</td>;
                  })}
                  <td className={`mono small ${"warn" in it.evidence && it.evidence.warn ? "c-warn" : "muted"}`}>{"path" in it.evidence ? `${it.evidence.path}${it.evidence.line ? `:${it.evidence.line}` : ""}` : it.evidence.text}</td>
                  <td><StateChip state={it.state} label={it.stateLabel} /></td>
                  <td>
                    {(it.state === "propose" || it.state === "inconnu" || it.state === "non_couvert") && (
                      <InventoryActions product={product} itemId={it.id} actions={[{ id: "confirm", label: "Confirmer" }, { id: "discard", label: "Écarter" }]} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="side stack" style={{ gap: 16 }}>
          {unsupported.map((it) => (
            <section key={it.id} className="glass pad" style={{ borderColor: "rgba(196,181,253,.3)" }}>
              <SectionTitle right={<Chip cls="v">Non étayé</Chip>}>Surfacé à l&apos;humain</SectionTitle>
              <div className="mono" style={{ fontSize: 13 }}>{it.resource}</div>
              <p style={{ margin: "8px 0" }}>{it.unsupported!.reasoning}</p>
              <div className="muted small">Vérification : <span className="c-warn">{it.unsupported!.failure}</span> · risque {it.unsupported!.risk}</div>
              <div style={{ marginTop: 12 }}>
                <InventoryActions
                  product={product}
                  itemId={it.id}
                  actions={[
                    { id: "provide_source", label: "Fournir la source", primary: true },
                    { id: "outside_repo", label: "Hors dépôt" },
                    { id: "discard", label: "Écarter" },
                  ]}
                />
              </div>
            </section>
          ))}
          {inv.aiExtractors.map((x) => (
            <section key={x.candidateId} className="glass pad">
              <SectionTitle right={<Chip cls={x.status === "admitted" ? "q" : x.status === "refused" ? "n" : "p"}>{x.status === "admitted" ? "Admis" : x.status === "refused" ? "Refusé" : "Proposé"}</Chip>}>Extracteur écrit par l&apos;IA</SectionTitle>
              <div className="muted small" style={{ marginBottom: 8 }}>Motif <span className="mono">{x.pattern}</span> · candidat {x.candidateId}{x.found != null && ` · ${x.found} routes trouvées`}</div>
              <Diff text={x.code} />
            </section>
          ))}
        </aside>
      </div>
    </main>
  );
}
