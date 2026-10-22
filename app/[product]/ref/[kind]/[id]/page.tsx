import { notFound, redirect } from "next/navigation";
import { api, unwrap } from "@/lib/api/server";

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
