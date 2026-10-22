"use client";
import createClient from "openapi-fetch";
import type { paths } from "./schema";

/** Client typé côté navigateur : passe toujours par le proxy /api/v1 de la console. */
export const browserApi = createClient<paths>({ baseUrl: "/api/v1", credentials: "same-origin" });
