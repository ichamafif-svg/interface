import type { ReactNode } from "react";
import Link from "next/link";
import type { State, EvidenceLevel } from "@/lib/api/types";

export const STATE: Record<State, { cls: string; label: string }> = {
  qualifie: { cls: "q", label: "Qualifié" },
  observe: { cls: "o", label: "Observé" },
  propose: { cls: "p", label: "Proposé" },
  inconnu: { cls: "u", label: "Inconnu" },
  non_couvert: { cls: "n", label: "Non couvert" },
  non_etaye: { cls: "v", label: "Non étayé" },
  hors_standard: { cls: "h", label: "Hors Standard" },
};

export type ProofLevel = EvidenceLevel | "inconnu" | "non_couvert";
export const LEVEL: Record<ProofLevel, { cls: string; label: string }> = {
  verifie: { cls: "q", label: "Vérifié" },
  observe: { cls: "o", label: "Observé" },
  lu: { cls: "p", label: "Lu" },
  inconnu: { cls: "u", label: "Inconnu" },
  non_couvert: { cls: "n", label: "Non couvert" },
  hors_standard: { cls: "h", label: "Hors Standard" },
};

export function Chip({ cls, children, dot = true, sm }: { cls: string; children: ReactNode; dot?: boolean; sm?: boolean }) {
  return (
    <span className={`chip ${cls}${sm ? " sm" : ""}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function StateChip({ state, label, sm }: { state: State; label?: string; sm?: boolean }) {
  const s = STATE[state];
  return <Chip cls={s.cls} sm={sm} dot={state !== "propose" && state !== "hors_standard"}>{label ?? s.label}</Chip>;
}

export function LevelChip({ level }: { level: ProofLevel }) {
  const l = LEVEL[level];
  return <Chip cls={l.cls} dot={level !== "lu" && level !== "hors_standard"}>{l.label}</Chip>;
}

export function PageHead({ kicker, title, intro, right }: { kicker: ReactNode; title: ReactNode; intro?: ReactNode; right?: ReactNode }) {
  return (
    <div className="head">
      <div>
        <div className="label">{kicker}</div>
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
      </div>
      {right && <div className="flex">{right}</div>}
    </div>
  );
}

export function Kpi({ label, value, sub, color, href }: { label: ReactNode; value: ReactNode; sub?: ReactNode; color?: string; href?: string }) {
  const body = (
    <>
      <div className="label">{label}</div>
      <div className="val" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="glass kpi" style={{ color: "inherit" }}>{body}</Link>
  ) : (
    <div className="glass kpi">{body}</div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="between" style={{ marginBottom: 12 }}>
      <div className="label">{children}</div>
      {right}
    </div>
  );
}

/** Coloration minimale d'un diff unifié. */
export function Diff({ text, wrap }: { text: string; wrap?: boolean }) {
  return (
    <pre className={`code${wrap ? " wrap" : ""}`}>
      {text.split("\n").map((l, i) => (
        <div key={i} className={l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : l.startsWith("@@") ? "accent" : undefined}>
          {l || " "}
        </div>
      ))}
    </pre>
  );
}

export function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A5B4FC" />
          <stop offset="1" stopColor="#67E8F9" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="24" height="24" rx="7" fill="none" stroke="url(#lg)" strokeWidth="1.5" />
      <path d="M8 13h10M13 8v10" stroke="url(#lg)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
