import {
  extractVenueCode,
  formatBookingDateYYMMDD,
  generateUnambiguousCode,
  generateBookingNumber,
  parseBookingNumber,
} from './booking-number.util';

describe('BookingNumberUtil', () => {
  describe('extractVenueCode', () => {
    it('should extract initials for multi-word venue names', () => {
      expect(extractVenueCode('Skyline Sports Hub')).toBe('SSH');
      expect(extractVenueCode('Power Play Sports Arena')).toBe('PPSA');
    });

    it('should extract recognizable 2-3 letter code for 2-word names', () => {
      expect(extractVenueCode('Premier Arena')).toBe('PRA');
      expect(extractVenueCode('Spartan Turf')).toBe('SPT');
      expect(extractVenueCode('Green Field')).toBe('GF');
    });

    it('should take first 3 letters for single-word venue names', () => {
      expect(extractVenueCode('Decathlon')).toBe('DEC');
      expect(extractVenueCode('Kalyan')).toBe('KAL');
    });

    it('should fallback to TRF if venue name is missing or invalid', () => {
      expect(extractVenueCode('')).toBe('TRF');
      expect(extractVenueCode(undefined)).toBe('TRF');
    });
  });

  describe('formatBookingDateYYMMDD', () => {
    it('should format Date object as YYMMDD', () => {
      const d = new Date('2026-09-30T10:00:00Z');
      expect(formatBookingDateYYMMDD(d)).toBe('260930');
    });

    it('should format ISO date string as YYMMDD', () => {
      expect(formatBookingDateYYMMDD('2026-10-05')).toBe('261005');
    });
  });

  describe('generateUnambiguousCode', () => {
    it('should generate code without ambiguous characters (0, O, 1, I, L)', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateUnambiguousCode(4);
        expect(code).toHaveLength(4);
        expect(code).not.toMatch(/[0O1IL]/);
      }
    });
  });

  describe('generateBookingNumber', () => {
    it('should generate meaningful full booking ID', () => {
      const id = generateBookingNumber({
        prefix: 'TB',
        turfName: 'Premier Arena',
        bookingDate: '2026-09-30',
      });

      expect(id).toMatch(
        /^TB-PRA-260930-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/,
      );
      expect(id.length).toBeLessThanOrEqual(32);
    });

    it('should generate meaningful advance booking ID with ADV prefix', () => {
      const id = generateBookingNumber({
        prefix: 'ADV',
        turfName: 'Spartan Turf',
        bookingDate: '2026-10-05',
      });

      expect(id).toMatch(/^ADV-SPT-261005-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    });

    it('should generate meaningful walk-in booking ID with WLK prefix', () => {
      const id = generateBookingNumber({
        prefix: 'WLK',
        turfName: 'Green Field',
        bookingDate: '2026-09-30',
      });

      expect(id).toMatch(/^WLK-GF-260930-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    });
  });

  describe('parseBookingNumber', () => {
    it('should parse meaningful booking ID into components', () => {
      const parsed = parseBookingNumber('TB-PA-260930-7K9X');
      expect(parsed).toEqual({
        prefix: 'TB',
        venueCode: 'PA',
        date: '2026-09-30',
        code: '7K9X',
        displayBookingId: 'TB-PA-260930-7K9X',
      });
    });
  });
});
