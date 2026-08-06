import { useEffect, useRef, useState } from "react";

const LENGTH = 6;
const STEP_SECONDS = 30;

/** Seconds left before the authenticator rotates to a new code. */
function secondsLeft(): number {
  return STEP_SECONDS - (Math.floor(Date.now() / 1000) % STEP_SECONDS);
}

export function TwoFactorInput({
  value,
  onChange,
  onComplete,
  invalid = false,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: () => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [left, setLeft] = useState(STEP_SECONDS);
  const completedRef = useRef(false);

  const digits = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("");
  const filled = value.length;

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    const tick = () => setLeft(secondsLeft());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Fire once when the code first becomes complete — not on every re-render,
  // so a rejected code doesn't resubmit itself in a loop.
  useEffect(() => {
    if (value.length === LENGTH && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
    if (value.length < LENGTH) completedRef.current = false;
  }, [value, onComplete]);

  // Typing faster than React re-renders means each handler would otherwise read
  // a stale `value` prop and drop digits — which is exactly what a quick typist
  // or a password manager autofill does. The ref holds the authoritative value
  // and is updated synchronously so consecutive keystrokes chain correctly.
  const valueRef = useRef(value);
  valueRef.current = value;

  const commit = (next: string) => {
    valueRef.current = next;
    onChange(next);
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    // Typing over a full field replaces from here on rather than appending.
    const head = valueRef.current.slice(0, index);
    commit((head + digit).slice(0, LENGTH));
    inputsRef.current[Math.min(index + 1, LENGTH - 1)]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const current = valueRef.current;
      if (current[index]) {
        commit(current.slice(0, index));
      } else if (index > 0) {
        commit(current.slice(0, index - 1));
        inputsRef.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) inputsRef.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    e.preventDefault();
    commit(pasted);
    inputsRef.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
  };

  const urgent = left <= 5;

  return (
    <div className={`tfa${invalid ? " is-invalid" : ""}`}>
      <div className="tfa__head">
        <label className="tfa__label" htmlFor="two-factor-code-0">
          Authenticator code
        </label>
        <span className={`tfa__timer${urgent ? " is-urgent" : ""}`} aria-hidden>
          <svg viewBox="0 0 20 20" className="tfa__ring">
            <circle className="tfa__ring-track" cx="10" cy="10" r="8" />
            <circle
              className="tfa__ring-value"
              cx="10"
              cy="10"
              r="8"
              style={{ strokeDashoffset: 50.27 * (1 - left / STEP_SECONDS) }}
            />
          </svg>
          {left}s
        </span>
      </div>

      <div className="tfa__cells" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            id={`two-factor-code-${i}`}
            ref={(node) => {
              inputsRef.current[i] = node;
            }}
            className={`tfa__cell${digit.trim() ? " is-filled" : ""}${i === filled ? " is-active" : ""}`}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            disabled={disabled}
            value={digit.trim()}
            aria-label={`Digit ${i + 1} of ${LENGTH}`}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.currentTarget.select()}
          />
        ))}
      </div>

      <p className="tfa__hint">
        {invalid
          ? "That code didn't match. Wait for the next one and try again."
          : `Open your authenticator app — the code rotates every ${STEP_SECONDS} seconds.`}
      </p>
    </div>
  );
}
