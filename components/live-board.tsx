"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LiveEvent, LiveSnapshot } from "@/lib/api/types";
import { ago, clock, hhmmss, nf } from "@/lib/format";
import { refHref } from "@/lib/refs";
import { browserApi } from "@/lib/api/browser";
import { RelayPanel } from "@/components/relay";
import { openStream } from "@/lib/stream";

const ACTOR: Record<string, [string, string, string]> = {
  agent: ["IA", "var(--agent)", "Agent"],
  human: ["H", "var(--info)", "Humain"],
  kernel: ["K", "var(--ok)", "Noyau"],
  probe: ["S", "var(--warn)", "Sonde"],
  platform: ["P", "var(--muted)", "Plateforme"],
  change: ["Δ", "var(--warn)", "Changement"],
};

const STEP_ICON: Record<string, [string, string | undefined]> = {
  done: ["✓", undefined],
  running: ["●", "var(--accent)"],
  pending: ["○", undefined],
  refused: ["✕", "var(--bad)"],
  handed_off: ["→", undefined],
};

type Conn = "connecting" | "open" | "lost" | "paused";

/** Applique un événement au snapshot : seuls des changements explicites sont reflétés, le reste va au flux. */
function apply(s: LiveSnapshot, e: LiveEvent): LiveSnapshot {
  const next: LiveSnapshot = { ...s, counters: { ...s.counters } };
  if (e.type === "fact.admitted") next.counters.factsPerHour += 1;
  if (e.type === "probe.result") next.counters.probes15m += 1;
  if (e.type === "probe.result" && e.tone === "ok") next.counters.probesConform += 1;
  if (e.type === "precheck.progress" && e.ref) {
    const m = /(\d+)\s*\/\s*(\d+)/.exec(e.summary);
    if (m) {
      next.prechecks = s.prechecks.map((pc) =>
        pc.candidateId !== e.ref!.id
          ? pc
          : { ...pc, tools: pc.tools.map((t) => (t.tool === "Tests" ? { ...t, detail: `${m[1]}/${m[2]}`, progress: Number(m[1]) / Number(m[2]), status: m[1] === m[2] ? "passed" : "running" } : t)) },
      );
    }
  }
  if (e.type === "judge.verdict" && e.ref) {
    const who = /juge\s*(\d)/i.exec(e.tag)?.[1];
    if (who) {
      next.judgements = s.judgements.map((j) =>
        j.candidateId !== e.ref!.id ? j : { ...j, judges: j.judges.map((x) => (x.name === `Juge ${who}` ? { ...x, status: e.tone === "bad" ? "refused" : e.tone === "ok" ? "conform" : "replaying" } : x)) },
      );
    }
  }
  if (e.type === "release.progress" && s.release) {
    const m = /(\d+)\s*%/.exec(e.summary);
    if (m) next.release = { ...s.release, trafficShare: Number(m[1]) / 100 };
  }
  return next;
}

