import { redirect } from "next/navigation";

export default async function Zone({ params }: { params: Promise<{ product: string; zone: string }> }) {
  const { product, zone } = await params;
  redirect(`/${product}/zones/${zone}/inventory`);
}
