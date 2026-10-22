import { notFound } from "next/navigation";
import { api, unwrap } from "@/lib/api/server";
import { ZoneStepper } from "@/components/nav";
import { DEMO_STATIC } from "@/lib/demo";

export async function generateStaticParams() {
  if (!DEMO_STATIC) return [];
  const { zones } = await import("@/lib/mock/fixtures");
  return zones.map((z) => ({ zone: z.id }));
}

export default async function ZoneLayout({ children, params }: { children: React.ReactNode; params: Promise<{ product: string; zone: string }> }) {
  const { product, zone } = await params;
  const zones = await unwrap(api().GET("/products/{product}/zones", { params: { path: { product } } }));
  const z = zones.items.find((x) => x.id === zone);
  if (!z) notFound();
  return (
    <>
      <ZoneStepper product={product} zone={zone} zoneName={z.name} step={z.step} />
      {children}
    </>
  );
}
