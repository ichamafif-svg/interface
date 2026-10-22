import { api, unwrap } from "@/lib/api/server";
import { LiveBoard } from "@/components/live-board";

export const metadata = { title: "En direct" };

export default async function LivePage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const snap = await unwrap(api().GET("/products/{product}/live/snapshot", { params: { path: { product } } }));
  return <LiveBoard product={product} initial={snap} />;
}
