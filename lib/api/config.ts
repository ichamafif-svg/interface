/** URL du vrai backend, version incluse (ex. https://standard.example.com/api/v1). Vide = faux backend. */
export function standardApiUrl(): string | null {
  const v = process.env.STANDARD_API_URL?.trim();
  return v ? v.replace(/\/$/, "") : null;
}
export const defaultProduct = () => process.env.STANDARD_DEFAULT_PRODUCT?.trim() || "lumen";
