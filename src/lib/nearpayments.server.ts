// Server-only NearPayments client. Never imported by client bundles.
// Docs: https://nearpayments.io/getting-started/introduction/

const API_BASE = "https://api.nearpayments.io/v1";

function getApiKey(): string {
  const key = process.env.NEARPAYMENTS_API_KEY;
  if (!key) throw new Error("NEARPAYMENTS_API_KEY is not configured");
  return key;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": getApiKey(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`NearPayments request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

export interface CreatePaymentParams {
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string;
  orderId: string;
  orderDescription?: string;
  ipnCallbackUrl?: string;
}

// Field types mirror the API's actual JSON, not what's convenient: NearPayments
// returns payment_id and the amount fields as unquoted numbers. Declaring them
// as strings silently broke status polling, since nothing validates the shape of
// untrusted JSON at runtime.
export interface NearPaymentsPayment {
  payment_id: number | string;
  payment_status: string;
  pay_address: string;
  price_amount: number | string;
  price_currency: string;
  pay_amount: number | string;
  pay_currency: string;
  order_id: string;
  actually_paid?: number | string;
}

export function createPayment(params: CreatePaymentParams): Promise<NearPaymentsPayment> {
  return request("/payment", {
    method: "POST",
    body: JSON.stringify({
      price_amount: params.priceAmount,
      price_currency: params.priceCurrency,
      pay_currency: params.payCurrency,
      order_id: params.orderId,
      order_description: params.orderDescription,
      ipn_callback_url: params.ipnCallbackUrl,
    }),
  });
}

export function getPaymentStatus(paymentId: string): Promise<NearPaymentsPayment> {
  return request(`/payment/${encodeURIComponent(paymentId)}`, { method: "GET" });
}

type CurrencyEntry = string | Record<string, unknown>;
type CurrencyPayload = CurrencyEntry[] | Record<string, unknown>;

// Entries come back either as bare tickers or as objects, and the object shape
// isn't consistent across the currency endpoints — hence the field probing
// rather than a fixed key. Anything we can't read a ticker out of is dropped,
// which is what stops a shape change from rendering "[object Object]" rows.
function toCode(entry: CurrencyEntry): string | null {
  if (typeof entry === "string") return entry.toLowerCase();
  if (!entry || typeof entry !== "object") return null;
  // An explicit disabled flag means the merchant can't receive it.
  if (entry.enabled === false || entry.is_available === false) return null;
  for (const key of ["currency", "code", "ticker", "symbol", "cg_id", "name"]) {
    const value = entry[key];
    if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
  }
  return null;
}

function toCodes(data: CurrencyPayload | null): string[] {
  if (!data) return [];
  const source = Array.isArray(data)
    ? data
    : ((data.selectedCurrencies ?? data.currencies ?? data.coins ?? []) as CurrencyEntry[]);
  if (!Array.isArray(source)) return [];
  return source.map(toCode).filter((c): c is string => Boolean(c));
}

// The chains we actually accept, matching the payout wallets configured in the
// NearPayments dashboard. This is maintained by hand because the API has no
// endpoint for it — /v1/merchant/coins and /v1/currencies both return every
// currency the platform supports (~190) with no per-merchant "enabled" flag,
// so the picker would otherwise offer coins with no wallet behind them.
//
// Add a chain here when you enable its wallet in the dashboard.
const ACCEPTED_CURRENCIES = new Set([
  // Native coins
  "btc", // Bitcoin
  "eth", // Ethereum
  "sol", // Solana
  "near", // NEAR Protocol
  "trx", // TRON
  "pol", // Polygon
  "bnb", // BNB Chain
  "xpl", // Plasma
  "ethbase", // Base (settles in ETH — Base has no native coin of its own)
  "ada", // Cardano
  "dash", // Dash
  "doge", // Dogecoin
  "ltc", // Litecoin
  "zec", // Zcash
  "bch", // Bitcoin Cash

  // Stablecoins on the smart-contract chains above. Where NearPayments lists
  // the same token twice (usdterc20/usdteth, usdtbep20/usdtbsc,
  // usdttrc20/usdttrx) only the canonical code is accepted, so donors don't see
  // two rows that look identical. Bitcoin, Dash, Doge, LTC, Zcash and BCH have
  // no token layer, hence no stablecoin entries.
  "usdterc20", // Tether — Ethereum
  "usdcerc20", // USD Coin — Ethereum
  "usdttrc20", // Tether — Tron
  "usdtpol", // Tether — Polygon
  "usdcpol", // USD Coin — Polygon
  "usdcbase", // USD Coin — Base (NearPayments lists no Tether on Base)
  "usdtnear", // Tether — NEAR
  "usdcnear", // USD Coin — NEAR
  "usdtsol", // Tether — Solana
  "usdcsol", // USD Coin — Solana
  "usdtbep20", // Tether — BNB Chain
  "usdcbep20", // USD Coin — BNB Chain
  "usdt0plasma", // Tether (USDT0) — Plasma
]);

// Returns the ticker codes offered in the contribute picker: the intersection
// of what NearPayments currently supports and ACCEPTED_CURRENCIES above, so a
// code that upstream drops stops being offered without a redeploy.
export async function getEnabledCurrencies(): Promise<string[]> {
  // /currencies, not /merchant/coins: the latter returns a differently-coded,
  // incomplete set that omits plain btc/eth/sol, which silently dropped half
  // the accepted chains from the picker.
  const supported = toCodes(
    await request<CurrencyPayload>("/currencies", { method: "GET" }).catch(() => null),
  );

  // Deduplicate — upstream can list the same ticker more than once.
  const offered = [...new Set(supported)].filter((code) => ACCEPTED_CURRENCIES.has(code));

  // If upstream returns something unrecognisable, show the accepted list anyway
  // rather than an empty picker — these are the chains with wallets configured.
  return offered.length ? offered : [...ACCEPTED_CURRENCIES];
}
