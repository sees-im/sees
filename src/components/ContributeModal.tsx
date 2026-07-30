import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, HeartHandshake, Loader2, Search, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Turnstile } from "@/components/Turnstile";
import { metaFor } from "@/lib/currencyMeta";
import {
  createContributionPayment,
  getContributionCurrencies,
  getContributionPaymentStatus,
} from "@/lib/nearpayments.functions";

const PRESET_AMOUNTS = [5, 10, 25, 50];

const DONE_STATUSES = new Set(["finished", "confirmed"]);
const DEAD_STATUSES = new Set(["failed", "expired", "refunded"]);

type Step = "amount" | "currency" | "pay" | "done";

interface PaymentInfo {
  paymentId: string;
  payAddress: string;
  payAmount: string;
  payCurrency: string;
}

export function ContributeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [status, setStatus] = useState<string>("waiting");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currencies, setCurrencies] = useState<string[] | null>(null);
  const [resolvedIcons, setResolvedIcons] = useState<Record<string, string>>({});
  const [currenciesError, setCurrenciesError] = useState(false);
  const [search, setSearch] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const activeAmount = customAmount ? Number(customAmount) : amount;
  const canContinue = Number.isFinite(activeAmount) && activeAmount > 0;

  const reset = () => {
    setStep("amount");
    setError(null);
    setCustomAmount("");
    setPayment(null);
    setStatus("waiting");
    setQrDataUrl(null);
    setCopied(false);
    setSearch("");
    setTurnstileToken(null);
  };

  // Fetch the merchant's actually-enabled currencies once, when the currency
  // step is first reached (not on every open, so it isn't re-fetched if the
  // user goes back and forth between amount/currency).
  useEffect(() => {
    if (step !== "currency" || currencies !== null || currenciesError) return;
    let cancelled = false;
    getContributionCurrencies()
      .then((result) => {
        if (cancelled) return;
        setCurrencies(result.currencies);
        setResolvedIcons(result.icons);
      })
      .catch(() => {
        if (!cancelled) setCurrenciesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [step, currencies, currenciesError]);

  const filteredCurrencies = useMemo(() => {
    const list = currencies ?? [];
    const q = search.trim().toLowerCase();
    const withMeta = list.map((code) => {
      const meta = metaFor(code);
      return { code, meta: meta.icon ? meta : { ...meta, icon: resolvedIcons[code] } };
    });
    if (!q) return withMeta;
    return withMeta.filter(
      ({ code, meta }) =>
        code.includes(q) || meta.label.toLowerCase().includes(q) || meta.network.toLowerCase().includes(q),
    );
  }, [currencies, search]);

  const chooseCurrency = async (payCurrency: string) => {
    if (!turnstileToken) {
      setError("Complete the verification check below.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createContributionPayment({
        data: {
          amount: activeAmount,
          currency: "usd",
          payCurrency,
          origin: window.location.origin,
          turnstileToken,
        },
      });
      setPayment({
        paymentId: result.paymentId,
        payAddress: result.payAddress,
        payAmount: result.payAmount,
        payCurrency: result.payCurrency,
      });
      setStatus(result.status);
      setStep("pay");
    } catch {
      setError("Could not create that payment. Try a different currency.");
    } finally {
      setBusy(false);
    }
  };

  // QR code for the pay address, styled to match the vault's 2FA QR.
  useEffect(() => {
    if (!payment) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(payment.payAddress, {
      margin: 1,
      width: 192,
      color: { dark: "#ff7a2f", light: "#090604" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payment]);

  // Poll payment status while awaiting funds.
  useEffect(() => {
    if (!payment || DONE_STATUSES.has(status) || DEAD_STATUSES.has(status)) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const result = await getContributionPaymentStatus({
          data: { paymentId: payment.paymentId },
        });
        if (cancelled) return;
        setStatus(result.status);
        if (DONE_STATUSES.has(result.status)) setStep("done");
      } catch {
        // transient — keep polling
      }
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [payment, status]);

  const copyAddress = () => {
    if (!payment) return;
    navigator.clipboard.writeText(payment.payAddress).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="contribute-trigger">
          <HeartHandshake className="size-3.5" strokeWidth={1.8} />
          Contribute
          <span aria-hidden>→</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="contribute-overlay" />
        <Dialog.Content className="contribute-modal">
          <div className="contribute-modal__head">
            <Dialog.Title className="contribute-modal__brand">
              <BrandMark variant="wordmark" />
              <span className="sr-only">Support SEES</span>
            </Dialog.Title>
            <Dialog.Description>
              Independent privacy software, funded by its community.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button type="button" className="contribute-modal__close" aria-label="Close">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {step === "amount" && (
            <>
              <div className="contribute-amounts" role="tablist" aria-label="Contribution amount">
                {PRESET_AMOUNTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={!customAmount && amount === value}
                    className={!customAmount && amount === value ? "is-active" : ""}
                    onClick={() => {
                      setAmount(value);
                      setCustomAmount("");
                    }}
                  >
                    ${value}
                  </button>
                ))}
              </div>
              <div className="contribute-custom">
                <span>$</span>
                <input
                  type="number"
                  min={1}
                  step="1"
                  inputMode="decimal"
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="contribute-submit"
                disabled={!canContinue}
                onClick={() => setStep("currency")}
              >
                Continue with ${activeAmount || 0}
              </button>
              <p className="contribute-note">Private contributions. No account required.</p>
            </>
          )}

          {step === "currency" && (
            <>
              {currencies === null && !currenciesError && (
                <p className="contribute-note">
                  <Loader2 className="size-3.5 animate-spin" style={{ display: "inline", marginRight: 6 }} />
                  Loading available currencies…
                </p>
              )}

              {currenciesError && (
                <p className="contribute-error">
                  Could not load currencies.{" "}
                  <button
                    type="button"
                    className="contribute-back"
                    style={{ display: "inline" }}
                    onClick={() => setCurrenciesError(false)}
                  >
                    Retry
                  </button>
                </p>
              )}

              {currencies !== null && !currenciesError && (
                <>
                  <Turnstile onVerify={setTurnstileToken} />
                  <div className="contribute-search">
                    <Search className="size-3.5" />
                    <input
                      type="text"
                      placeholder="Search currency or network…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>

                  {filteredCurrencies.length === 0 ? (
                    <p className="contribute-note">No currencies match "{search}".</p>
                  ) : (
                    <div className="contribute-currency-grid">
                      {filteredCurrencies.map(({ code, meta }) => (
                        <button
                          key={code}
                          type="button"
                          className="contribute-currency"
                          disabled={busy || !turnstileToken}
                          onClick={() => chooseCurrency(code)}
                        >
                          {meta.icon ? (
                            <img src={meta.icon} alt="" className="contribute-currency__icon" loading="lazy" />
                          ) : (
                            <span className="contribute-currency__fallback">{code.slice(0, 2)}</span>
                          )}
                          <span className="contribute-currency__text">
                            <span className="contribute-currency__ticker">{code.toUpperCase()}</span>
                            <span className="contribute-currency__label">
                              {meta.label}
                              {meta.network && meta.network !== meta.label ? ` · ${meta.network}` : ""}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {error && <p className="contribute-error">{error}</p>}
              {busy && (
                <p className="contribute-note">
                  <Loader2 className="size-3.5 animate-spin" style={{ display: "inline", marginRight: 6 }} />
                  Preparing payment…
                </p>
              )}
              <button type="button" className="contribute-back" onClick={() => setStep("amount")}>
                ← Back
              </button>
            </>
          )}

          {step === "pay" && payment && (
            <div className="contribute-pay">
              {qrDataUrl && <img src={qrDataUrl} alt="Payment address QR code" className="contribute-pay__qr" />}
              <div className="contribute-pay__amount">
                {payment.payAmount} <span>{payment.payCurrency.toUpperCase()}</span>
              </div>
              <button type="button" className="contribute-pay__address" onClick={copyAddress}>
                <span>{payment.payAddress}</span>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </button>
              <p className="contribute-pay__status">
                <span className="status-pulse" /> Waiting for payment…
              </p>
              <button type="button" className="contribute-back" onClick={() => setStep("currency")}>
                ← Choose a different currency
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="contribute-done">
              <div className="contribute-done__icon">
                <Check className="size-6" strokeWidth={2.2} />
              </div>
              <p>Contribution received. Thank you for supporting independent privacy software.</p>
              <Dialog.Close asChild>
                <button type="button" className="contribute-submit">
                  Close
                </button>
              </Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
