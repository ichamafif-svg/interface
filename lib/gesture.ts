"use client";
import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";

const b64u = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : null;
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/**
 * Geste humain signé (WebAuthn).
 * 1. POST /auth/gesture-challenge {purpose}
 * 2. navigator.credentials.get(challenge)
 * 3. renvoie {type:"webauthn", assertion} : JSON {id, clientDataJSON, authenticatorData, signature, userHandle} en base64url.
 * Le faux backend répond avec un rpId en ".invalid" (jamais un vrai domaine) : la console envoie
 * alors une assertion factice "demo.<challenge>" sans solliciter de clé.
 */
export async function signGesture(purpose: string): Promise<Schemas["GestureSignature"]> {
  const { data: ch, error } = await browserApi.POST("/auth/gesture-challenge", { body: { purpose } });
  if (!ch) throw new Error((error as { title?: string })?.title ?? "Défi de signature indisponible");

  if (ch.rpId.endsWith(".invalid")) return { type: "webauthn", assertion: `demo.${ch.challenge}` };

  try {
    const cred = (await navigator.credentials.get({
      publicKey: {
        challenge: fromB64u(ch.challenge),
        rpId: ch.rpId,
        userVerification: "required",
        timeout: 60_000,
        allowCredentials: (ch.allowCredentials ?? []).map((id) => ({ type: "public-key" as const, id: fromB64u(id) })),
      },
    })) as PublicKeyCredential | null;
    if (!cred) throw new Error("Signature annulée");
    const r = cred.response as AuthenticatorAssertionResponse;
    const payload = {
      id: cred.id,
      clientDataJSON: b64u(r.clientDataJSON),
      authenticatorData: b64u(r.authenticatorData),
      signature: b64u(r.signature),
      userHandle: b64u(r.userHandle),
    };
    return { type: "webauthn", assertion: b64u(new TextEncoder().encode(JSON.stringify(payload)).buffer as ArrayBuffer)! };
  } catch (e) {
    throw e instanceof Error ? e : new Error("Signature refusée");
  }
}
