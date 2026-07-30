import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveIcons } from "./coingecko.server";
import { CURRENCY_META } from "./currencyMeta";
import { createPayment, getEnabledCurrencies, getPaymentStatus } from "./nearpayments.server";
import { verifyTurnstileToken } from "./turnstile.server";

export const getContributionCurrencies = createServerFn({ method: "GET" }).handler(async () => {
  const currencies = await getEnabledCurrencies();
  const unknown = currencies.filter((code) => !CURRENCY_META[code]);
  const icons = unknown.length ? await resolveIcons(unknown) : {};
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
    (input: { amount: number; currency?: string; payCurrency: string; origin: string; turnstileToken: string }) =>
      contributeSchema.parse(input),
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
      paymentId: payment.payment_id,
      payAddress: payment.pay_address,
      payAmount: payment.pay_amount,
      payCurrency: payment.pay_currency,
      status: payment.payment_status,
    };
  });

const statusSchema = z.object({ paymentId: z.string().trim().min(1).max(128) });

export const getContributionPaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { paymentId: string }) => statusSchema.parse(input))
  .handler(async ({ data }) => {
    const payment = await getPaymentStatus(data.paymentId);
    return { status: payment.payment_status };
  });
