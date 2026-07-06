"use client";

import { InputHTMLAttributes, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  cursorAfterNthDigit,
  digitCountBefore,
  digitsOnly,
  formatCard,
  formatDigitsGrouped,
  formatPhoneUZ,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type Kind = "digits" | "phone" | "card";

function formatFor(kind: Kind, raw: string): string {
  switch (kind) {
    case "phone":
      return formatPhoneUZ(raw);
    case "card":
      return formatCard(raw);
    case "digits":
    default:
      return formatDigitsGrouped(raw);
  }
}

// Kursor pozitsiyasini saqlagan holda formatni qo'llaydigan input yordamchisi.
// value — TASHQI (raw digits) qiymat, onValueChange — raw digits emit qiladi.
function useFormatted(
  kind: Kind,
  value: string,
  onValueChange: (raw: string) => void,
) {
  const ref = useRef<HTMLInputElement | null>(null);
  const nextCursor = useRef<number | null>(null);

  const display = formatFor(kind, value);

  useLayoutEffect(() => {
    if (nextCursor.current != null && ref.current) {
      try {
        ref.current.setSelectionRange(nextCursor.current, nextCursor.current);
      } catch {
        // firefox / IE — ignore
      }
      nextCursor.current = null;
    }
  }, [display]);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const raw = el.value;
      let digitsBefore = digitCountBefore(raw, el.selectionStart ?? raw.length);
      const rawDigits = digitsOnly(kind === "phone" ? raw.replace(/^\+?998/, "") : raw);
      const formatted = formatFor(kind, rawDigits);
      // Phone uchun: agar raw'da "+998" yo'q bo'lsa (masalan foydalanuvchi bo'sh joyga "1" yozdi),
      // format uchtta qo'shimcha raqamni ("998") oldiga qo'yadi, shuning uchun kursorni ham surish kerak.
      if (kind === "phone" && !raw.startsWith("+998") && !raw.startsWith("998") && rawDigits.length > 0) {
        digitsBefore += 3;
      }
      nextCursor.current = cursorAfterNthDigit(formatted, digitsBefore);
      const storedRaw = kind === "phone"
        ? digitsOnly(rawDigits).slice(0, 9)
        : digitsOnly(rawDigits);
      onValueChange(storedRaw);
    },
    [kind, onValueChange],
  );

  return { ref, display, onChange };
}

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (raw: string) => void;
  className?: string;
  invalid?: boolean;
};

const baseClass =
  "w-full h-11 px-3 bg-[var(--bg)] border border-[var(--border-strong)] rounded-[var(--r-control)] outline-none focus:border-[var(--accent)] transition-colors";

// NumberInput — raqamlar guruhlangan holda ko'rsatiladi ("1 234 567"). Value/onChange — RAW digits.
export function NumberInput({ value, onValueChange, className, invalid, ...rest }: BaseProps) {
  const { ref, display, onChange } = useFormatted("digits", value, onValueChange);
  return (
    <input
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      {...rest}
      value={display}
      onChange={onChange}
      className={cn(baseClass, invalid && "border-[var(--danger)]", className)}
    />
  );
}

// CurrencyInput — NumberInput bilan bir xil, o'ngda "so'm" suffiksi bo'ladi
export function CurrencyInput({
  value,
  onValueChange,
  className,
  invalid,
  suffix = "so'm",
  ...rest
}: BaseProps & { suffix?: string }) {
  const { ref, display, onChange } = useFormatted("digits", value, onValueChange);
  return (
    <div className="relative flex items-center">
      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        {...rest}
        value={display}
        onChange={onChange}
        className={cn(baseClass, "pr-14 tabular-nums", invalid && "border-[var(--danger)]", className)}
      />
      <span className="absolute right-3 text-sm text-[var(--text-muted)] pointer-events-none select-none">
        {suffix}
      </span>
    </div>
  );
}

// PhoneInput — O'zbek raqami formatida. Value — raw 9 raqam (masalan "886181917"), display — "+998 88 618 19 17".
export function PhoneInput({ value, onValueChange, className, invalid, ...rest }: BaseProps) {
  const { ref, display, onChange } = useFormatted("phone", value, onValueChange);

  useEffect(() => {
    // Boshida caret-ni "+998 " ni qamrab olmaslik uchun — foydalanuvchi kirsa avtomatik oxiriga o'tadi.
  }, []);

  return (
    <input
      ref={ref}
      inputMode="tel"
      autoComplete="tel"
      {...rest}
      value={display}
      onChange={onChange}
      onFocus={(e) => {
        // Bo'sh bo'lsa +998 ni ko'rsatib, kursorni oxirga qo'yamiz
        if (!value) {
          nextTickSetCursorEnd(e.currentTarget);
        }
        rest.onFocus?.(e);
      }}
      className={cn(baseClass, "font-mono tabular-nums tracking-wide", invalid && "border-[var(--danger)]", className)}
      placeholder={rest.placeholder ?? "+998 __ ___ __ __"}
    />
  );
}

function nextTickSetCursorEnd(el: HTMLInputElement) {
  requestAnimationFrame(() => {
    try {
      const n = el.value.length;
      el.setSelectionRange(n, n);
    } catch {
      // ignore
    }
  });
}

// CardInput — karta raqami 4-4-4-4 formatida. Value — raw digits.
export function CardInput({ value, onValueChange, className, invalid, ...rest }: BaseProps) {
  const { ref, display, onChange } = useFormatted("card", value, onValueChange);
  return (
    <input
      ref={ref}
      inputMode="numeric"
      autoComplete="cc-number"
      {...rest}
      value={display}
      onChange={onChange}
      className={cn(baseClass, "font-mono tabular-nums tracking-wider", invalid && "border-[var(--danger)]", className)}
      placeholder={rest.placeholder ?? "0000 0000 0000 0000"}
      maxLength={23}
    />
  );
}
