import { TraceView } from "@/components/trace-view";

export const metadata = { title: "Pourquoi refusé ?" };

export default async function Traces({ params }: { params: Promise<{ product: string }> }) {
  return <TraceView product={(await params).product} />;
}
