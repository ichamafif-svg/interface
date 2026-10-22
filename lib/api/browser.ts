"use client";
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { DEMO_STATIC, demoFetch } from "@/lib/demo";

/** Client typé côté navigateur : passe par le proxy /api/v1 de la console (ou le faux backend local en démo statique). */
export const browserApi = createClient<paths>({
  baseUrl: DEMO_STATIC ? "http://demo.local/api/v1" : "/api/v1",
  credentials: "same-origin",
  ...(DEMO_STATIC ? { fetch: demoFetch } : {}),
});
