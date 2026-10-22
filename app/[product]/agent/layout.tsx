import { AgentSubNav } from "@/components/agent-subnav";

export default async function AgentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ product: string }> }) {
  return (
    <>
      <AgentSubNav product={(await params).product} />
      {children}
    </>
  );
}
