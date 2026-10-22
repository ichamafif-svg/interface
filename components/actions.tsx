"use client";
/**
 * Toutes les écritures de la console. Chaque geste qui engage un humain passe par signGesture (WebAuthn),
 * puis la page est rafraîchie depuis le serveur : l'UI n'invente jamais un état.
 */
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { browserApi } from "@/lib/api/browser";
import { signGesture } from "@/lib/gesture";
import { toast } from "@/components/toaster";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<ReactNode>) {
    setBusy(key);
    try {
      const msg = await fn();
      toast("ok", msg);
      router.refresh();
    } catch (e) {
      toast("bad", e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

function fail(error: unknown, fallback: string): never {
  const e = error as { title?: string; detail?: string } | undefined;
  throw new Error(e?.title ? `${e.title}${e.detail ? ` · ${e.detail}` : ""}` : fallback);
}

type Opt = { id: string; label: string; primary?: boolean };

export function DecisionOptions({ product, decisionId, options, extra }: { product: string; decisionId: string; options: Opt[]; extra?: ReactNode }) {
  const { busy, run } = useAction();
  return (
    <div className="flex">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`btn${o.primary ? " primary" : ""}`}
          disabled={!!busy}
          onClick={() =>
            run(o.id, async () => {
              const signature = await signGesture(`decision:${decisionId}:${o.id}`);
              const { data, error } = await browserApi.POST("/products/{product}/decisions/{decision}/resolve", {
                params: { path: { product, decision: decisionId } },
                body: { optionId: o.id, signature },
              });
              if (!data) fail(error, "Décision refusée");
              return `« ${o.label} » signé · journal #${data.journal.entry}`;
            })
          }
        >
          {busy === o.id ? "Signature…" : o.label}
        </button>
      ))}
      {extra}
    </div>
  );
}