export function LiveBoard({ product, initial }: { product: string; initial: LiveSnapshot }) {
  const [snap, setSnap] = useState(initial);
  const [events, setEvents] = useState<(LiveEvent & { fresh?: boolean })[]>(initial.events);
  const [conn, setConn] = useState<Conn>("connecting");
  // Même valeur au rendu serveur et à l'hydratation, puis l'horloge réelle prend le relais.
  const [now, setNow] = useState(() => Date.parse(initial.events[0]?.at ?? "1970-01-01T00:00:00Z"));
  const paused = conn === "paused";
  const started = useRef<number | null>(null);
  const p = `/${product}`;

  useEffect(() => {
    if (paused) return;
    return openStream(
      `/products/${encodeURIComponent(product)}/live/stream`,
      (e) => {
        setEvents((prev) => [{ ...e, fresh: true }, ...prev.filter((x) => x.id !== e.id).map((x) => ({ ...x, fresh: false }))].slice(0, 40));
        setSnap((s) => apply(s, e));
        if (e.type === "human.gesture" || e.type === "agent.question") {
          browserApi.GET("/products/{product}/live/snapshot", { params: { path: { product } } }).then(({ data }) => {
            if (data) setSnap((s) => ({ ...s, relay: data.relay }));
          });
        }
      },
      setConn,
    );
  }, [product, paused]);

  useEffect(() => {
    if (paused) return;
    started.current ??= Date.now();
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused]);

  const c = snap.counters;
  const silent = snap.probes.filter((x) => x.status === "silent").length;
  const pc = snap.prechecks[0];
  const elapsed = started.current ? Math.max(0, (now - started.current) / 1000) : 0;

  return (
    <main className={`page${paused ? " paused" : ""}`}>
      <div className="head">
        <div>
          <div className="label">En direct · le système au travail</div>
          <h1>Ce que Standard fait en ce moment</h1>
        </div>
        <div className="flex">
          {conn === "open" && <span className="chip q"><span className="live" style={{ width: 6, height: 6 }} />En direct</span>}
          {conn === "connecting" && <span className="chip o"><span className="busy" style={{ width: 6, height: 6 }} />Connexion…</span>}
          {conn === "lost" && <span className="chip n">Flux interrompu</span>}
          {paused && <span className="chip p">En pause</span>}
          <button className="btn" type="button" onClick={() => setConn(paused ? "connecting" : "paused")}>{paused ? "Reprendre" : "Pause"}</button>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div className="glass kpi"><div className="label">Bacs actifs</div><div className="val">{c.activeSandboxes}</div><div className="sub">dont {c.externalAgents} agent externe</div></div>
        <div className="glass kpi"><div className="label">Précontrôles</div><div className="val">{c.prechecks}</div><div className="sub">{pc ? `en cours · ${clock(pc.elapsedSeconds + elapsed)}` : "aucun"}</div></div>
        <div className="glass kpi"><div className="label">Jugements</div><div className="val">{c.judgements}</div><div className="sub">deux juges indépendants</div></div>
        <div className="glass kpi"><div className="label">Sondes · 15 min</div><div className="val">{c.probes15m}</div><div className="sub">{c.probesConform} conformes{silent ? ` · ${silent} silencieuse` : ""}</div></div>
        <div className="glass kpi"><div className="label">Faits admis · heure</div><div className="val">{nf(c.factsPerHour)}</div><div className="sub">tous signés et chaînés</div></div>
      </div>

      <RelayPanel relay={snap.relay} product={product} now={now} />

      <div className="row">
        <section className="glass pad grow">
          <div className="lane">
            <div>
              <div className="lane-title"><span className="busy" />1 · Bac de l&apos;agent</div>
              <div className="muted small" style={{ marginTop: 4 }}>Code isolé, sans réseau direct, sans secret</div>
            </div>
            <div className="grid3">
              {snap.missions.map((m) => (
                <Link key={m.id} href={refHref(product, { kind: "mission", id: m.id })} className={`card${m.steps.some((s) => s.status === "running") ? " active" : ""}`}>
                  <div className="between"><span className="mono accent">{m.id}</span><span className={`chip sm ${m.external ? "p" : m.badge === "Autonome" ? "q" : "v"}`}>{m.badge}</span></div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 6 }}>{m.title}</div>
                  <div className="muted small" style={{ marginTop: 8, lineHeight: 1.7 }}>
                    {m.steps.map((s, i) => {
                      const [ic, col] = STEP_ICON[s.status] ?? ["·", undefined];
                      return <div key={i} style={col ? { color: col } : undefined}>{ic} {s.label}</div>;
                    })}
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="connector" aria-hidden="true" />

          <div className="lane">
            <div>
              <div className="lane-title"><span className={snap.prechecks.length ? "busy" : "idle"} />2 · Précontrôle</div>
              <div className="muted small" style={{ marginTop: 4 }}>Tests et scanners sur le commit exact</div>
            </div>
            {snap.prechecks.length === 0 ? <div className="card muted">Aucun précontrôle en cours</div> : snap.prechecks.map((x) => (
              <Link key={x.candidateId} href={refHref(product, { kind: "candidate", id: x.candidateId })} className="card active">
                <div className="between"><span><span className="mono accent">{x.missionId}</span> · candidat {x.candidateId}</span><span className="mono muted">{clock(x.elapsedSeconds + elapsed)} / {x.expectedSeconds ? `~${clock(x.expectedSeconds)}` : "—"}</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 14, marginTop: 10 }} className="small">
                  {x.tools.map((t) => (
                    <div key={t.tool}>
                      <div className="between"><span>{t.tool}</span>{t.status === "passed" ? <span className="c-ok">✓</span> : t.status === "failed" ? <span className="c-bad">✕</span> : <span className="mono">{t.detail}</span>}</div>
                      <div className={`bar${t.status === "passed" ? " ok" : ""}`}><span style={{ width: `${Math.round(t.progress * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
          <div className="connector" aria-hidden="true" />

          <div className="lane">
            <div>
              <div className="lane-title"><span className={snap.judgements.length ? "busy" : "idle"} />3 · Jugement</div>
              <div className="muted small" style={{ marginTop: 4 }}>Deux juges indépendants rejouent la loi</div>
            </div>
            {snap.judgements.length === 0 ? <div className="card muted">Aucun jugement en cours</div> : snap.judgements.map((j) => (
              <div key={j.candidateId} className="card active between">
                <div><span className="mono accent">{j.candidateId}</span> · {j.title}</div>
                <div className="flex">
                  {j.judges.map((x) => (
                    <span key={x.name} className={`chip ${x.status === "conform" ? "q" : x.status === "refused" ? "n" : "o"}`}>
                      {x.status === "replaying" ? <span className="busy" style={{ width: 6, height: 6 }} /> : <span className="dot" />}
                      {x.name} · {x.status === "conform" ? "conforme" : x.status === "refused" ? "refus" : "rejeu"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="connector" aria-hidden="true" />

          <div className="lane">
            <div>
              <div className="lane-title"><span className={snap.release ? "live" : "idle"} />4 · Release</div>
              <div className="muted small" style={{ marginTop: 4 }}>Bascule progressive, retour possible</div>
            </div>
            {snap.release ? (
              <div className="card">
                <div className="between"><span><span className="mono accent">{snap.release.id}</span> · {snap.release.strategy}</span><span className="muted small">{snap.release.health}</span></div>
                <div className="bar" style={{ height: 8 }}><span style={{ width: `${snap.release.trafficShare * 100}%` }} /></div>
                <div className="between muted small" style={{ marginTop: 6 }}>
                  <span>{Math.round(snap.release.trafficShare * 100)} % du trafic</span>
                  {snap.release.previous && <span>{snap.release.previous} sert encore {Math.round((1 - snap.release.trafficShare) * 100)} %</span>}
                </div>
              </div>
            ) : <div className="card muted">Aucune release en cours</div>}
          </div>
          <div className="connector" aria-hidden="true" />

          <div className="lane">
            <div>
              <div className="lane-title"><span className="live" />5 · Sondes</div>
              <div className="muted small" style={{ marginTop: 4 }}>Elles essaient sur le réel, en continu</div>
            </div>
            <div className="grid3">
              {snap.probes.map((pr) => {
                const bad = pr.status === "silent" || pr.status === "failed";
                return (
                  <Link key={pr.id} href={pr.guaranteeId ? refHref(product, { kind: "guarantee", id: pr.guaranteeId }) : `${p}/proofs/gaps`} className="probe" style={{ ...(bad ? { borderColor: "rgba(248,113,113,.35)" } : {}), ...(pr.status === "not_covered" ? { opacity: 0.6 } : {}) }}>
                    <span className={pr.status === "ok" ? "live" : bad ? "bad-dot" : "idle"} />
                    <div style={{ minWidth: 0 }}>
                      <div>{pr.label}</div>
                      <div className={`mono ${bad ? "c-bad" : "muted"}`}>
                        {pr.status === "not_covered" ? "non couverte" : pr.status === "silent" ? `silencieuse · ${pr.lastAt ? ago(pr.lastAt, now).replace("il y a ", "") : "jamais"}` : pr.lastAt ? ago(pr.lastAt, now) : "—"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="glass side" style={{ padding: "4px 0", overflow: "hidden" }} aria-live="polite">
          <div className="between" style={{ padding: "14px 18px" }}>
            <div className="label">Flux d&apos;événements</div>
            {conn === "open" ? <span className="chip q"><span className="live" style={{ width: 6, height: 6 }} />live</span> : <span className="chip p">{paused ? "pause" : "hors ligne"}</span>}
          </div>
          {events.slice(0, 14).map((e) => {
            const body = (
              <>
                <span className="mono muted">{hhmmss(e.at)}</span>
                <span className="actor" style={{ color: (ACTOR[e.actor] ?? ACTOR.platform)[1] }} title={(ACTOR[e.actor] ?? ACTOR.platform)[2]}>{(ACTOR[e.actor] ?? ACTOR.platform)[0]}</span>
                <span className={`tag tone-${e.tone ?? "info"}`}>{e.tag}</span>
                <span>{e.summary}{e.journal && <span className="mono muted"> · j#{e.journal.entry}</span>}</span>
              </>
            );
            return e.ref ? (
              <Link key={e.id} href={refHref(product, e.ref)} className={`ev${e.fresh ? " new" : ""}`}>{body}</Link>
            ) : (
              <div key={e.id} className={`ev${e.fresh ? " new" : ""}`}>{body}</div>
            );
          })}
          <div style={{ padding: "12px 18px" }} className="sep">
            <Link href={`${p}/proofs/timeline`} className="accent" style={{ fontSize: 13 }}>Tout est rejouable dans la chronologie →</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
