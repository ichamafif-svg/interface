import { SubNav } from "@/components/nav";

export default async function ProofsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ product: string }> }) {
  const { product } = await params;
  const p = `/${product}/proofs`;
  return (
    <>
      <SubNav
        label="Preuves"
        items={[
          { href: `${p}/guarantees`, label: "Garanties" },
          { href: `${p}/gaps`, label: "Écarts" },
          { href: `${p}/timeline`, label: "Chronologie" },
          { href: `${p}/export`, label: "Export" },
        ]}
      />
      {children}
    </>
  );
}
