"use client";
import type { LiveEvent } from "@/lib/api/types";
import { DEMO_STATIC, demoFetch } from "@/lib/demo";

const TYPES = ["agent.step", "agent.message", "agent.question", "human.gesture", "precheck.progress", "judge.verdict", "release.progress", "probe.result", "fact.admitted", "refusal", "plan.step"];

/**
 * Ouvre un flux LiveEvent (SSE). Renvoie la fonction de fermeture.
 * En production : EventSource sur le proxy /api/v1. En démo statique : lecture directe du faux backend.
 */
export function openStream(
  path: string,
  onEvent: (e: LiveEvent) => void,
  onStatus?: (s: "open" | "connecting" | "lost") => void,
): () => void {
  const parse = (data: string) => {
    try {
      onEvent(JSON.parse(data) as LiveEvent);
    } catch {
      /* événement illisible : ignoré, jamais inventé */
    }
  };

  if (!DEMO_STATIC) {
    const es = new EventSource(`/api/v1${path}`);
    const on = (m: MessageEvent<string>) => parse(m.data);
    es.onopen = () => onStatus?.("open");
    es.onerror = () => onStatus?.(es.readyState === EventSource.CLOSED ? "lost" : "connecting");
    es.onmessage = on;
    TYPES.forEach((t) => es.addEventListener(t, on as EventListener));
    return () => es.close();
  }

  const ctrl = new AbortController();
  (async () => {
    const res = await demoFetch(new Request(`http://demo.local/api/v1${path}`, { signal: ctrl.signal }));
    onStatus?.("open");
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (!ctrl.signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const data = block.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
        if (data) parse(data);
      }
    }
  })().catch(() => onStatus?.("lost"));
  return () => ctrl.abort();
}
