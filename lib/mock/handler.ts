/**
 * Faux backend Standard : implémente contract/openapi.yaml avec les données de fixtures.ts.
 * Utilisé quand STANDARD_API_URL est vide. Aucun état durable : un redémarrage remet tout à zéro.
 */
import * as F from "./fixtures";
import type * as T from "@/lib/api/types";

let seq = 100;
type Params = Record<string, string>;
type Ctx = { params: Params; query: URLSearchParams; body: unknown; signal?: AbortSignal };
type Route = { method: string; pattern: RegExp; keys: string[]; run: (c: Ctx) => Response | Promise<Response> };

const routes: Route[] = [];
function on(method: string, path: string, run: Route["run"]) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" + path.replace(/\{(\w+)\}/g, (_, k) => (keys.push(k), "([^/]+)")) + "/?$",
  );
  routes.push({ method, pattern, keys, run });
}

/**
 * Les fixtures sont datées autour du 22 oct. 01:42 (Paris). Pour que la démo reste « en direct »,
 * chaque horodatage de fixture est décalé de (maintenant − ancre) au moment de la réponse.
 */
const ANCHOR = Date.parse("2026-10-22T01:42:30+02:00");
const FIXTURE_TS = /^2026-10-\d\dT\d\d:\d\d:\d\d\+02:00$/;
const rebase = (_k: string, v: unknown) =>
  typeof v === "string" && FIXTURE_TS.test(v) ? new Date(Date.parse(v) + (Date.now() - ANCHOR)).toISOString() : v;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, rebase), { status, headers: { "content-type": "application/json" } });
