"use client";
import Link from "next/link";
import type { Handoff, Relay } from "@/lib/api/types";
import { refHref } from "@/lib/refs";
import { duration, hhmm } from "@/lib/format";

const VERB: Record<string, string> = { question: "a répondu à l'agent", decision: "a décidé", review: "a relu", instruction: "a demandé à l'agent", gesture: "a signé" };
const KIND: Record<string, string> = { question: "Question", decision: "Décision", review: "Relecture", instruction: "Consigne", gesture: "Geste" };

function since(iso: string, now: number) {
  return duration(Math.max(0, (now - Date.parse(iso)) / 1000)).replace(/ \d+ s$/, "");
}

function Waiting({ h, product, now }: { h: Handoff; product: string; now: number }) {
  const toHuman = h.direction === "agent_to_human";
  return (
    <div className="card" style={{ borderColor: h.blocking ? "rgba(251,191,36,.4)" : undefined, boxShadow: h.blocking ? "0 0 24px -10px rgba(251,191,36,.6)" : undefined }}>
      <div className="between small">
        <span className="flex" style={{ gap: 6 }}>
          <span className={toHuman ? "c-agent" : "c-info"}>{h.by}</span>
          <span className="muted">· {KIND[h.kind ?? "question"]}</span>
        </span>
        <span className="mono muted">depuis {since(h.at, now)}</span>
      </div>
      <div style={{ marginTop: 6, fontWeight: 500 }}>{h.title}</div>
      {h.detail && <div className="muted small" style={{ marginTop: 2 }}>{h.detail}</div>}
      <div className="between" style={{ marginTop: 10 }}>
        {h.blocking ? <span className="chip u sm"><span className="dot" />{h.missionId ? `bloque ${h.missionId}` : "bloque l'agent"}</span> : <span className="chip p sm">non bloquant</span>}
        {toHuman && h.ref && <Link className="btn sm primary" href={refHref(product, h.ref)}>Répondre</Link>}
        {!toHuman && h.ref && <Link className="btn sm" href={refHref(product, h.ref)}>Suivre</Link>}
      </div>
    </div>
  );
}

/** Schéma IA ⇄ humain : deux pôles, les relais en attente dans chaque sens, ce que chacun fait seul. */
function Bridge({ relay, paused }: { relay: Relay; paused: boolean }) {
  const toHuman = relay.waiting.filter((h) => h.direction === "agent_to_human").length;
  const toAgent = relay.waiting.filter((h) => h.direction === "human_to_agent").length;
  return (
    <svg viewBox="0 0 320 150" width="100%" style={{ maxWidth: 360, display: "block", margin: "0 auto" }} role="img" aria-label={`L'agent attend ${toHuman} réponse(s) de vous, vous attendez ${toAgent} action(s) de l'agent`}>
      <defs>
        <radialGradient id="rg-ai"><stop offset="0" stopColor="#c4b5fd" stopOpacity=".55" /><stop offset="1" stopColor="#c4b5fd" stopOpacity="0" /></radialGradient>
        <radialGradient id="rg-h"><stop offset="0" stopColor="#93c5fd" stopOpacity=".55" /><stop offset="1" stopColor="#93c5fd" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="56" cy="75" r="50" fill="url(#rg-ai)" />
      <circle cx="264" cy="75" r="50" fill="url(#rg-h)" />
      <circle cx="56" cy="75" r="28" fill="rgba(5,6,10,.85)" stroke="#c4b5fd" strokeWidth="1.5" />
      <circle cx="264" cy="75" r="28" fill="rgba(5,6,10,.85)" stroke="#93c5fd" strokeWidth="1.5" />
      <text x="56" y="80" textAnchor="middle" fill="#c4b5fd" fontSize="15" fontWeight="600">IA</text>
      <text x="264" y="80" textAnchor="middle" fill="#93c5fd" fontSize="13" fontWeight="600">Vous</text>
      <path id="up" d="M88 62 C 140 30, 180 30, 232 62" fill="none" stroke="#fcd34d" strokeWidth="1.6" strokeDasharray="5 6" className={paused ? undefined : "dash"} opacity={toHuman ? 1 : 0.25} />
      <path d="M232 90 C 180 120, 140 120, 88 90" fill="none" stroke="#93c5fd" strokeWidth="1.6" strokeDasharray="5 6" className={paused ? undefined : "dash"} opacity={toAgent ? 1 : 0.25} />
      <polygon points="232,62 222,58 226,67" fill="#fcd34d" opacity={toHuman ? 1 : 0.25} />
      <polygon points="88,90 98,94 94,85" fill="#93c5fd" opacity={toAgent ? 1 : 0.25} />
      <text x="160" y="28" textAnchor="middle" fill="#fcd34d" fontSize="11">{toHuman} attente{toHuman > 1 ? "s" : ""} pour vous</text>
      <text x="160" y="134" textAnchor="middle" fill="#93c5fd" fontSize="11">{toAgent} consigne{toAgent > 1 ? "s" : ""} en cours</text>
    </svg>
  );
}

export function RelayPanel({ relay, product, now, paused }: { relay: Relay; product: string; now: number; paused: boolean }) {
  const forHuman = relay.waiting.filter((h) => h.direction === "agent_to_human").sort((a, b) => Number(!!b.blocking) - Number(!!a.blocking));
  const forAgent = relay.waiting.filter((h) => h.direction === "human_to_agent");
  return (
    <section className="glass pad" aria-label="Relais IA et humain">
      <div className="between" style={{ marginBottom: 14 }}>
        <div>
          <div className="label">Relais IA ↔ humain · {relay.windowHours} h</div>
          <div style={{ fontSize: 18, marginTop: 6 }}>Qui attend qui, et ce que chacun fait seul</div>
        </div>
        <div className="flex small">
          <span className="chip v"><span className="dot" />{relay.autonomous.count} actions de l&apos;agent, seul</span>
          <span className="chip o"><span className="dot" />{relay.humanGestures} gestes humains</span>
          {relay.medianWaitSeconds != null && <span className="chip p">réponse humaine médiane {duration(relay.medianWaitSeconds)}</span>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
        <div className="stack" style={{ gap: 10 }}>
          <div className="label c-warn">L&apos;agent attend de vous · {forHuman.length}</div>
          {forHuman.length === 0 && <div className="card muted">Rien : l&apos;agent n&apos;attend personne.</div>}
          {forHuman.map((h) => <Waiting key={h.id} h={h} product={product} now={now} />)}
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <Bridge relay={relay} paused={paused} />
          <div className="card small">
            <div className="label c-agent" style={{ marginBottom: 6 }}>Fait par l&apos;agent, dans ses droits</div>
            {relay.autonomous.examples.map((x) => <div key={x} style={{ padding: "3px 0" }}>✓ {x}</div>)}
          </div>
          {forAgent.map((h) => <Waiting key={h.id} h={h} product={product} now={now} />)}
        </div>
        <div className="stack" style={{ gap: 0 }}>
          <div className="label" style={{ marginBottom: 10 }}>Relais bouclés</div>
          {relay.recent.slice(0, 5).map((h, i) => (
            <div key={h.id} style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr)", gap: 10, padding: "9px 0", borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
              <span className="mono muted">{hhmm(h.at)}</span>
              <div style={{ minWidth: 0 }}>
                <div className="small">
                  <span className="c-info">{h.by}</span>
                  <span className="muted"> {VERB[h.kind ?? "question"]}</span>
                </div>
                <div style={{ marginTop: 2 }}>{h.title}</div>
                {h.unblocked && <div className="small c-ok" style={{ marginTop: 2 }}>→ {h.unblocked}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
