// Attempts to pull live state wage data; falls back to the static dataset.
// No reliable public API currently covers state-level tipped minimum wages at
// the granularity this app needs, so we always use the static fallback and
// surface a clear "as of" date to the user.

export type WageSource = "live" | "static";

export const WAGE_DATA_DATE = "January 2026";

export async function fetchStateWages(): Promise<WageSource> {
  // Placeholder: swap this body for a real DOL / Open States API call
  // when a suitable endpoint becomes available.
  return "static";
}
