import { notFound, redirect } from "next/navigation";
import { api, unwrap } from "@/lib/api/server";
import { DEMO_STATIC } from "@/lib/demo";

export async function generateStaticParams() {
  if (!DEMO_STATIC) return [];
  const F = await import("@/lib/mock/fixtures");
  const refs = new Map<string, { kind: string; id: string }>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.kind === "string" && typeof o.id === "string" && ["mission", "candidate", "trace", "guarantee", "gap", "decision", "zone", "release", "journal"].includes(o.kind)) refs.set(`${o.kind}/${o.id}`, { kind: o.kind, id: o.id });
      Object.values(o).forEach(walk);
    }
  };
  walk(Object.values(F));
  F.missions.forEach((m) => refs.set(`mission/${m.id}`, { kind: "mission", id: m.id }));
  Object.keys(F.candidates).forEach((c) => refs.set(`candidate/${c}`, { kind: "candidate", id: c }));
  F.guarantees.forEach((g) => refs.set(`guarantee/${g.id}`, { kind: "guarantee", id: g.id }));
  F.decisions.forEach((d) => refs.set(`decision/${d.id}`, { kind: "decision", id: d.id }));
  return [...refs.values()];
}

/** Résout un ObjectRef {kind, id} vers l'écran qui le montre. */
export default async function Ref({ params }: { params: Promise<{ product: string; kind: string; id: string }> }) {
  const { product, kind, id: raw } = await params;
  const id = decodeURIComponent(raw);
  const p = `/${product}`;
  const c = api();
  switch (kind) {
    case "mission":
      redirect(`${p}/agent?mission=${id}`);
    case "candidate": {
      const cand = await unwrap(c.GET("/products/{product}/candidates/{candidate}", { params: { path: { product, candidate: id } } }));
      const m = await unwrap(c.GET("/products/{product}/missions/{mission}", { params: { path: { product, mission: cand.missionId } } }));
      redirect(`${p}/zones/${m.zoneId}/mission?mission=${m.id}`);
    }
    case "trace":
      redirect(`${p}/run/traces/${id}`);
    case "guarantee":
      redirect(`${p}/proofs/guarantees?g=${id}`);
    case "gap":
      redirect(`${p}/proofs/gaps#${id}`);
    case "decision":
      redirect(`${p}/decisions#${id}`);
    case "zone":
      redirect(`${p}/zones/${id}/inventory`);
    case "release":
      redirect(`${p}/run/live`);
    case "journal":
      redirect(`${p}/proofs/timeline`);
    default:
      notFound();
  }
}
