#!/usr/bin/env node
/**
 * Construit la démo statique (faux backend dans le navigateur) dans demo-out/.
 * Copie le projet dans un dossier temporaire, retire le proxy /api/v1 et le rendu dynamique,
 * puis lance `next build` en export statique. Le code source n'est pas modifié.
 */
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync, mkdtempSync, symlinkSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const tmp = mkdtempSync(join(tmpdir(), "standard-demo-"));
cpSync(root, tmp, { recursive: true, filter: (p) => !/\/(node_modules|\.next|demo-out|\.git)(\/|$)/.test(p.slice(root.length)) });
symlinkSync(join(root, "node_modules"), join(tmp, "node_modules"));

rmSync(join(tmp, "app/api"), { recursive: true, force: true });
// L'export statique ne lit pas l'URL côté serveur : les pages filtrées prennent leur vue par défaut.
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : d.name === "page.tsx" ? [join(dir, d.name)] : []));
for (const f of walk(join(tmp, "app"))) {
  const src = readFileSync(f, "utf8");
  if (src.includes("await searchParams")) writeFileSync(f, src.replaceAll("await searchParams", "({} as Record<string, string | undefined>)"));
}
const layout = join(tmp, "app/[product]/layout.tsx");
writeFileSync(layout, readFileSync(layout, "utf8").replace(/export const dynamic = "force-dynamic";\n/, ""));
// Page d'entrée : navigation côté client vers le Run (aucun index de dossier requis chez l'hébergeur).
writeFileSync(
  join(tmp, "app/page.tsx"),
  `"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => router.replace("/lumen/run/"), [router]);
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05060a", color: "#9898a6", fontFamily: "system-ui" }}>Standard · chargement…</div>;
}
`,
);
writeFileSync(
  join(tmp, "next.config.mjs"),
  // Les hébergeurs d'artifacts réservent les noms en « _ » : les ressources Next passent sous /s/_next.
  `export default { output: "export", trailingSlash: true, assetPrefix: "/s", images: { unoptimized: true }, reactStrictMode: true, poweredByHeader: false };\n`,
);

execSync("npx next build", { cwd: tmp, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_DEMO_STATIC: "1", NEXT_TELEMETRY_DISABLED: "1" } });
rmSync(join(root, "demo-out"), { recursive: true, force: true });
cpSync(join(tmp, "out"), join(root, "demo-out"), { recursive: true, filter: (p) => !p.includes("/out/_next") });
cpSync(join(tmp, "out/_next"), join(root, "demo-out/s/_next"), { recursive: true });
rmSync(tmp, { recursive: true, force: true });
// Certains hébergeurs refusent le caractère U+FFFD brut : on l'écrit en échappement JS.
const fixFffd = (dir) => {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) fixFffd(p);
    else if (p.endsWith(".js")) {
      const src = readFileSync(p, "utf8");
      if (src.includes("\uFFFD")) writeFileSync(p, src.replaceAll("\uFFFD", "\\uFFFD"));
    }
  }
};
fixFffd(join(root, "demo-out"));
// Page d'entrée de l'artifact : ouvre le Run (fichier exact, sans index de dossier).
writeFileSync(
  join(root, "demo-out/standard-console.html"),
  `<title>Console Standard</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root { --bg: #05060a; --fg: #9898a6; --link: #c7d2fe; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
a { color: var(--link); }
</style>
<p>Ouverture de la console… <a href="lumen/run/index.html">Ouvrir</a></p>
<script>location.replace("lumen/run/index.html");</script>
`,
);
console.log(`\nDémo statique prête dans demo-out/ (${existsSync(join(root, "demo-out/index.html")) ? "ok" : "index.html manquant"})`);
