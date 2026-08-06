import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveIcons } from "./coingecko.server";
import { CURRENCY_META } from "./currencyMeta";
import { createPayment, getEnabledCurrencies, getPaymentStatus } from "./nearpayments.server";
import { verifyTurnstileToken } from "./turnstile.server";

export const getContributionCurrencies = createServerFn({ method: "GET" }).handler(async () => {
  const currencies = await getEnabledCurrencies();
  // Keyed on the icon, not the entry: a few curated entries carry a label and
  // network but no artwork, and those still deserve the generated fallback.
  const unknown = currencies.filter((code) => !CURRENCY_META[code]?.icon);
  const icons = unknown.length ? resolveIcons(unknown) : {};
  return { currencies, icons };
});

const contributeSchema = z.object({
  amount: z.number().positive().max(50_000),
  currency: z.string().trim().toLowerCase().min(2).max(8).default("usd"),
  payCurrency: z.string().trim().toLowerCase().min(2).max(20),
  origin: z.string().url(),
  turnstileToken: z.string().min(1),
});

export const createContributionPayment = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      amount: number;
      currency?: string;
      payCurrency: string;
      origin: string;
      turnstileToken: string;
    }) => contributeSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const verified = await verifyTurnstileToken(
      data.turnstileToken,
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    );
    if (!verified) {
      throw new Error("Bot verification failed. Please try again.");
    }
    const orderId = `contribute-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const payment = await createPayment({
      priceAmount: data.amount,
      priceCurrency: data.currency,
      payCurrency: data.payCurrency,
      orderId,
      orderDescription: "Contribution to SEES",
      ipnCallbackUrl: `${data.origin}/api/webhooks/nearpayments`,
    });
    return {
      paymentId: String(payment.payment_id),
      payAddress: payment.pay_address,
      payAmount: String(payment.pay_amount),
      payCurrency: payment.pay_currency,
      status: String(payment.payment_status ?? ""),
    };
  });

// NearPayments returns payment_id as a JSON number in some responses despite
// the documented string type, so coerce rather than reject it outright.
const statusSchema = z.object({ paymentId: z.coerce.string().trim().min(1).max(128) });

export const getContributionPaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { paymentId: string | number }) => statusSchema.parse(input))
  .handler(async ({ data }) => {
    // Return the failure instead of throwing: a thrown error serializes into an
    // opaque transport error, which is what made a broken poll indistinguishable
    // from a pending payment.
    try {
      const payment = await getPaymentStatus(data.paymentId);
      const raw = String(payment.payment_status ?? "");
      const status = raw.trim().toLowerCase();
      return { status, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Contribution status lookup failed", message);
      return { status: null, error: message };
    }
  });
