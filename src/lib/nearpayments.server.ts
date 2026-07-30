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

export interface NearPaymentsPayment {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: string;
  price_currency: string;
  pay_amount: string;
  pay_currency: string;
  order_id: string;
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

// Returns the ticker codes currently enabled on this merchant's NearPayments
// storefront — the source of truth for which chains are actually wired up
// with a payout wallet (vs. just theoretically supported by the adapter).
export async function getEnabledCurrencies(): Promise<string[]> {
  const data = await request<{ currencies?: string[] } | string[]>("/currencies", {
    method: "GET",
  });
  const list = Array.isArray(data) ? data : (data.currencies ?? []);
  return list.map((c) => String(c).toLowerCase());
}
