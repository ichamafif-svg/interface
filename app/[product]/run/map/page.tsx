import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { PageHead, StateChip, SectionTitle } from "@/components/ui";
import { TopologyView } from "@/components/topology-view";

export const metadata = { title: "Carte" };

const KIND: Record<string, string> = {
  client: "Client", external: "Sondes", entry: "Entrée", identity: "Identité", sandbox: "Bac d'agent", service: "Service", kernel: "Noyau",
  datastore: "Données", secrets: "Secrets", egress: "Sortie", third_party: "Tiers", cdn: "CDN",
};
const GROUPS = [
  ["product", "Votre produit, sous Standard"],
  ["outside", "Hors de chez vous · frontières surveillées"],
] as const;

export default async function MapPage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const t = await unwrap(api().GET("/products/{product}/topology", { params: { path: { product } } }));
  const roles = new Map(t.productView.nodes.map((n) => [n.id, n.role]));
  const coverage = (id: string) => t.guarantees.filter((g) => g.protects.nodes.includes(id) || t.edges.some((e) => (e.from === id || e.to === id) && g.protects.edges.includes(e.id)));

  return (
    <main className="page">
      <PageHead
        kicker="Carte · ressources, composants, garanties"
        title="Ce qui tourne, ce qui est prouvé, ce qui est exposé"
        intro="Votre produit de gauche à droite : qui arrive, ce qui répond, ce qui est stocké. Standard apparaît là où il agit, sur les flèches."
      />
      <TopologyView product={product} topology={t} />

      <section className="glass">
        <div className="pad" style={{ paddingBottom: 4 }}><SectionTitle>Ressources et composants</SectionTitle></div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Ressource</th><th>Type</th><th>Détail</th><th>Garanties</th><th>État</th></tr></thead>
            {GROUPS.map(([m, label]) => (
              <tbody key={m}>
                <tr><td colSpan={5} className="label" style={{ paddingTop: 18, borderTop: 0 }}>{label}</td></tr>
                {t.nodes.filter((n) => n.managed === m && roles.has(n.id)).map((n) => {
                  const g = coverage(n.id);
                  const proven = g.filter((x) => x.state === "qualifie").length;
                  return (
                    <tr key={n.id}>
                      <td style={{ fontWeight: 500 }}>{n.zoneId ? <Link href={`/${product}/zones/${n.zoneId}/dossier`} style={{ color: "var(--fg)" }}>{n.label}</Link> : n.label}</td>
                      <td className="muted">{roles.get(n.id) ?? KIND[n.kind] ?? n.kind}</td>
                      <td className="muted small">{n.detail ?? (n.metrics?.map((x) => `${x.label} ${x.display ?? x.value ?? "—"} ${x.unit ?? ""}`).join(" · ") || "—")}</td>
                      <td className="small">{g.length ? <span>{proven}/{g.length} qualifiée{g.length > 1 ? "s" : ""}</span> : <span className="muted">aucune</span>}</td>
                      <td><StateChip state={n.state} label={n.stateLabel} /></td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </main>
  );
}
