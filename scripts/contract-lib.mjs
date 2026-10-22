/**
 * Vérification du contrat, partagée par :
 *  - tests/contract.test.ts       (faux backend, en mémoire)
 *  - scripts/contract-check.mjs   (vrai backend Standard, par HTTP)
 *
 * Chaque réponse est validée contre contract/openapi.yaml (JSON Schema 2020-12).
 * Les identifiants sont découverts depuis les listes : aucun id de démo n'est requis côté backend.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SPEC_PATH = fileURLToPath(new URL("../contract/openapi.yaml", import.meta.url));

export function loadSpec() {
  return yaml.load(readFileSync(SPEC_PATH, "utf8"));
}

export function buildValidator(spec = loadSpec()) {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const rewritten = JSON.parse(JSON.stringify({ components: spec.components }).replaceAll('"#/components/', '"spec#/components/'));
  ajv.addSchema({ $id: "spec", ...rewritten });

  const ops = [];
  for (const [tpl, item] of Object.entries(spec.paths)) {
    const re = new RegExp("^" + tpl.replace(/\{[^}]+\}/g, "[^/]+") + "$");
    for (const [method, op] of Object.entries(item)) {
      if (method === "parameters") continue;
      ops.push({ tpl, re, method: method.toUpperCase(), op });
    }
  }
  const cache = new Map();

  function responseSchema(method, path, status) {
    const clean = path.split("?")[0];
    const found = ops.find((o) => o.method === method && o.re.test(clean));
    if (!found) return { error: `opération absente du contrat : ${method} ${clean}` };
    let res = found.op.responses[String(status)] ?? found.op.responses.default;
    if (!res) return { error: `statut ${status} non prévu pour ${method} ${found.tpl}` };
    if (res.$ref) res = res.$ref.split("/").slice(1).reduce((o, k) => o[k], spec);
    const content = res.content ?? {};
    const [type, media] = Object.entries(content)[0] ?? [];
    return { op: found, type, schema: media?.schema };
  }

  /** Valide un corps déjà parsé. Renvoie une liste d'erreurs lisibles (vide = conforme). */
  function validate(method, path, status, body) {
    const r = responseSchema(method, path, status);
    if (r.error) return [r.error];
    if (!r.schema) return [];
    const key = `${r.op.method} ${r.op.tpl} ${status}`;
    let fn = cache.get(key);
    if (!fn) {
      const s = JSON.parse(JSON.stringify(r.schema).replaceAll('"#/components/', '"spec#/components/'));
      fn = ajv.compile(s);
      cache.set(key, fn);
    }
    if (fn(body)) return [];
    return fn.errors.map((e) => `${key} · ${e.instancePath || "(racine)"} ${e.message}${e.params?.allowedValues ? ` ${JSON.stringify(e.params.allowedValues)}` : ""}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ""}`);
  }

  return { validate, responseSchema, operations: ops };
}

/**
 * Parcourt l'API comme le ferait la console.
 * `call(method, path, body?)` → { status, contentType, body } (corps JSON parsé, ou premier événement SSE).
 * Renvoie la liste des cas vérifiés : { method, path, status, errors }.
 */
