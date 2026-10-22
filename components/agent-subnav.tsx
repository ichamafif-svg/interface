import { SubNav } from "@/components/nav";

export function AgentSubNav({ product }: { product: string }) {
  const p = `/${product}`;
  return (
    <SubNav
      label="Agent"
      items={[
        { href: `${p}/agent`, label: "Construire", exact: true },
        { href: `${p}/zones`, label: "Zones" },
        { href: `${p}/agent/metrics`, label: "Métriques" },
      ]}
    />
  );
}