const problem = (status: number, title: string, detail?: string) =>
  new Response(JSON.stringify({ title, status, ...(detail ? { detail } : {}) }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
const notFound = (what: string) => problem(404, "Introuvable", what);

/**
 * État mutable partagé via globalThis : le route handler /api/v1 et les composants serveur
 * peuvent être des instances de module distinctes, ils doivent voir les mêmes écritures.
 */
type Store = {
  journalEntry: number;
  decisions: T.Decision[];
  exports: T.ExportJob[];
  missions: T.MissionDetail[];
  inventory: T.Inventory;
  failModes: T.FailMode[];
  relay: T.Schemas["Relay"];
  listeners: Set<(e: T.LiveEvent) => void>;
};
const g = globalThis as typeof globalThis & { __standardMock?: Store };
const db: Store = (g.__standardMock ??= {
  journalEntry: F.journalIntegrity.entries,
  decisions: structuredClone(F.decisions),
  exports: structuredClone(F.exportsList),
  missions: structuredClone(F.missions),
  inventory: structuredClone(F.inventory),
  failModes: structuredClone(F.failModes),
  relay: structuredClone(F.liveSnapshot.relay),
  listeners: new Set(),
});

/** Événements réels (gestes faits dans la console) poussés dans tous les flux SSE ouverts. */
function emit(e: Omit<T.LiveEvent, "id" | "at">, delayMs = 0) {
  const fire = () => {
    const ev: T.LiveEvent = { id: `x${++seq}`, at: new Date().toISOString(), ...e };
    db.listeners.forEach((l) => l(ev));
  };
  if (delayMs) setTimeout(fire, delayMs);
  else fire();
}

/** Boucle un relais IA ↔ humain : il passe de « attend » à « fait », avec ce qu'il a débloqué. */
function closeHandoff(pred: (h: T.Schemas["Handoff"]) => boolean, by: string, unblocked: string, journal?: T.Schemas["JournalRef"]) {
  const i = db.relay.waiting.findIndex(pred);
  if (i < 0) return null;
  const [h] = db.relay.waiting.splice(i, 1);
  const done = { ...h, status: "done" as const, at: new Date().toISOString(), by, unblocked, ...(journal ? { journal } : {}) };
  db.relay.recent.unshift(done);
  db.relay.humanGestures += 1;
  return done;
}
const hash = () => {
  const h = Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return `${h.slice(0, 4)}…${h.slice(4, 8)}`;
};
function receipt(createdRef?: T.Schemas["ObjectRef"]): T.GestureReceipt {
  db.journalEntry += 1;
  return { journal: { entry: db.journalEntry, hash: hash() }, ...(createdRef ? { createdRef } : {}) };
}
function requireSignature(body: unknown): Response | null {
  const sig = (body as { signature?: { type?: string; assertion?: string } } | null)?.signature;
  if (!sig || sig.type !== "webauthn" || !sig.assertion) {
    return problem(401, "Geste signé requis", "Cette action exige une signature WebAuthn.");
  }
  return null;
}
const product = (p: Params) => (p.product === F.PRODUCT ? null : notFound(`produit ${p.product}`));

/* ---------- Run ---------- */
on("GET", "/products/{product}/run/summary", ({ params }) => product(params) ?? json(F.runSummary));
on("GET", "/products/{product}/topology", ({ params }) => product(params) ?? json(F.topology));
on("GET", "/products/{product}/components", ({ params }) => product(params) ?? json({ items: F.components }));
on("GET", "/products/{product}/live/snapshot", ({ params }) =>
  product(params) ?? json({ ...F.liveSnapshot, relay: db.relay }),
);
on("GET", "/products/{product}/live/stream", ({ params, signal }) => product(params) ?? sse(F.liveScript, signal));
on("GET", "/products/{product}/traces/{trace}", ({ params }) => {
  const t = F.traces[params.trace];
  return product(params) ?? (t ? json(t) : notFound(`trace ${params.trace}`));
});
on("GET", "/products/{product}/refusals", ({ params, query }) =>
  product(params) ?? json({ windowHours: Number(query.get("windowHours") ?? 24), items: F.refusals }),
);

/* ---------- À décider ---------- */
const decisions = db.decisions;
on("GET", "/products/{product}/decisions", ({ params, query }) => {
  const status = query.get("status") ?? "open";
  const items = status === "all" ? decisions : decisions.filter((d) => d.status === status);
  return product(params) ?? json({ items, agentDecided: F.agentDecided });
});
on("POST", "/products/{product}/decisions/{decision}/resolve", ({ params, body }) => {
  const d = decisions.find((x) => x.id === params.decision);
  if (!d) return notFound(`décision ${params.decision}`);
  const bad = requireSignature(body);
  if (bad) return bad;
  const optionId = (body as T.Schemas["DecisionResolution"]).optionId;
  if (!d.options.some((o) => o.id === optionId)) return problem(422, "Option inconnue", optionId);
  d.status = "resolved";
  const label = d.options.find((o) => o.id === optionId)?.label ?? optionId;
  const rec = receipt({ kind: "decision", id: d.id });
  const h = closeHandoff((x) => x.ref?.kind === "decision" && x.ref.id === d.id, "vous", `« ${label} » signé · l'agent reprend`, rec.journal);
  emit({ type: "human.gesture", actor: "human", tag: "vous", tone: "info", summary: `Signé : « ${label} » · ${d.title}`, ref: { kind: "decision", id: d.id }, journal: rec.journal, node: "kernel" });
  emit({ type: "agent.step", actor: "agent", tag: "agent", tone: "agent", summary: h?.blocking ? `Débloqué par votre décision : reprise de « ${d.title} »` : `Décision intégrée : ${label}`, ref: { kind: "decision", id: d.id }, node: "sandbox" }, 2500);
  return json(rec, 202);
});

/* ---------- Preuves ---------- */
on("GET", "/products/{product}/guarantees", ({ params }) => {
  const counts: T.Schemas["StateCounts"] = { qualifie: 0, observe: 0, propose: 0, inconnu: 0, non_couvert: 0 };
  for (const g of F.guarantees) if (g.state in counts) counts[g.state as keyof typeof counts] += 1;
  return product(params) ?? json({ counts, items: F.guarantees });
});
on("GET", "/products/{product}/guarantees/{guarantee}/chain", ({ params }) => {
  const g = F.guarantees.find((x) => x.id === params.guarantee);
  const c = F.proofChains[params.guarantee] ?? (g ? syntheticChain(g) : undefined);
  return product(params) ?? (c ? json(c) : notFound(`chaîne ${params.guarantee}`));
});
/** Chaîne déduite de l'état quand les fixtures n'en décrivent pas une à la main. */
function syntheticChain(g: T.Guarantee): T.ProofChain {
  const stages = ["resource", "probe", "capture", "instrument", "observation", "fact", "guarantee"] as const;
  const reached = { qualifie: 7, observe: 5, propose: 1, inconnu: 2, non_couvert: 0, non_etaye: 0, hors_standard: 0 }[g.state];
  const label = (st: (typeof stages)[number], i: number) =>
    i >= reached ? "—" : ({ resource: g.path, probe: g.instrument, capture: `fenêtre ${g.window}`, instrument: g.instrument, observation: g.value ?? g.freshness, fact: `admis · ${g.release ?? "r-212"}`, guarantee: "Qualifiée" } as const)[st];
  return {
    guaranteeId: g.id,
    title: g.title,
    links: stages.map((st, i) => ({
      stage: st,
      label: st === "guarantee" && reached < 7 ? ({ observe: "Observée", propose: "Proposée", inconnu: "Inconnue", non_couvert: "Non couverte" } as Record<string, string>)[g.state] ?? "—" : label(st, i),
      status: i < reached ? "ok" : i === reached && g.state === "non_couvert" ? "broken" : st === "guarantee" ? "unknown" : "pending",
    })),
    lastQualified: null,
  };
}
on("GET", "/products/{product}/gaps", ({ params }) =>
  product(params) ?? json({ items: F.gaps, outsideStandard: F.frontiers }),
);
on("GET", "/products/{product}/timeline", ({ params, query }) => {
  const actor = query.get("actor");
  const items = actor ? F.timeline.filter((t) => t.actor === actor) : F.timeline;
  return product(params) ?? json({ items, nextCursor: null });
});
on("GET", "/products/{product}/journal/integrity", ({ params }) =>
  product(params) ?? json({ ...F.journalIntegrity, entries: db.journalEntry }),
);
on("POST", "/products/{product}/journal/verify", ({ params }) =>
  product(params) ?? json({ ...F.journalIntegrity, entries: db.journalEntry }, 202),
);
on("GET", "/products/{product}/compliance/{framework}", ({ params }) => {
  const c = F.compliance[params.framework];
  return product(params) ?? (c ? json(c) : notFound(`référentiel ${params.framework}`));
});
const exportsList = db.exports;
on("GET", "/products/{product}/exports", ({ params }) => product(params) ?? json({ items: exportsList }));
on("POST", "/products/{product}/exports", ({ params, body }) => {
  const req = body as T.Schemas["ExportRequest"] | null;
  if (!req?.format) return problem(422, "Format requis");
  const job: T.ExportJob = {
    id: `x-${Math.floor(1000 + Math.random() * 8999)}`,
    format: req.format,
    status: "ready",
    createdAt: new Date().toISOString(),
    release: "r-212",
    url: "#",
    sha256: hash(),
    includesGaps: true,
  };
  exportsList.unshift(job);
  return product(params) ?? json(job, 202);
});
on("GET", "/products/{product}/exports/{export}", ({ params }) => {
  const x = exportsList.find((e) => e.id === params.export);
  return product(params) ?? (x ? json(x) : notFound(`export ${params.export}`));
});

/* ---------- Agent ---------- */
const missions = db.missions;
const summary = (m: T.MissionDetail): T.Mission => {
  const out: T.Mission = { id: m.id, title: m.title, kind: m.kind, status: m.status, zoneId: m.zoneId, branch: m.branch, model: m.model, startedAt: m.startedAt };
  for (const k of ["external", "costEur", "agentMinutes", "pendingDecisionId"] as const) if (m[k] !== undefined) Object.assign(out, { [k]: m[k] });
  return out;
};
on("GET", "/products/{product}/missions", ({ params }) =>
  product(params) ?? json({ items: missions.map(summary) }),
);
on("POST", "/products/{product}/missions", ({ params, body }) => {
  const req = body as T.Schemas["MissionCreate"] | null;
  if (!req?.prompt || req.prompt.length < 3) return problem(422, "Consigne trop courte");
  const m: T.MissionDetail = {
    id: `m-${130 + missions.length}`,
    title: req.prompt.slice(0, 80),
    kind: "feature",
    status: "running",
    zoneId: req.zoneId ?? "playlists",
    branch: `mission/m-${130 + missions.length}`,
    model: "Qwen 72B auto-hébergé",
    startedAt: new Date().toISOString(),
    messages: [{ id: "mm1", role: "human", at: new Date().toISOString(), text: req.prompt }],
    plan: [{ key: "spec", label: "Spec", status: "running", detail: "Lecture de la zone" }],
    context: missions[0].context,
  };
  missions.unshift(m);
  return product(params) ?? json(summary(m), 201);
});
on("GET", "/products/{product}/missions/{mission}", ({ params }) => {
  const m = missions.find((x) => x.id === params.mission);
  return product(params) ?? (m ? json(m) : notFound(`mission ${params.mission}`));
});
on("POST", "/products/{product}/missions/{mission}/messages", ({ params, body }) => {
  const m = missions.find((x) => x.id === params.mission);
  if (!m) return notFound(`mission ${params.mission}`);
  const req = (body ?? {}) as { text?: string; actionId?: string };
  if (!req.text && !req.actionId) return problem(422, "Texte ou action requis");
  const msg: T.MissionMessage = {
    id: `mm${m.messages.length + 1}`,
    role: "human",
    at: new Date().toISOString(),
    text: req.text ?? m.messages.flatMap((x) => x.actions ?? []).find((a) => a.id === req.actionId)?.label ?? req.actionId,
  };
  m.messages.push(msg);
  // Réponse simulée de l'agent : le vrai backend la pousse via /missions/{id}/stream.
  m.messages.push({
    id: `mm${m.messages.length + 1}`,
    role: "agent",
    at: new Date(Date.now() + 1500).toISOString(),
    text: req.actionId
      ? `Compris : « ${msg.text} ». Je m'en occupe dans le bac ; l'avancement apparaît dans le plan et dans En direct.`
      : "Noté. Je l'intègre à la mission et je reviens vers vous si une décision métier en découle.",
  });
  const done = closeHandoff((h) => h.missionId === m.id && h.direction === "agent_to_human", "vous", `« ${msg.text} » · ${m.id} reprend dans son bac`);
  emit({ type: "human.gesture", actor: "human", tag: "vous → " + m.id, tone: "info", summary: `Réponse à l'agent : « ${msg.text} »`, ref: { kind: "mission", id: m.id }, node: "sandbox" });
  if (done) emit({ type: "agent.step", actor: "agent", tag: "bac " + m.id, tone: "agent", summary: "Reprise : application de votre choix", ref: { kind: "mission", id: m.id }, node: "sandbox" }, 2500);
  if (req.actionId && m.status === "awaiting_decision") {
    m.status = "running";
    const rel = m.plan.find((s) => s.key === "release");
    if (rel) Object.assign(rel, { status: "running", detail: `Choix humain : ${msg.text}` });
  }
  return product(params) ?? json(msg, 202);
});
on("GET", "/products/{product}/missions/{mission}/stream", ({ params, signal }) => {
  const script = F.liveScript.filter((e) => e.ref?.id === params.mission || e.actor === "agent");
  return product(params) ?? sse(script.length ? script : F.liveScript, signal);
});
on("GET", "/products/{product}/candidates/{candidate}", ({ params }) => {
  const c = F.candidates[params.candidate];
  return product(params) ?? (c ? json(c) : notFound(`candidat ${params.candidate}`));
});
on("GET", "/products/{product}/agent/metrics", ({ params }) => product(params) ?? json(F.agentMetrics));
on("GET", "/products/{product}/agent/autonomy", ({ params }) => product(params) ?? json({ items: F.autonomyLadder }));
on("GET", "/products/{product}/agent/models", ({ params }) => product(params) ?? json({ items: F.modelRoutes }));

/* ---------- Zones ---------- */
const zoneGuard = (p: Params) =>
  product(p) ?? (F.zones.some((z) => z.id === p.zone) ? null : notFound(`zone ${p.zone}`));
const forZone = <X extends { zoneId: string }>(p: Params, x: X) => zoneGuard(p) ?? json({ ...x, zoneId: p.zone });

on("GET", "/products/{product}/zones", ({ params }) =>
  product(params) ?? json({ items: F.zones, sharedDependencies: F.sharedDependencies }),
);
const inventory = db.inventory;
on("GET", "/products/{product}/zones/{zone}/inventory", ({ params }) => forZone(params, inventory));
on("PATCH", "/products/{product}/inventory/{item}", ({ params, body }) => {
  const it = inventory.items.find((i) => i.id === params.item);
  if (!it) return notFound(`élément ${params.item}`);
  const action = (body as T.Schemas["InventoryPatch"] | null)?.action;
  if (action === "confirm") Object.assign(it, { state: "observe", stateLabel: "Confirmé" });
  else if (action === "discard") Object.assign(it, { state: "hors_standard", stateLabel: "Écarté par un humain" });
  else if (action === "outside_repo") Object.assign(it, { state: "hors_standard", stateLabel: "Hors dépôt" });
  else if (action === "provide_source") Object.assign(it, { state: "propose", stateLabel: "Source fournie" });
  else if (action === "correct") Object.assign(it, { state: "propose", stateLabel: "Corrigé" });
  else return problem(422, "Action inconnue");
  delete it.unsupported; // un humain a tranché : l'élément n'est plus « non étayé »
  return product(params) ?? json(it);
});
on("GET", "/products/{product}/zones/{zone}/dossier", ({ params }) => forZone(params, F.dossier));
on("GET", "/products/{product}/zones/{zone}/policy", ({ params }) => forZone(params, F.policy));
on("GET", "/products/{product}/zones/{zone}/policy/shadow-refusals", ({ params }) =>
  zoneGuard(params) ?? json(F.shadowRefusals),
);
on("POST", "/products/{product}/zones/{zone}/policy/proposals", ({ params, body }) => {
  if (!(body as T.Schemas["PolicyProposal"] | null)?.kind) return problem(422, "Type de proposition requis");
  return zoneGuard(params) ?? json(receipt({ kind: "decision", id: "d-law-v14" }), 202);
});
on("GET", "/products/{product}/zones/{zone}/verification", ({ params }) => forZone(params, F.verification));
const failModes = db.failModes;
on("GET", "/products/{product}/zones/{zone}/transfers", ({ params }) =>
  zoneGuard(params) ?? json({ items: F.transfers, failModes }),
);
on("PUT", "/products/{product}/routes/fail-mode", ({ params, body }) => {
  const bad = requireSignature(body);
  if (bad) return bad;
  const req = body as T.Schemas["FailModeUpdate"];
  const fm = failModes.find((f) => f.route === req.route);
  if (!fm) return notFound(`route ${req.route}`);
  fm.mode = req.mode;
  return product(params) ?? json(receipt(), 202);
});

/* ---------- Auth ---------- */
on("POST", "/auth/gesture-challenge", ({ body }) => {
  if (!(body as { purpose?: string } | null)?.purpose) return problem(422, "Geste visé requis");
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const challenge = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return json({ challenge, rpId: "standard.demo.invalid", expiresAt: new Date(Date.now() + 120_000).toISOString(), allowCredentials: [] });
});

/* ---------- SSE ---------- */
function sse(script: Omit<T.LiveEvent, "id" | "at">[], signal?: AbortSignal): Response {
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let i = 0;
  let unsubscribe = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => {
        const ev: T.LiveEvent = { id: `e${++seq}`, at: new Date().toISOString(), ...script[i++ % script.length] };
        try {
          controller.enqueue(enc.encode(`id: ${ev.id}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`));
        } catch {
          clearInterval(timer);
        }
      };
      const push = (ev: T.LiveEvent) => {
        try {
          controller.enqueue(enc.encode(`id: ${ev.id}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`));
        } catch {
          db.listeners.delete(push);
        }
      };
      unsubscribe = () => db.listeners.delete(push);
      db.listeners.add(push);
      controller.enqueue(enc.encode(": flux Standard (démo)\nretry: 3000\n\n"));
      timer = setInterval(send, 2600);
      signal?.addEventListener("abort", () => {
        clearInterval(timer);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(timer);
      unsubscribe();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}

/* ---------- Entrée ---------- */
/** `path` est relatif à /api/v1 (ex. "/products/lumen/run/summary"). */
export async function handleMock(req: Request, path: string): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  let matchedPath = false;
  for (const r of routes) {
    const m = r.pattern.exec(path);
    if (!m) continue;
    matchedPath = true;
    if (r.method !== method) continue;
    const params: Params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    let body: unknown = null;
    if (method !== "GET" && method !== "HEAD") {
      const text = await req.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          return problem(400, "Corps JSON invalide");
        }
      }
    }
    return r.run({ params, query: url.searchParams, body, signal: req.signal });
  }
  return matchedPath ? problem(405, "Méthode non permise") : problem(404, "Route inconnue", path);
}
