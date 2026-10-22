#!/usr/bin/env node
/**
 * Vérifie un vrai backend Standard contre contract/openapi.yaml.
 *
 *   STANDARD_API_URL=https://standard.example.com/api/v1 \
 *   STANDARD_SESSION="standard_session=…" \
 *   npm run contract:check -- --product lumen [--writes]
 *
 * Par défaut : lectures seulement. `--writes` exerce aussi les gestes (à réserver à un environnement de test).
 */
import { buildValidator, exercise, firstSseEvent } from "./contract-lib.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const base = (opt("url") ?? process.env.STANDARD_API_URL ?? "").replace(/\/$/, "");
const product = opt("product", process.env.STANDARD_DEFAULT_PRODUCT || "lumen");
const writes = args.includes("--writes");
const cookie = process.env.STANDARD_SESSION;

if (!base) {
  console.error("STANDARD_API_URL (ou --url) est requis, ex. https://standard.example.com/api/v1");
  process.exit(2);
}

async function call(method, path, body) {
  const ctrl = new AbortController();
  const res = await fetch(base + path, {
    method,
    signal: ctrl.signal,
    headers: { accept: "application/json, text/event-stream", ...(cookie ? { cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("event-stream")) return { status: res.status, contentType, body: await firstSseEvent(res) };
    const text = await res.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = { __nonJson: text.slice(0, 200) };
    }
    return { status: res.status, contentType, body: parsed };
  } finally {
    ctrl.abort();
  }
}

const validator = buildValidator();
console.log(`Contrat → ${base} · produit ${product}${writes ? " · avec écritures" : " · lectures seules"}\n`);
const results = await exercise({
  call,
  validator,
  product,
  writes,
  onCase: (r) => console.log(`${r.errors.length ? "✕" : "✓"} ${r.method.padEnd(5)} ${r.path} → ${r.status}${r.errors.length ? "\n    " + r.errors.slice(0, 6).join("\n    ") : ""}`),
});
const failed = results.filter((r) => r.errors.length);
console.log(`\n${results.length - failed.length}/${results.length} conformes`);
process.exit(failed.length ? 1 : 0);
