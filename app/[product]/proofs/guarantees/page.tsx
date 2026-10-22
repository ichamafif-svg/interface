import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { PageHead, SectionTitle, StateChip } from "@/components/ui";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Garanties" };

const STAGE: Record<string, string> = { resource: "Ressource servie", probe: "Sonde", capture: "Capture", instrument: "Instrument", observation: "Observation", fact: "Fait admis", guarantee: "Garantie" };
const LINK_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  ok: { bg: "rgba(74,222,128,.12)", fg: "var(--ok)", icon: "✓" },
  broken: { bg: "rgba(248,113,113,.14)", fg: "var(--bad)", icon: "✕" },
  pending: { bg: "rgba(255,255,255,.04)", fg: "var(--muted)", icon: "·" },
  unknown: { bg: "rgba(251,191,36,.12)", fg: "var(--warn)", icon: "?" },
};

export default async function Guarantees({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<{ g?: string }> }) {
  const { product } = await params;
  const { g } = await searchParams;
  const c = api();
  const list = await unwrap(c.GET("/products/{product}/guarantees", { params: { path: { product } } }));
  const selected = list.items.find((x) => x.id === g) ?? list.items.find((x) => x.state === "inconnu") ?? list.items[0];
  const chainRes = selected ? await c.GET("/products/{product}/guarantees/{guarantee}/chain", { params: { path: { product, guarantee: selected.id } } }) : null;
  const chain = chainRes?.data ?? null;
  const k = list.counts;
  const p = `/${product}`;

  return (
    <main className="page">
      <PageHead kicker="Garanties · release servie" title="Une absence de mesure n'est jamais un zéro" />
      <div className="flex">
        <StateChip state="qualifie" label={`${k.qualifie} qualifiées`} />
        <StateChip state="observe" label={`${k.observe} observées`} />
        <StateChip state="propose" label={`${k.propose} proposées`} />
        <StateChip state="inconnu" label={`${k.inconnu} inconnues`} />
        <StateChip state="non_couvert" label={`${k.non_couvert} non couvertes`} />
      </div>

      {chain && (
        <section className="glass pad">
          <SectionTitle
            right={
              <div className="flex">
                <Link className="btn sm" href={`${p}/agent`}>Ouvrir une réparation</Link>
                <Link className="btn sm ghost" href={`${p}/proofs/timeline`}>Chronologie</Link>
              </div>
            }
          >
            Chaîne de preuve
          </SectionTitle>
          <h2 style={{ fontSize: 20 }}>{chain.title}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 16 }}>
            {chain.links.map((l) => {
              const st = LINK_STYLE[l.status];
              return (
                <div key={l.stage} className="card" style={{ borderColor: l.status === "broken" ? "rgba(248,113,113,.35)" : undefined }}>
                  <div className="flex"><span style={{ width: 20, height: 20, borderRadius: "50%", background: st.bg, color: st.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{st.icon}</span><span className="label">{STAGE[l.stage]}</span></div>
                  <div style={{ marginTop: 8, fontSize: 13, color: l.status === "broken" ? "var(--bad)" : undefined }}>{l.label}</div>
                </div>
              );
            })}
          </div>
          {chain.lastQualified && (
            <div className="muted small" style={{ marginTop: 12 }}>
              Dernière valeur qualifiée : <span style={{ color: "var(--fg)" }}>{chain.lastQualified.value}</span> · {dateTime(chain.lastQualified.at)} · {chain.lastQualified.release}
              {!chain.lastQualified.reused && " · attribuée à une autre release : non reprise pour la release servie."}
            </div>
          )}
        </section>
      )}

      <section className="glass tablewrap">
        <table>
          <thead>
            <tr><th>Garantie</th><th>Trajet</th><th>Instrument</th><th>Fenêtre</th><th>Fraîcheur</th><th>État</th></tr>
          </thead>
          <tbody>
            {list.items.map((x) => (
              <tr key={x.id} className={x.id === selected?.id ? "sel" : undefined}>
                <td><Link href={`?g=${x.id}`} style={{ color: "var(--fg)" }}>{x.title}</Link></td>
                <td className="mono muted">{x.path}</td>
                <td className="muted">{x.instrument}</td>
                <td className="muted">{x.window}</td>
                <td className={x.stale ? "c-warn" : "muted"}>{x.freshness}</td>
                <td><StateChip state={x.state} label={x.value ? `${STATE_SHORT[x.state] ?? ""}${STATE_SHORT[x.state] ? " · " : ""}${x.value}` : undefined} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

const STATE_SHORT: Record<string, string> = { qualifie: "Qualifiée", observe: "Observée", non_couvert: "" };
