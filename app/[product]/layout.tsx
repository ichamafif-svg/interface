import { api, unwrap } from "@/lib/api/server";
import { MainNav } from "@/components/nav";
import { Logo } from "@/components/ui";
import Link from "next/link";
import { Toaster } from "@/components/toaster";
import { DEMO_STATIC } from "@/lib/demo";

/** Pré-rendu seulement pour la démo statique ; sinon tout est dynamique. */
export async function generateStaticParams() {
  return DEMO_STATIC ? [{ product: "lumen" }] : [];
}

export const dynamic = "force-dynamic";

export default async function ProductLayout({ children, params }: { children: React.ReactNode; params: Promise<{ product: string }> }) {
  const { product } = await params;
  const client = api();
  const [summary, decisions] = await Promise.all([
    unwrap(client.GET("/products/{product}/run/summary", { params: { path: { product } } })),
    unwrap(client.GET("/products/{product}/decisions", { params: { path: { product }, query: { status: "all" } } })),
  ]);
  const pending = decisions.items.filter((d) => d.status !== "resolved").length;
  const p = `/${product}`;
  return (
    <div className="aurora">
      <header className="topbar">
        <Link href={`${p}/run`} className="brand" style={{ color: "inherit" }}>
          <Logo />
          <b>Standard</b>
          <span className="muted">/</span>
          <span style={{ fontWeight: 500 }}>{summary.product}</span>
        </Link>
        <MainNav
          items={[
            { href: `${p}/run`, label: "Run" },
            { href: `${p}/decisions`, label: "À décider", badge: pending },
            { href: `${p}/proofs/guarantees`, label: "Preuves", match: [`${p}/proofs`] },
            { href: `${p}/agent`, label: "Agent", match: [`${p}/agent`, `${p}/zones`] },
          ]}
        />
        <div style={{ marginLeft: "auto" }} className="flex">
          <span className="chip p" title="Release servie">{summary.servedRelease}</span>
        </div>
      </header>
      {children}
      <Toaster />
    </div>
  );
}
