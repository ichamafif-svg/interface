import { redirect } from "next/navigation";

export default async function Proofs({ params }: { params: Promise<{ product: string }> }) {
  redirect(`/${(await params).product}/proofs/guarantees`);
}
