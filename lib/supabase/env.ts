/**
 * Centralized Supabase public configuration.
 *
 * Vercel environments may still contain legacy anon-key variable names.
 * Prefer the current publishable-key contract, but accept the legacy aliases
 * so a deployment cannot silently pass an empty/whitespace key to supabase-js.
 */
function firstConfiguredValue(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find((value) => Boolean(value));
}

export function getSupabasePublicConfig() {
  const url = firstConfiguredValue(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL
  );
  const key = firstConfiguredValue(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY
  );

  if (!url || !key) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)" : null,
      !key
        ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or a supported anon/publishable alias)"
        : null
    ].filter(Boolean);
    throw new Error(`Supabase não configurado: variável ausente ou vazia: ${missing.join(", ")}.`);
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
      throw new Error("invalid_protocol");
    }
  } catch {
    throw new Error("Supabase não configurado: NEXT_PUBLIC_SUPABASE_URL contém uma URL inválida.");
  }

  return { url, key };
}
