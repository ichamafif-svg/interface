import { SubNav } from "@/components/nav";

export default async function RunLayout({ children, params }: { children: React.ReactNode; params: Promise<{ product: string }> }) {
  const { product } = await params;
  const p = `/${product}/run`;
  return (
    <>
      <SubNav
        label="Run"
        items={[
          { href: p, label: "Vue d'ensemble", exact: true },
          { href: `${p}/live`, label: <><span className="live" style={{ width: 6, height: 6 }} />En direct</> },
          { href: `${p}/map`, label: "Carte" },
          { href: `${p}/traces`, label: "Pourquoi refusé ?" },
        ]}
      />
      {children}
    </>
  );
}
