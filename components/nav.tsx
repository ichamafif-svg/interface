"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: ReactNode; match?: string[]; exact?: boolean; badge?: number };

function isOn(path: string, it: NavItem) {
  const prefixes = it.match ?? [it.href];
  return prefixes.some((p) => (it.exact ? path === p : path === p || path.startsWith(p + "/")));
}

export function MainNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="glass pills" aria-label="Navigation principale">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={`pill${isOn(path, it) ? " on" : ""}`} aria-current={isOn(path, it) ? "page" : undefined}>
          {it.label}
          {it.badge ? <span className="badge">{it.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function SubNav({ label, items }: { label: string; items: NavItem[] }) {
  const path = usePathname();
  return (
    <div className="wrap" style={{ paddingBottom: 6 }}>
      <nav className="glass subnav" aria-label={label}>
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={isOn(path, it) ? "on" : undefined} aria-current={isOn(path, it) ? "page" : undefined}>
            {it.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

const STEPS = [
  ["inventory", "Découvrir"],
  ["dossier", "Comprendre"],
  ["policy", "Zone"],
  ["mission", "Coder"],
  ["verification", "Vérifier"],
  ["transfer", "Transférer"],
] as const;

/** Parcours d'une zone : étapes 1 à 6, la 7e est le Run. `step` = étape en cours côté backend. */
export function ZoneStepper({ product, zone, zoneName, step }: { product: string; zone: string; zoneName: string; step: number }) {
  const path = usePathname();
  return (
    <div className="wrap" style={{ paddingBottom: 4 }}>
      <nav className="glass stepper" aria-label={`Parcours de la zone ${zoneName}`}>
        <span className="label" style={{ padding: "0 10px 0 8px" }}>Zone {zoneName}</span>
        {STEPS.map(([seg, label], i) => {
          const n = i + 1;
          const href = `/${product}/zones/${zone}/${seg}`;
          const state = n < step ? "done" : n === step ? "cur" : "";
          return (
            <Link key={seg} href={href} className={path === href ? "on" : undefined} aria-current={path === href ? "step" : undefined}>
              <span className={`num ${state}`}>{state === "done" ? "✓" : n}</span>
              {label}
            </Link>
          );
        })}
        <Link href={`/${product}/run`} style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
          7 · En service →
        </Link>
      </nav>
    </div>
  );
}
