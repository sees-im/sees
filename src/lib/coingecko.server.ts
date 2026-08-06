// Server-only, best-effort icon lookup for currency codes we don't have
// hand-curated metadata for in CURRENCY_META. Callers already render a text
// badge when a code resolves to nothing, so misses are harmless.
//
// This reads from a static snapshot rather than calling CoinGecko at request
// time. CoinGecko's free tier throttles shared datacenter IPs, so live lookups
// from the deployed server resolved almost nothing — and batching them made it
// all-or-nothing, which was worse. Icons are decoration and change rarely, so
// they're resolved once by scripts/generate-currency-icons.mjs and shipped.

import { GENERATED_ICONS } from "./currencyIcons.generated";

// Network/chain suffixes NearPayments appends to a base asset (usdcnear,
// zecsol, wethpol…). Longest first, so "bep20" is matched before "op" and a
// code like "usdcbase" isn't truncated at the wrong boundary.
const NETWORK_SUFFIXES = [
  "hypercore",
  "movement",
  "polygon",
  "gnosis",
  "plasma",
  "xlayer",
  "scroll",
  "monad",
  "trc20",
  "erc20",
  "bep20",
  "stark",
  "aleo",
  "avax",
  "bera",
  "base",
  "near",
  "doge",
  "opeth",
  "layer",
  "abs",
  "apt",
  "arb",
  "bsc",
  "btc",
  "eth",
  "kat",
  "ltc",
  "pol",
  "sol",
  "sui",
  "ton",
  "trx",
  "xlm",
  "xrp",
  "zec",
  "op",
];

// "USDT0(DEPRECATED)" -> "usdt0", "XPL_(DEPRECATED)" -> "xpl"
function normalize(code: string): string {
  return code
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[_\s-].*$/, "")
    .trim();
}

function stripNetwork(code: string): string | null {
  for (const suffix of NETWORK_SUFFIXES) {
    if (code.length > suffix.length && code.endsWith(suffix)) {
      return code.slice(0, -suffix.length);
    }
  }
  return null;
}

// Symbols a code could resolve to, most specific first: an exact match beats
// one found by peeling off a chain suffix.
function candidates(code: string): string[] {
  const base = normalize(code);
  const stripped = stripNetwork(base);
  return stripped ? [base, stripped] : [base];
}

export function resolveIcons(codes: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of codes) {
    for (const candidate of candidates(code)) {
      const icon = GENERATED_ICONS[candidate];
      if (icon) {
        out[code] = icon;
        break;
      }
    }
  }
  return out;
}
