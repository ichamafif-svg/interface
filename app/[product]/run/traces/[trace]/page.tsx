import { TraceView } from "@/components/trace-view";

export const metadata = { title: "Pourquoi refusé ?" };

export default async function TracePage({ params }: { params: Promise<{ product: string; trace: string }> }) {
  const { product, trace } = await params;
  return <TraceView product={product} traceId={trace} />;
}
