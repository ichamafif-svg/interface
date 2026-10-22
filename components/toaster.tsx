"use client";
import { useEffect, useState, type ReactNode } from "react";

type T = { id: number; tone: "ok" | "bad"; text: ReactNode };
const EVT = "standard:toast";
let seq = 0;

/** Affiche une confirmation qui survit au rafraîchissement de la page (l'objet d'origine peut disparaître). */
export function toast(tone: T["tone"], text: ReactNode) {
  window.dispatchEvent(new CustomEvent<T>(EVT, { detail: { id: ++seq, tone, text } }));
}

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<T>).detail;
      setItems((xs) => [...xs.slice(-2), t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 5000);
    };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 50, display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((t) => (
        <div key={t.id} role="status" className="glass" style={{ padding: "12px 16px", borderRadius: 12, fontSize: 13, maxWidth: 420, color: t.tone === "ok" ? "var(--ok)" : "var(--bad)" }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
