/**
 * Mode démo statique (NEXT_PUBLIC_DEMO_STATIC=1) : la console est exportée en fichiers statiques
 * et le faux backend tourne dans le navigateur. Jamais actif avec un vrai backend.
 */
export const DEMO_STATIC = process.env.NEXT_PUBLIC_DEMO_STATIC === "1";

/** Appelle le faux backend dans le navigateur, comme si c'était /api/v1. */
export async function demoFetch(input: Request): Promise<Response> {
  const { handleMock } = await import("@/lib/mock/handler");
  const url = new URL(input.url, "http://demo.local");
  return handleMock(input, url.pathname.replace(/^\/api\/v1/, ""));
}
