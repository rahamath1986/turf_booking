import { randomBytes } from 'crypto';

/**
 * Crockford Base32 alphabet for unambiguous, human-readable codes.
 * Excludes characters that are easily misread on screens or over the phone:
 * - '0' (zero) and 'O' (letter O)
 * - '1' (one), 'I' (letter I), and 'L' (letter L)
 */
const CROCKFORD_BASE32_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export interface GenerateBookingNumberOptions {
  /**
   * Booking type prefix:
   * - 'TB': Standard Online Turf Booking
   * - 'ADV': Advance / Token Payment Booking
   * - 'WLK': Walk-in / On-site Counter Booking
   * Defaults to 'TB'.
   */
  prefix?: 'TB' | 'ADV' | 'WLK' | string;

  /**
   * Name of the turf venue (used to generate meaningful 2-4 letter venue initials).
   * E.g. "Premier Arena" -> "PA", "Skyline Sports Hub" -> "SSH", "Spartan Turf" -> "SPT"
   */
  turfName?: string;

  /**
   * Scheduled booking date (used to encode YYMMDD in the ID).
   */
  bookingDate?: Date | string;

  /**
   * Desired length of random alphanumeric verification suffix (default: 4).
   */
  randomLength?: number;
}

/**
 * Extracts a clean, meaningful 2-4 letter uppercase code from a turf venue name.
 * Examples:
 * - "Premier Arena" -> "PA"
 * - "Skyline Sports Hub" -> "SSH"
 * - "Power Play Turf" -> "PPT"
 * - "Spartan Turf" -> "SPT"
 * - "Decathlon" -> "DEC"
 * - "Kalyan" -> "KAL"
 * - Fallback -> "TRF"
 */
export function extractVenueCode(turfName?: string): string {
  if (!turfName || typeof turfName !== 'string') {
    return 'TRF';
  }

  // Remove non-alphanumeric characters except spaces
  const words = turfName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'TRF';
  }

  if (words.length >= 3) {
    // E.g. "Skyline Sports Hub" -> "SSH", "Power Play Sports Arena" -> "PPSA"
    const initials = words
      .slice(0, 4)
      .map((w) => w[0].toUpperCase())
      .join('');
    return initials.slice(0, 4);
  }

  if (words.length === 2) {
    const w1 = words[0].toUpperCase();
    const w2 = words[1].toUpperCase();

    // If second word is a generic venue word ("TURF", "ARENA", "SPORTS") and first word is >= 2 chars:
    // e.g. "Spartan Turf" -> "SPT", "Rocket Arena" -> "RKA"
    if (
      w1.length >= 2 &&
      (w2 === 'TURF' || w2 === 'ARENA' || w2 === 'SPORTS' || w2 === 'CLUB')
    ) {
      const p1 = w1.slice(0, 2);
      const p2 = w2[0];
      return `${p1}${p2}`;
    }

    // Default 2 initials, e.g. "Premier Arena" -> "PA", "Green Field" -> "GF"
    return `${w1[0]}${w2[0]}`;
  }

  // Single word: take first 3 characters uppercase, e.g. "Decathlon" -> "DEC"
  const single = words[0].toUpperCase();
  return single.length >= 3 ? single.slice(0, 3) : single.padEnd(3, 'X');
}

/**
 * Formats a given date as YYMMDD.
 * Example: Date("2026-09-30") -> "260930"
 */
export function formatBookingDateYYMMDD(date?: Date | string): string {
  let d: Date;
  if (date instanceof Date) {
    d = isNaN(date.getTime()) ? new Date() : date;
  } else if (typeof date === 'string' && date.trim().length > 0) {
    d = new Date(date);
    if (isNaN(d.getTime())) {
      d = new Date();
    }
  } else {
    d = new Date();
  }

  const year = String(d.getFullYear()).slice(-2);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

/**
 * Generates an unambiguous random alphanumeric string using Crockford Base32.
 */
export function generateUnambiguousCode(length = 4): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code +=
      CROCKFORD_BASE32_ALPHABET[bytes[i] % CROCKFORD_BASE32_ALPHABET.length];
  }
  return code;
}

/**
 * Generates a meaningful, human-friendly booking number suitable for display,
 * customer receipts, SMS/WhatsApp notifications, and gate check-in scanning.
 *
 * Format: `[PREFIX]-[VENUE]-[YYMMDD]-[CODE]`
 * Examples:
 * - Full online booking: `TB-PA-260930-7K9X`
 * - Advance token booking: `ADV-PA-260930-7K9X`
 * - Walk-in counter booking: `WLK-SPT-260930-4M2P`
 *
 * Max length is well under database limit (<= 20 chars vs @db.VarChar(32)).
 */
export function generateBookingNumber(
  options: GenerateBookingNumberOptions = {},
): string {
  const prefix = (options.prefix || 'TB').toUpperCase().trim();
  const venueCode = extractVenueCode(options.turfName);
  const dateStr = formatBookingDateYYMMDD(options.bookingDate);
  const randomSuffix = generateUnambiguousCode(options.randomLength || 4);

  return `${prefix}-${venueCode}-${dateStr}-${randomSuffix}`.slice(0, 32);
}

/**
 * Parses a meaningful booking number into its semantic components.
 */
export function parseBookingNumber(bookingNumber: string) {
  if (!bookingNumber || typeof bookingNumber !== 'string') {
    return null;
  }

  const parts = bookingNumber.split('-');
  if (parts.length >= 4) {
    const [prefix, venueCode, dateStr, code] = parts;
    const year = dateStr.length === 6 ? `20${dateStr.slice(0, 2)}` : null;
    const month = dateStr.length === 6 ? dateStr.slice(2, 4) : null;
    const day = dateStr.length === 6 ? dateStr.slice(4, 6) : null;

    return {
      prefix,
      venueCode,
      date: year && month && day ? `${year}-${month}-${day}` : dateStr,
      code,
      displayBookingId: bookingNumber,
    };
  }

  return {
    prefix: parts[0] || 'TB',
    displayBookingId: bookingNumber,
  };
}
