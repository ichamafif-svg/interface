import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { Chip, Kpi, PageHead, SectionTitle } from "@/components/ui";
import { refHref } from "@/lib/refs";

export const metadata = { title: "Écarts" };

const SHOWN: Record<string, { cls: string; label: string }> = {
  non_couvert: { cls: "n", label: "Non couvert" },
  inconnu: { cls: "u", label: "Inconnu" },
  detecte: { cls: "p", label: "Détecté, pas impossible" },
  limite_plateforme: { cls: "p", label: "Limite plateforme" },
  partiel: { cls: "o", label: "Partiel" },
};
const OWNER: Record<string, string> = { standard: "Standard", client: "Vous", assumed: "Assumé" };
const TABS = [["", "Tous"], ["product", "Produit"], ["platform", "Plateforme"], ["client", "À vous"]] as const;

export default async function Gaps({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<{ f?: string }> }) {
  const { product } = await params;
  const { f = "" } = await searchParams;
  const data = await unwrap(api().GET("/products/{product}/gaps", { params: { path: { product } } }));
  const all = data.items;
  const match = (k: string) => (g: (typeof all)[number]) => !k || (k === "client" ? g.owner === "client" : g.scope === k);
  const items = all.filter(match(f));
  const count = (pred: (g: (typeof all)[number]) => boolean) => all.filter(pred).length;
  const p = `/${product}`;

  return (
    <main className="page">
      <PageHead kicker="Écarts ouverts · jamais masqués" title="Ce que Standard ne garantit pas encore" />
      <div className="kpis">
        <Kpi label="Non couvert" value={count((g) => g.displayedAs === "non_couvert")} sub="Aucune preuve possible aujourd'hui" color="var(--bad)" />
        <Kpi label="Inconnu" value={count((g) => g.displayedAs === "inconnu")} sub="Mesure absente ou périmée" color="var(--warn)" />
        <Kpi label="Limite assumée" value={count((g) => ["detecte", "limite_plateforme", "partiel"].includes(g.displayedAs))} sub="Documentée, avec sa feuille de route" />
        <Kpi label="Hors Standard" value={data.outsideStandard.length} sub="Frontières surveillées" />
      </div>
      <nav className="glass subnav" aria-label="Filtrer" style={{ alignSelf: "flex-start" }}>
        {TABS.map(([k, l]) => (
          <Link key={k} href={k ? `?f=${k}` : "?"} className={f === k ? "on" : undefined}>{l} · {count(match(k))}</Link>
        ))}
      </nav>
      <div className="row">
        <section className="glass tablewrap grow">
          <table>
            <thead><tr><th>Écart</th><th>Garantie touchée</th><th>Affiché comme</th><th>Qui agit</th><th>Prochaine étape</th></tr></thead>
            <tbody>
              {items.map((g) => {
                const s = SHOWN[g.displayedAs] ?? { cls: "p", label: g.displayedAs };
                return (
                  <tr key={g.id} id={g.id}>
                    <td>{g.title}</td>
                    <td className="muted">{g.guarantee}</td>
                    <td><Chip cls={s.cls} dot={s.cls !== "p"}>{s.label}</Chip></td>
                    <td>{OWNER[g.owner] ?? g.owner}</td>
                    <td className="muted">
                      {g.decisionId ? <Link href={refHref(product, { kind: "decision", id: g.decisionId })} className="accent">{g.nextStep} →</Link> : g.nextStep}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <aside className="side stack" style={{ gap: 16 }}>
          <section className="glass pad">
            <SectionTitle>Hors Standard · frontières</SectionTitle>
            {data.outsideStandard.map((x) => (
              <div key={x.name} className="between" style={{ padding: "7px 0" }}><span>{x.name}</span><span className="muted small">{x.note}</span></div>
            ))}
          </section>
          <section className="glass pad">
            <SectionTitle>Règle</SectionTitle>
            <p style={{ margin: 0 }}>Un écart n&apos;est jamais retiré d&apos;un export ni compté comme réussi. Il disparaît seulement quand une preuve le ferme.</p>
            <Link href={`${p}/proofs/export`} className="btn sm" style={{ marginTop: 12 }}>Voir dans l&apos;export</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
