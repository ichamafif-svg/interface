import { handleMock } from "@/lib/mock/handler";
import { standardApiUrl } from "@/lib/api/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP = ["connection", "keep-alive", "transfer-encoding", "upgrade", "host", "content-length", "accept-encoding"];

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const sub = "/" + path.map(encodeURIComponent).join("/");
  const real = standardApiUrl();
  if (!real) return handleMock(req, sub);

  const url = new URL(req.url);
  const headers = new Headers(req.headers);
  HOP.forEach((h) => headers.delete(h));
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const upstream = await fetch(real + sub + url.search, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // @ts-expect-error -- requis par Node pour streamer un corps de requête
    duplex: hasBody ? "half" : undefined,
    signal: req.signal,
    cache: "no-store",
    redirect: "manual",
  });
  const out = new Headers(upstream.headers);
  HOP.forEach((h) => out.delete(h));
  out.delete("content-encoding");
  // Le corps est relayé tel quel : les flux SSE restent des flux.
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
