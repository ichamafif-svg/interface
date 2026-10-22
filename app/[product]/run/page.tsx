import Link from "next/link";
import { api, unwrap } from "@/lib/api/server";
import { Kpi, PageHead, StateChip, Chip, SectionTitle } from "@/components/ui";
import { ago, duration, hhmm, nf } from "@/lib/format";

export const metadata = { title: "Run" };

function Spark({ data, id }: { data: (number | null)[]; id: string }) {
  const w = 120, h = 34, max = Math.max(...data.map((d) => d ?? 0), 1);
  const pts = data.map((d, i) => (d == null ? null : [(i / (data.length - 1)) * w, h - (d / max) * (h - 4) - 2] as const));
  const segs: string[] = [];
  let cur = "";
  pts.forEach((p) => {
    if (!p) { if (cur) segs.push(cur); cur = ""; return; }
    cur += `${cur ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {segs.map((d, i) => <path key={i} d={d} fill="none" stroke={`url(#sp-${id})`} strokeWidth="1.6" strokeLinejoin="round" />)}
      <defs><linearGradient id={`sp-${id}`} x1="0" x2="1"><stop offset="0" stopColor="#818CF8" /><stop offset="1" stopColor="#22D3EE" /></linearGradient></defs>
    </svg>
  );
}

const ACT: Record<string, { cls: string; label: string }> = {
  kernel: { cls: "q", label: "Admis" },
  agent: { cls: "v", label: "Agent" },
  human: { cls: "o", label: "Humain" },
  probe: { cls: "u", label: "Sonde" },
  change: { cls: "u", label: "Changement" },
  platform: { cls: "p", label: "Plateforme" },
};

export default async function RunPage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const c = api();
  const path = { params: { path: { product } } };
  const [s, comps, tl, zones, live] = await Promise.all([
    unwrap(c.GET("/products/{product}/run/summary", path)),
    unwrap(c.GET("/products/{product}/components", path)),
    unwrap(c.GET("/products/{product}/timeline", path)),
    unwrap(c.GET("/products/{product}/zones", path)),
    unwrap(c.GET("/products/{product}/live/snapshot", path)),
  ]);
  const relay = live.relay;
  const forHuman = relay.waiting.filter((h) => h.direction === "agent_to_human");
  const blocking = forHuman.filter((h) => h.blocking);
  const zoneIds = new Set(zones.items.map((z) => z.id));
  const a = s.autonomy;
  const g = s.guarantees;
  const gTotal = g.qualifie + g.observe + g.propose + g.inconnu + g.non_couvert;
  const p = `/${product}`;
  const circ = 2 * Math.PI * 52;
  const activity = [...tl.items].sort((x, y) => y.at.localeCompare(x.at)).filter((t) => t.actor === "agent" || t.actor === "kernel" || t.actor === "change").slice(0, 4);

  return (
    <main className="page">
      <PageHead
        kicker="Run · temps réel"
        title={`${s.product} en production`}
        intro={
          <>
            Dernier fait admis {ago(s.lastFactAt)} · plateforme {s.platform.integrity === "intact" ? "intègre" : <span className="c-bad">intégrité rompue</span>}
            {s.platform.silentProbes > 0 && <> · <Link href={`${p}/proofs/gaps`} className="c-warn">{s.platform.silentProbes} sonde silencieuse</Link></>}
          </>
        }
        right={<Link className="btn" href={`${p}/run/live`}><span className="live" />Voir le système travailler</Link>}
      />

      <Link href={`${p}/run/live`} className="glass" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, padding: "16px 22px", color: "inherit", borderColor: blocking.length ? "rgba(251,191,36,.35)" : undefined }}>
        <div>
          <div className="label c-warn">L&apos;agent attend de vous</div>
          <div style={{ fontSize: 22, fontWeight: 300, marginTop: 6 }}>{forHuman.length} <span className="muted small">dont {blocking.length} bloquant{blocking.length > 1 ? "s" : ""}</span></div>
          {blocking[0] && <div className="small" style={{ marginTop: 4 }}>{blocking[0].title}</div>}
        </div>
        <div>
          <div className="label c-agent">Fait par l&apos;agent, seul · {relay.windowHours} h</div>
          <div style={{ fontSize: 22, fontWeight: 300, marginTop: 6 }}>{relay.autonomous.count} <span className="muted small">actions dans ses droits</span></div>
          <div className="small muted" style={{ marginTop: 4 }}>{relay.autonomous.examples[0]}</div>
        </div>
        <div>
          <div className="label c-info">Vos gestes · {relay.windowHours} h</div>
          <div style={{ fontSize: 22, fontWeight: 300, marginTop: 6 }}>{relay.humanGestures} <span className="muted small">{relay.medianWaitSeconds != null ? `réponse médiane ${duration(relay.medianWaitSeconds)}` : ""}</span></div>
          {relay.recent[0]?.unblocked && <div className="small c-ok" style={{ marginTop: 4 }}>→ {relay.recent[0].unblocked}</div>}
        </div>
      </Link>

      <div className="kpis">
        <Kpi
          label={`Temps d'ingénieur · ${s.value.engineerHours.period}`}
          value={`${s.value.engineerHours.estimated ? "≈ " : ""}${nf(s.value.engineerHours.value)} h`}
          sub={<>économisées · estimation, <Link href={s.value.engineerHours.methodUrl ?? `${p}/proofs/export`}>méthode</Link></>}
        />
        <Kpi label="CVE corrigées" value={s.value.cvesFixed.count} sub={`délai médian ${duration(s.value.cvesFixed.medianDelaySeconds)}`} />
        <Kpi label="Incidents évités" value={s.value.incidentsAvoided} sub={<>refusés avant production · <Link href={`${p}/run/traces`}>pourquoi ?</Link></>} />
        <Kpi label="Préparation d'audit" value={`${nf(s.value.auditPrep.days, 1)} j`} sub={s.value.auditPrep.previousDeclaredDays != null ? `contre ${s.value.auditPrep.previousDeclaredDays} j déclarés l'an dernier` : undefined} />
        <Kpi label="Coût Standard" value={s.value.monthlyCost.amount != null ? `${nf(s.value.monthlyCost.amount)} €` : "—"} sub={`par mois · ${s.value.monthlyCost.note ?? ""}`} />
      </div>

      <div className="row">
        <section className="glass pad grow">
          <SectionTitle>Autonomie · {a.windowDays} derniers jours</SectionTitle>
          <div className="flex" style={{ gap: 28, alignItems: "center", flexWrap: "wrap" }}>
            <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${a.percent} % d'autonomie`}>
              <circle cx="66" cy="66" r="52" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
              <circle cx="66" cy="66" r="52" fill="none" stroke="url(#ag)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(a.percent / 100) * circ} ${circ}`} transform="rotate(-90 66 66)" />
              <defs><linearGradient id="ag" x1="0" x2="1"><stop offset="0" stopColor="#818CF8" /><stop offset="1" stopColor="#22D3EE" /></linearGradient></defs>
              <text x="66" y="74" textAnchor="middle" fill="#EDEDF2" fontSize="28" fontWeight="300">{a.percent}%</text>
            </svg>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 18 }}>
                {a.autonomous} composants sur {a.total} sous Standard maintenus sans intervention humaine
              </div>
              {s.limits.map((l) => (
                <div key={l.title} className="card" style={{ marginTop: 12, borderColor: "rgba(251,191,36,.25)" }}>
                  <div className="label c-warn">{l.title}</div>
                  <div style={{ marginTop: 4 }}>{l.reason}</div>
                </div>
              ))}
              <div className="flex small" style={{ marginTop: 12, gap: 14 }}>
                <span className="c-ok">● Autonome · {a.breakdown.autonomous}</span>
                <span className="c-info">● Avec intervention · {a.breakdown.withIntervention}</span>
                <span className="c-warn">● Inconnu · {a.breakdown.unknown}</span>
                <span className="c-bad">● Non couvert · {a.breakdown.notCovered}</span>
                <span className="muted">○ Hors Standard · {a.breakdown.outsideStandard}, exclus du calcul</span>
              </div>
            </div>
          </div>
        </section>
        <Link href={`${p}/proofs/guarantees`} className="glass pad side" style={{ color: "inherit" }}>
          <SectionTitle>Garanties</SectionTitle>
          <div style={{ fontSize: 40, fontWeight: 300 }}>{g.qualifie} <span className="muted" style={{ fontSize: 16 }}>sur {gTotal}</span></div>
          <div className="stack" style={{ marginTop: 12, gap: 8, alignItems: "flex-start" }}>
            <StateChip state="qualifie" label={`${g.qualifie} qualifiées`} />
            <StateChip state="observe" label={`${g.observe} observées`} />
            <StateChip state="inconnu" label={`${g.inconnu} inconnues`} />
            <StateChip state="non_couvert" label={`${g.non_couvert} non couvertes`} />
          </div>
        </Link>
      </div>

      <div className="grid3">
        {comps.items.map((cp) => (
          <div key={cp.id} className="glass pad">
            <div className="between">
              <b style={{ fontWeight: 500 }}>{cp.name}</b>
              <StateChip state={cp.state} label={cp.stateLabel} sm />
            </div>
            <div className="between" style={{ marginTop: 14, alignItems: "flex-end" }}>
              <div className="flex" style={{ gap: 20 }}>
                {cp.metrics.map((m) => (
                  <div key={m.key}>
                    <div className="label">{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 300, marginTop: 4 }}>
                      {m.display ?? (m.value ?? "—")} <span className="muted small">{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              {cp.series && <Spark data={cp.series} id={cp.id} />}
            </div>
            {cp.autonomy.reason && <div className="muted small" style={{ marginTop: 10 }}>{cp.autonomy.limit} · {cp.autonomy.reason}</div>}
          </div>
        ))}
      </div>

      <div className="row">
        <section className="glass grow" style={{ paddingBottom: 6 }}>
          <div className="pad" style={{ paddingBottom: 8 }}>
            <SectionTitle right={<Link href={`${p}/agent`} className="small">Ouvrir l&apos;agent →</Link>}>Activité de l&apos;agent et du noyau</SectionTitle>
          </div>
          {activity.map((t) => (
            <div key={t.id} className="ev" style={{ gridTemplateColumns: "52px 110px minmax(0,1fr)" }}>
              <span className="mono muted">{hhmm(t.at)}</span>
              <span><Chip cls={(ACT[t.actor] ?? ACT.platform).cls} sm>{t.badge ?? (ACT[t.actor] ?? ACT.platform).label}</Chip></span>
              <span>{t.title}</span>
            </div>
          ))}
        </section>
        <section className="glass pad side">
          <SectionTitle>Zones rouvertes depuis la mise en service</SectionTitle>
          <div className="stack">
            {s.reopenedZones.map((z) => (
              <Link key={z.zoneId + z.reason} href={zoneIds.has(z.zoneId) ? `${p}/zones/${z.zoneId}/inventory` : `${p}/zones`} className="card">
                <div className="between"><b style={{ fontWeight: 500 }}>{z.name}</b><Chip cls="u" sm>{z.reason}</Chip></div>
                <div className="muted small" style={{ marginTop: 4 }}>{z.detail}</div>
              </Link>
            ))}
          </div>
          <div className="muted small" style={{ marginTop: 12 }}>
            Décisions et résultats précédents restent dans la <Link href={`${p}/proofs/timeline`}>chronologie</Link>.
          </div>
        </section>
      </div>
    </main>
  );
}
