import { describe, expect, it } from "vitest";
// @ts-expect-error -- module JS partagé avec scripts/contract-check.mjs
import { buildValidator, exercise, firstSseEvent } from "../scripts/contract-lib.mjs";
import { handleMock } from "@/lib/mock/handler";

type Case = { method: string; path: string; status: number; errors: string[] };

async function call(method: string, path: string, body?: unknown) {
  const ctrl = new AbortController();
  const req = new Request(`http://mock/api/v1${path}`, {
    method,
    signal: ctrl.signal,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  });
  const res = await handleMock(req, path.split("?")[0]);
  const contentType = res.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("event-stream")) return { status: res.status, contentType, body: await firstSseEvent(res) };
    const text = await res.text();
    return { status: res.status, contentType, body: text ? JSON.parse(text) : undefined };
  } finally {
    ctrl.abort();
  }
}

describe("faux backend ↔ contract/openapi.yaml", () => {
  it("chaque réponse respecte le contrat", async () => {
    const validator = buildValidator();
    const results: Case[] = await exercise({ call, validator, product: "lumen", writes: true });
    const failed = results.filter((r) => r.errors.length);
    expect(results.length).toBeGreaterThan(40);
    expect(failed.map((f) => `${f.method} ${f.path} → ${f.status}\n  ${f.errors.join("\n  ")}`)).toEqual([]);
  }, 30_000);

  it("chaque opération du contrat est servie par le faux backend", async () => {
    const validator = buildValidator();
    const unknown: string[] = [];
    for (const o of validator.operations as { tpl: string; method: string }[]) {
      const path = o.tpl.replace("{product}", "lumen").replace(/\{[^}]+\}/g, "x");
      const ctrl = new AbortController();
      const res = await handleMock(new Request(`http://mock/api/v1${path}`, { method: o.method, signal: ctrl.signal, ...(o.method === "GET" ? {} : { body: "{}" }) }), path);
      ctrl.abort();
      const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
      if (res.status === 404 && body?.title === "Route inconnue") unknown.push(`${o.method} ${o.tpl}`);
      if (res.status === 405) unknown.push(`${o.method} ${o.tpl} (405)`);
    }
    expect(unknown).toEqual([]);
  });

  it("un geste sans signature est refusé", async () => {
    const res = await call("PUT", "/products/lumen/routes/fail-mode", { route: "PUT /playlists/{id}", mode: "open" });
    expect(res.status).toBe(401);
    expect(res.body.title).toBeTruthy();
  });
});