export async function exercise({ call, validator, product = "lumen", writes = true, onCase }) {
  const p = `/products/${product}`;
  const results = [];
  const check = async (method, path, body, expect) => {
    const res = await call(method, path, body);
    const errors = [];
    if (expect && !expect.includes(res.status)) errors.push(`statut ${res.status}, attendu ${expect.join(" ou ")}`);
    if (res.contentType?.includes("event-stream")) {
      if (res.body) errors.push(...validator.validate(method, path, res.status, res.body).map((e) => `SSE ${e}`));
      else errors.push("SSE : aucun événement reçu");
    } else {
      errors.push(...validator.validate(method, path, res.status, res.body));
    }
    const r = { method, path, status: res.status, errors };
    results.push(r);
    onCase?.(r);
    return res.body;
  };
  const get = (path) => check("GET", path, undefined, [200]);

  await get(`${p}/run/summary`);
  await get(`${p}/components`);
  await get(`${p}/live/snapshot`);
  await get(`${p}/live/stream`);
  const refusals = await get(`${p}/refusals?windowHours=24`);
  const trace = refusals?.items?.find((x) => x.sampleTrace)?.sampleTrace;
  if (trace) await get(`${p}/traces/${trace}`);
  const decisions = await get(`${p}/decisions?status=all`);
  await get(`${p}/decisions`);
  const guarantees = await get(`${p}/guarantees`);
  for (const g of (guarantees?.items ?? []).slice(0, 3)) await get(`${p}/guarantees/${g.id}/chain`);
  await get(`${p}/gaps`);
  await get(`${p}/timeline`);
  await get(`${p}/timeline?actor=agent`);
  await get(`${p}/journal/integrity`);
  for (const fw of ["iso27001", "dora", "nis2"]) await get(`${p}/compliance/${fw}`);
  const exports = await get(`${p}/exports`);
  if (exports?.items?.[0]) await get(`${p}/exports/${exports.items[0].id}`);
  const missions = await get(`${p}/missions`);
  let candidate;
  for (const m of (missions?.items ?? []).slice(0, 4)) {
    const d = await get(`${p}/missions/${m.id}`);
    candidate ??= d?.candidateId;
  }
  if (candidate) await get(`${p}/candidates/${candidate}`);
  await get(`${p}/agent/metrics`);
  await get(`${p}/agent/autonomy`);
  await get(`${p}/agent/models`);
  const zones = await get(`${p}/zones`);
  const zone = zones?.items?.[0]?.id;
  let inventory;
  let transfers;
  if (zone) {
    const z = `${p}/zones/${zone}`;
    inventory = await get(`${z}/inventory`);
    await get(`${z}/dossier`);
    await get(`${z}/policy`);
    await get(`${z}/policy/shadow-refusals`);
    await get(`${z}/verification`);
    transfers = await get(`${z}/transfers`);
  }
  await check("GET", `${p}/traces/__absent__`, undefined, [404]);

  if (writes) {
    const challenge = await check("POST", `/auth/gesture-challenge`, { purpose: "contract-check" }, [200]);
    const signature = { type: "webauthn", assertion: `demo.${challenge?.challenge ?? "x"}` };
    const open = decisions?.items?.find((d) => d.status === "open");
    if (open) {
      await check("POST", `${p}/decisions/${open.id}/resolve`, { optionId: open.options[0].id }, [400, 401, 422]);
      await check("POST", `${p}/decisions/${open.id}/resolve`, { optionId: open.options[0].id, signature }, [202]);
    }
    await check("POST", `${p}/exports`, { format: "audit_bundle", framework: "iso27001" }, [202]);
    const created = await check("POST", `${p}/missions`, { prompt: "Vérification du contrat", zoneId: zone }, [201]);
    if (created?.id) await check("POST", `${p}/missions/${created.id}/messages`, { text: "ok" }, [202]);
    const item = inventory?.items?.[0];
    if (item) await check("PATCH", `${p}/inventory/${item.id}`, { action: "confirm" }, [200]);
    if (zone) await check("POST", `${p}/zones/${zone}/policy/proposals`, { kind: "keep_refused", route: "GET /contract-check" }, [202]);
    const fm = transfers?.failModes?.[0];
    if (fm) await check("PUT", `${p}/routes/fail-mode`, { route: fm.route, mode: fm.mode, signature }, [202]);
    await check("POST", `${p}/journal/verify`, undefined, [202]);
  }
  return results;
}

/** Lit un flux SSE jusqu'au premier `data:` et renvoie l'objet parsé (ou null). */
export async function firstSseEvent(response, timeoutMs = 8000) {
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise((r) => setTimeout(() => r({ value: undefined, done: false }), Math.max(0, deadline - Date.now()))),
      ]);
      if (done) break;
      if (value) buf += dec.decode(value, { stream: true });
      const m = /^data: (.*)$/m.exec(buf);
      if (m) return JSON.parse(m[1]);
    }
    return null;
  } finally {
    reader.cancel().catch(() => {});
  }
}
