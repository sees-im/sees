// Regenerates src/lib/currencyIcons.generated.ts — a static symbol -> icon URL
// snapshot pulled from CoinGecko.
//
// Why a snapshot instead of a runtime lookup: CoinGecko's free tier throttles
// requests from shared datacenter IPs, so calling it from the deployed server
// resolved almost nothing. Icons are pure decoration and change rarely, so we
// resolve them once here and ship the result.
//
//   node scripts/generate-currency-icons.mjs
//
// Safe to re-run; review the diff before committing.

import { writeFileSync } from "node:fs";

const LIST_URL = "https://api.coingecko.com/api/v3/coins/list";
const MARKETS_URL = "https://api.coingecko.com/api/v3/coins/markets";
const OUT = new URL("../src/lib/currencyIcons.generated.ts", import.meta.url);

// Depth of the market-cap ranking to capture, so newly enabled NearPayments
// currencies usually resolve without regenerating this file.
const TOP_PAGES = 4;
const PER_PAGE = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, attempt = 0) {
  const res = await fetch(url);
  if (res.status === 429 && attempt < 5) {
    const wait = 15_000 * (attempt + 1);
    console.log(`  rate limited, retrying in ${wait / 1000}s…`);
    await sleep(wait);
    return getJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 80)}`);
  return res.json();
}

const icons = new Map();

console.log("fetching top coins by market cap…");
for (let page = 1; page <= TOP_PAGES; page++) {
  const rows = await getJson(
    `${MARKETS_URL}?vs_currency=usd&order=market_cap_desc&per_page=${PER_PAGE}&page=${page}`,
  );
  if (!rows.length) break;
  for (const coin of rows) {
    const symbol = coin.symbol?.toLowerCase();
    if (symbol && coin.image && !icons.has(symbol)) icons.set(symbol, coin.image);
  }
  console.log(`  page ${page}: ${icons.size} symbols so far`);
  await sleep(3000);
}

// The currency codes NearPayments actually lists. Kept here so the snapshot is
// derived from real demand rather than guesswork — the resolver's own suffix
// rules turn these into the base symbols we need to look up. Refresh by
// re-reading the codes from the live contribute modal if the list changes.
const CODES = `
AAVEAPT AAVEETH ABG ADA ADIADI ADIETH ALEO APT ARB ASTER AURORAETH AURORANEAR
AVAX BCH BERA BLACKDRAGON BNB BOME BRETT BTC BTC(OMNI) BTCAPT BTCBTC BTCNEAR
CBBTCBASE CBBTCETH CFIBASE CFINEAR COCABASE COCAPOL COW DAI DASH DOGE DOGEAPT
DOGEDOGE ETH ETHABS ETHAPT ETHARB ETHBASE ETHETH ETHNEAR ETHOP ETHSCROLL EURE
EVAA FMS FOGO FRAX GBPE GMX GNEAR GNO GRAM GTUSDCP HAPIETH HAPINEAR HEMIBTC INX
ITLX JAMBO KAITO KNC KV-GTSOLB LINKAPT LINKETH LOUD LTC LTCAPT LTCLTC MELANIA
MOG MON MOVE MPDAO MWUSDC NEAR NEARKAT NOEAR NPRO NRUSDTBSC NRUSDTNEAR OKB OP
PENGU PEPE POL PUBLICNEAR PUBLICSOL PURGE RHEABSC RHEANEAR SAFEETH SAFEGNOSIS
SHIB SHITZU SOL SOLAPT SOLSOL SPARKUSDC SPXETH SPXSOL SSC1_PIT STEAKUSDC STJACK
STNEAR STRK SUI SUSDCBASE SUSDCSOL SWEATARB SWEATBASE SWEATBSC SWEATETH
SWEATNEAR TESTNEBULA TITN TLO TRUMP TRX TURBOETH TURBONEAR TURBOSOL UNIAPT
UNIETH USAD USD1ETH USD1SOL USDCAPT USDCARB USDCAVAX USDCBASE USDCBEP20 USDCBSC
USDCERC20 USDCETH USDCGNOSIS USDCHYPERCORE USDCMONAD USDCNEAR USDCOP USDCPOL
USDCSOL USDCSUI USDCXALEO USDCXLAYER USDCXLM USDCXMOVEMENT USDF
USDT0(DEPRECATED) USDT0ARB USDT0BERA USDT0MONAD USDT0PLASMA USDT0XLAYER USDTAPT
USDTAVAX USDTBEP20 USDTBSC USDTERC20 USDTETH USDTGNOSIS USDTNEAR USDTOP USDTPOL
USDTSCROLL USDTSOL USDTTON USDTTRC20 USDTTRX VVV WBTCETH WBTCNEAR WETHARB
WETHBASE WETHETH WETHGNOSIS WETHOP WETHPOL XAUT XBTC XDAI XLM XPL
XPL_(DEPRECATED) XRP XRPAPT XRPSTARK XRPXRP ZEC ZECAPT ZECNEAR ZECSOL ZECSTARK
ZECZEC
`
  .trim()
  .split(/\s+/);

// Mirrors the suffix stripping in src/lib/coingecko.server.ts.
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

const normalize = (c) =>
  c
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[_\s-].*$/, "")
    .trim();

function candidates(code) {
  const base = normalize(code);
  const suffix = NETWORK_SUFFIXES.find((s) => base.length > s.length && base.endsWith(s));
  return suffix ? [base, base.slice(0, -suffix.length)] : [base];
}

const EXTRA = [...new Set(CODES.flatMap(candidates))];

console.log("resolving long-tail symbols…");
const list = await getJson(LIST_URL);
const idsBySymbol = new Map();
for (const coin of list) {
  const symbol = coin.symbol?.toLowerCase();
  if (!symbol || icons.has(symbol) || !EXTRA.includes(symbol)) continue;
  if (!idsBySymbol.has(symbol)) idsBySymbol.set(symbol, []);
  idsBySymbol.get(symbol).push(coin.id);
}

const ids = [...idsBySymbol.values()].flat();
for (let i = 0; i < ids.length; i += PER_PAGE) {
  const chunk = ids.slice(i, i + PER_PAGE);
  const rows = await getJson(
    `${MARKETS_URL}?vs_currency=usd&order=market_cap_desc&per_page=${PER_PAGE}` +
      `&page=1&ids=${encodeURIComponent(chunk.join(","))}`,
  );
  for (const coin of rows) {
    const symbol = coin.symbol?.toLowerCase();
    if (symbol && coin.image && !icons.has(symbol)) icons.set(symbol, coin.image);
  }
  await sleep(3000);
}

const missing = EXTRA.filter((s) => !icons.has(s));
if (missing.length) console.log("  unresolved (no CoinGecko listing):", missing.join(", "));

// Drop the cache-busting query string — it only inflates the diff on every run.
const sorted = [...icons.entries()]
  .map(([symbol, url]) => [symbol, url.split("?")[0]])
  .sort(([a], [b]) => a.localeCompare(b));

const body = sorted
  .map(([symbol, url]) => `  ${JSON.stringify(symbol)}: ${JSON.stringify(url)},`)
  .join("\n");

writeFileSync(
  OUT,
  `// GENERATED FILE — do not edit by hand.\n` +
    `// Regenerate with: node scripts/generate-currency-icons.mjs\n` +
    `// Source: CoinGecko public API. ${sorted.length} symbols.\n\n` +
    `export const GENERATED_ICONS: Record<string, string> = {\n${body}\n};\n`,
);

console.log(`\nwrote ${sorted.length} symbols -> src/lib/currencyIcons.generated.ts`);
