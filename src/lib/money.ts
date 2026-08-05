const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINRFromPaise(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return INR_FORMATTER.format(rupees);
}

export function formatINRNoCurrencyFromPaise(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rupees);
}

/**
 * Accepts "1234", "1,234", "₹1,234.50", "-90.5". Returns null for anything else,
 * so callers can tell "the user typed nothing useful" apart from "the user typed 0".
 */
export function parseINRToPaiseOrNull(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!cleaned) return null;

  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;

  const [, sign, whole, fractionRaw = ""] = match;
  // Pad to 3 digits so the third one can round the paise, rather than truncating.
  const fraction = fractionRaw.padEnd(3, "0");
  const paise = Number(whole) * 100 + Number(fraction.slice(0, 2)) + (Number(fraction[2]) >= 5 ? 1 : 0);
  if (!Number.isSafeInteger(paise)) return null;

  return sign === "-" ? -paise : paise;
}

export function isValidINRInput(input: string): boolean {
  return parseINRToPaiseOrNull(input) !== null;
}

export function parseINRToPaise(input: string): number {
  return parseINRToPaiseOrNull(input) ?? 0;
}