type InvAction = "confirm" | "correct" | "discard" | "provide_source" | "outside_repo";
export function InventoryActions({ product, itemId, actions }: { product: string; itemId: string; actions: { id: InvAction; label: string; primary?: boolean }[] }) {
  const { busy, run } = useAction();
  return (
    <div className="flex">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`btn sm${a.primary ? " primary" : ""}`}
          disabled={!!busy}
          onClick={() =>
            run(a.id, async () => {
              const { data, error } = await browserApi.PATCH("/products/{product}/inventory/{item}", {
                params: { path: { product, item: itemId } },
                body: { action: a.id },
              });
              if (!data) fail(error, "Mise à jour refusée");
              return `${data.resource} · ${data.stateLabel ?? data.state}`;
            })
          }
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export function ShadowRefusalActions({ product, zone, route, options }: { product: string; zone: string; route: string; options: Opt[] }) {
  const { busy, run } = useAction();
  return (
    <div className="flex" style={{ marginTop: 10 }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`btn sm${o.primary ? " primary" : ""}`}
          disabled={!!busy}
          onClick={() =>
            run(o.id, async () => {
              const { data, error } = await browserApi.POST("/products/{product}/zones/{zone}/policy/proposals", {
                params: { path: { product, zone } },
                body: { kind: o.id === "keep" ? "keep_refused" : "allow_shadow_refusal", route, optionId: o.id },
              });
              if (!data) fail(error, "Proposition refusée");
              return (
                <>
                  Proposition envoyée · à signer dans <Link href={`/${product}/decisions`}>À décider</Link>
                </>
              );
            })
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type ExportFormat = "audit_bundle" | "oscal" | "vanta" | "drata" | "dora" | "sbom_cyclonedx" | "siem" | "exit_bundle";
export function ExportButton({ product, format, framework, label }: { product: string; format: ExportFormat; framework?: "iso27001" | "dora" | "nis2"; label: string }) {
  const { busy, run } = useAction();
  return (
    <>
      <button
        type="button"
        className="btn sm"
        disabled={!!busy}
        onClick={() =>
          run(format, async () => {
            const { data, error } = await browserApi.POST("/products/{product}/exports", {
              params: { path: { product } },
              body: { format, ...(framework ? { framework } : {}) },
            });
            if (!data) fail(error, "Export refusé");
            return `Export ${data.id} · ${data.status === "ready" ? "prêt" : "en préparation"} · écarts inclus`;
          })
        }
      >
        {busy ? "…" : label}
      </button>
    </>
  );
}

export function JournalVerify({ product }: { product: string }) {
  const { busy, run } = useAction();
  return (
    <>
      <button
        type="button"
        className="btn sm"
        disabled={!!busy}
        onClick={() =>
          run("verify", async () => {
            const { data, error } = await browserApi.POST("/products/{product}/journal/verify", { params: { path: { product } } });
            if (!data) fail(error, "Vérification impossible");
            return data.chained && data.replayMatches ? `Chaîne continue · ${data.entries.toLocaleString("fr-FR")} entrées` : "Chaîne rompue";
          })
        }
      >
        {busy ? "Vérification…" : "Vérifier la chaîne"}
      </button>
    </>
  );
}

export function FailModeToggle({ product, route, mode }: { product: string; route: string; mode: "closed" | "open" }) {
  const { busy, run } = useAction();
  const set = (next: "closed" | "open") =>
    run(next, async () => {
      const signature = await signGesture(`fail-mode:${route}:${next}`);
      const { data, error } = await browserApi.PUT("/products/{product}/routes/fail-mode", {
        params: { path: { product } },
        body: { route, mode: next, signature },
      });
      if (!data) fail(error, "Changement refusé");
      return `${route} · ${next === "closed" ? "fermé" : "ouvert"} si l'entrée tombe · journal #${data.journal.entry}`;
    });
  return (
    <div className="flex" role="group" aria-label={`Mode de panne pour ${route}`}>
      <button type="button" className={`btn sm${mode === "closed" ? " primary" : " ghost"}`} aria-pressed={mode === "closed"} disabled={!!busy} onClick={() => mode !== "closed" && set("closed")}>Fermé</button>
      <button type="button" className={`btn sm${mode === "open" ? " primary" : " ghost"}`} aria-pressed={mode === "open"} disabled={!!busy} onClick={() => mode !== "open" && set("open")}>Ouvert</button>
    </div>
  );
}

export function MissionReply({ product, missionId, actions }: { product: string; missionId: string; actions?: Opt[] }) {
  const { busy, run } = useAction();
  const [text, setText] = useState("");
  const send = (body: { text: string } | { actionId: string }, key: string) =>
    run(key, async () => {
      const { data, error } = await browserApi.POST("/products/{product}/missions/{mission}/messages", {
        params: { path: { product, mission: missionId } },
        body,
      });
      if (!data) fail(error, "Message refusé");
      setText("");
      return "Transmis à l'agent";
    });
  return (
    <div className="stack">
      {actions && actions.length > 0 && (
        <div className="flex">
          {actions.map((a) => (
            <button key={a.id} type="button" className={`btn${a.primary ? " primary" : ""}`} disabled={!!busy} onClick={() => send({ actionId: a.id }, a.id)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex"
        style={{ flexWrap: "nowrap" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send({ text: text.trim() }, "text");
        }}
      >
        <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Répondre à l'agent…" aria-label="Message à l'agent" />
        <button className="btn" type="submit" disabled={!!busy || !text.trim()} aria-label="Envoyer">↵</button>
      </form>
    </div>
  );
}

export function NewMission({ product, zones }: { product: string; zones: { id: string; name: string }[] }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [prompt, setPrompt] = useState("");
  const [zone, setZone] = useState(zones[0]?.id ?? "");
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        run("create", async () => {
          const { data, error } = await browserApi.POST("/products/{product}/missions", {
            params: { path: { product } },
            body: { prompt, zoneId: zone || undefined },
          });
          if (!data) fail(error, "Mission refusée");
          setPrompt("");
          router.push(`/${product}/agent?mission=${data.id}`);
          return `Mission ${data.id} lancée dans un bac`;
        });
      }}
    >
      <textarea className="field" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Décrivez le changement : l'agent lit la zone, propose, code et prouve." aria-label="Nouvelle mission" />
      <div className="between">
        <select className="field" style={{ width: "auto" }} value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone">
          {zones.map((z) => (
            <option key={z.id} value={z.id}>Zone {z.name}</option>
          ))}
        </select>
        <button className="btn primary" type="submit" disabled={!!busy || prompt.trim().length < 3}>Lancer la mission</button>
      </div>
    </form>
  );
}
