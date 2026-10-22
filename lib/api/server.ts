import "server-only";
import createClient from "openapi-fetch";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { paths } from "./schema";
import { handleMock } from "@/lib/mock/handler";
import { standardApiUrl } from "./config";

const MOCK_BASE = "http://standard.mock/api/v1";

/**
 * Client typé pour les composants serveur.
 * - STANDARD_API_URL défini : appelle le vrai backend en transmettant les cookies de session.
 * - Sinon : route en mémoire vers le faux backend (lib/mock/handler.ts), sans réseau.
 */
export function api() {
  const real = standardApiUrl();
  if (real) {
    return createClient<paths>({
      baseUrl: real,
      fetch: async (req: Request) => {
        const headers = new Headers(req.headers);
        const jar = (await cookies()).toString();
        if (jar) headers.set("cookie", jar);
        return fetch(new Request(req, { headers, cache: "no-store" }));
      },
    });
  }
  return createClient<paths>({
    baseUrl: MOCK_BASE,
    fetch: (req: Request) => handleMock(req, new URL(req.url).pathname.replace(/^\/api\/v1/, "")),
  });
}

type Result<D> = { data?: D; error?: unknown; response: Response };

/** Renvoie les données ou déclenche la page 404 / une erreur lisible. */
export async function unwrap<D>(p: Promise<Result<D>>): Promise<D> {
  const { data, error, response } = await p;
  if (response.status === 404) notFound();
  if (data === undefined) {
    const e = error as { title?: string; detail?: string } | undefined;
    throw new Error(`Standard ${response.status} · ${e?.title ?? "erreur"}${e?.detail ? ` · ${e.detail}` : ""}`);
  }
  return data;
}
