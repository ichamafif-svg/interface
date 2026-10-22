import { TraceView } from "@/components/trace-view";
import { DEMO_STATIC } from "@/lib/demo";

export async function generateStaticParams() {
  if (!DEMO_STATIC) return [];
  const { traces } = await import("@/lib/mock/fixtures");
  return Object.keys(traces).map((trace) => ({ trace }));
}

export const metadata = { title: "Pourquoi refusé ?" };

export default async function TracePage({ params }: { params: Promise<{ product: string; trace: string }> }) {
  const { product, trace } = await params;
  return <TraceView product={product} traceId={trace} />;
}
