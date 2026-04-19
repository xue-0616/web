"use client";

import {
  forwardRef,
  type KeyboardEvent,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { OTP_LENGTH, onDigitChange } from "@/lib/otp";

export interface OtpInputHandle {
  focus: () => void;
  clear: () => void;
}

export interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  errorId?: string;
}

/**
 * Six-box OTP input with:
 *   * per-box numeric keyboard on mobile (`inputMode=numeric`)
 *   * paste-to-splay across boxes (PIN codes pasted as a single string)
 *   * Backspace on an empty box jumps focus to the previous box
 *   * ArrowLeft/ArrowRight horizontal navigation
 *   * full keyboard accessibility + aria-invalid wiring for error text
 *
 * Stateless: exposes `value: string` (up to OTP_LENGTH digits) upward.
 * The pure state transitions are in `@/lib/otp` and tested there.
 */
export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  { value, onChange, onComplete, disabled, ariaLabel, errorId },
  ref,
) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useImperativeHandle(ref, () => ({
    focus: () => refs.current[0]?.focus(),
    clear: () => {
      onChange("");
      refs.current[0]?.focus();
    },
  }));

  useEffect(() => {
    if (value.length === OTP_LENGTH) onComplete?.(value);
    // onComplete deliberately omitted — callers should use a stable fn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? "");

  function handleChange(i: number, raw: string) {
    const { digits: next, focus } = onDigitChange(digits, i, raw);
    onChange(next.join(""));
    const target = refs.current[focus];
    // Defer focus to after the re-render commits.
    if (target) queueMicrotask(() => target.focus());
  }

  function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      handleChange(i - 1, "");
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel ?? "One-time code"}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
      style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted.length > 0) {
              e.preventDefault();
              handleChange(i, pasted);
            }
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          data-testid={`otp-${i}`}
          style={{
            width: "2.5rem",
            height: "3rem",
            textAlign: "center",
            fontSize: "1.5rem",
            border: "1px solid #999",
            borderRadius: "0.25rem",
          }}
        />
      ))}
    </div>
  );
});
