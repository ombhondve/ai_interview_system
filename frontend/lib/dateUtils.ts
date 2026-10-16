/**
 * Indian Standard Time (IST) Date and Time Formatting Utilities
 *
 * Requirements:
 * - Timezone: Asia/Kolkata
 * - Locale: en-IN
 * - Date format: e.g. "15 October 2026"
 * - Time format: e.g. "7:00 PM" or "7:00 PM IST"
 * - Combined format: e.g. "15 October 2026, 7:00 PM" or "15 October 2026, 7:00 PM IST"
 */

export const INDIAN_TIMEZONE = "Asia/Kolkata";
export const INDIAN_LOCALE = "en-IN";

/**
 * Safely parse an input value into a valid Date object or null.
 */
export function parseDateSafe(input: Date | string | number | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a date in Indian format: e.g. "15 October 2026"
 */
export function formatIndianDate(
  input: Date | string | number | null | undefined,
  fallback = "—"
): string {
  if (input === null || input === undefined || input === "") return fallback;
  const d = parseDateSafe(input);
  if (!d) {
    // If it's already a non-empty human-readable string, return as-is
    return typeof input === "string" ? input : fallback;
  }

  try {
    return new Intl.DateTimeFormat(INDIAN_LOCALE, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: INDIAN_TIMEZONE,
    }).format(d);
  } catch {
    return fallback;
  }
}

/**
 * Format a time in Indian 12-hour format: e.g. "7:00 PM" or "7:00 PM IST"
 */
export function formatIndianTime(
  input: Date | string | number | null | undefined,
  options?: { includeTimezone?: boolean; fallback?: string }
): string {
  const fallback = options?.fallback ?? "—";
  if (input === null || input === undefined || input === "") return fallback;

  // Handle plain time strings like "13:30" or "19:00:00"
  if (typeof input === "string") {
    const trimmed = input.trim();
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2];
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      const formatted = `${h}:${m} ${ampm}`;
      return options?.includeTimezone ? `${formatted} IST` : formatted;
    }

    // Check if already in 12-hour format like "7:00 PM"
    const twelveHourMatch = trimmed.match(/^(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm))(?:\s*IST)?$/i);
    if (twelveHourMatch) {
      const formatted = twelveHourMatch[1].toUpperCase();
      return options?.includeTimezone ? `${formatted} IST` : formatted;
    }
  }

  const d = parseDateSafe(input);
  if (!d) {
    return typeof input === "string" ? input : fallback;
  }

  try {
    const formatted = new Intl.DateTimeFormat(INDIAN_LOCALE, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: INDIAN_TIMEZONE,
    })
      .format(d)
      .toUpperCase();

    return options?.includeTimezone ? `${formatted} IST` : formatted;
  } catch {
    return fallback;
  }
}

/**
 * Format date and time in Indian format: e.g. "15 October 2026, 7:00 PM IST"
 */
export function formatIndianDateTime(
  input: Date | string | number | null | undefined,
  options?: { includeTimezone?: boolean; fallback?: string }
): string {
  const fallback = options?.fallback ?? "—";
  if (input === null || input === undefined || input === "") return fallback;
  const d = parseDateSafe(input);
  if (!d) {
    return typeof input === "string" ? input : fallback;
  }

  const datePart = formatIndianDate(d, fallback);
  const timePart = formatIndianTime(d, options);
  if (datePart === fallback) return fallback;
  return `${datePart}, ${timePart}`;
}
