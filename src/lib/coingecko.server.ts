// Server-only, best-effort icon lookup for currency codes we don't have
// hand-curated metadata for. Public API, no key needed. Failures are silent —
// callers should already have a text-badge fallback for missing icons.

const iconCache = new Map<string, string | null>();

async function searchIcon(query: string): Promise<string | null> {
  if (iconCache.has(query)) return iconCache.get(query) ?? null;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { coins?: { symbol: string; large?: string; thumb?: string }[] };
    const coins = data.coins ?? [];
    const exact = coins.find((c) => c.symbol?.toLowerCase() === query.toLowerCase());
    const icon = (exact ?? coins[0])?.large || (exact ?? coins[0])?.thumb || null;
    iconCache.set(query, icon);
    return icon;
  } catch {
    iconCache.set(query, null);
    return null;
  }
}

// Strips common network-suffix conventions (trc20, erc20, bsc, arb…) so a
// compound code like "usdttrc20" searches as "usdt" instead of failing outright.
function guessSymbol(code: string): string {
  return code.replace(/(trc20|erc20|bep20|bsc|arb|base|opeth|polygon)$/i, "");
}

export async function resolveIcons(codes: string[]): Promise<Record<string, string>> {
  const results = await Promise.all(
    codes.map(async (code) => {
      const icon = (await searchIcon(guessSymbol(code))) ?? (await searchIcon(code));
      return [code, icon] as const;
    }),
  );
  const out: Record<string, string> = {};
  for (const [code, icon] of results) {
    if (icon) out[code] = icon;
  }
  return out;
}
