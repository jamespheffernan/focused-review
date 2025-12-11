// utils/__tests__/date-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseNaturalDate, describeNaturalDate } from '../date-parser';

describe('date-parser', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  describe('parseNaturalDate', () => {
    it('should parse future dates correctly', () => {
      const result = parseNaturalDate('tomorrow');
      expect(result).not.toBeNull();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/); // ISO format
      const parsedDate = new Date(result! + 'T12:00:00');
      expect(parsedDate.getTime()).toBeGreaterThan(today.getTime());
    });

    it('should correct past dates to future', () => {
      // Test with a day name that might be in the past (e.g., "monday" on Thursday)
      const result = parseNaturalDate('monday');
      expect(result).not.toBeNull();
      const parsedDate = new Date(result! + 'T12:00:00');
      // Should be in the future (next Monday)
      expect(parsedDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    });

    it('should handle dates already in future', () => {
      const result = parseNaturalDate('next friday');
      expect(result).not.toBeNull();
      const parsedDate = new Date(result! + 'T12:00:00');
      expect(parsedDate.getTime()).toBeGreaterThan(today.getTime());
    });

    it('should return null for invalid input', () => {
      const result = parseNaturalDate('invalid date string');
      expect(result).toBeNull();
    });

    it('should return null for empty input', () => {
      expect(parseNaturalDate('')).toBeNull();
      expect(parseNaturalDate('   ')).toBeNull();
    });
  });

  describe('describeNaturalDate', () => {
    it('should format future dates correctly', () => {
      const result = describeNaturalDate('tomorrow');
      expect(result).not.toBeNull();
      expect(result).toMatch(/\w{3}, \w{3} \d{1,2}, \d{4}/); // Human-readable format
    });

    it('should correct past dates to future in preview', () => {
      // "monday" should show next Monday in preview, matching the saved date
      const input = 'monday';
      const parsed = parseNaturalDate(input);
      const described = describeNaturalDate(input);
      
      expect(parsed).not.toBeNull();
      expect(described).not.toBeNull();
      
      // Both should refer to the same future date
      const parsedDate = new Date(parsed! + 'T12:00:00');
      expect(parsedDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    });

    it('should match parsed date for preview (critical test)', () => {
      // Critical test: preview date should match saved date
      const input = 'monday';
      const parsed = parseNaturalDate(input);
      const described = describeNaturalDate(input);
      
      expect(parsed).not.toBeNull();
      expect(described).not.toBeNull();
      
      // Parse the described date to extract the date components
      const describedDate = new Date(described!);
      const parsedDate = new Date(parsed! + 'T12:00:00');
      
      // They should refer to the same calendar day
      expect(describedDate.getFullYear()).toBe(parsedDate.getFullYear());
      expect(describedDate.getMonth()).toBe(parsedDate.getMonth());
      expect(describedDate.getDate()).toBe(parsedDate.getDate());
    });

    it('should handle dates already in future', () => {
      const result = describeNaturalDate('next friday');
      expect(result).not.toBeNull();
      expect(result).toMatch(/\w{3}, \w{3} \d{1,2}, \d{4}/);
    });

    it('should return null for invalid input', () => {
      const result = describeNaturalDate('invalid date string');
      expect(result).toBeNull();
    });

    it('should return null for empty input', () => {
      expect(describeNaturalDate('')).toBeNull();
      expect(describeNaturalDate('   ')).toBeNull();
    });
  });

  describe('parseNaturalDate and describeNaturalDate alignment', () => {
    it('should produce matching dates for past inputs', () => {
      const input = 'monday'; // Might be in the past depending on current day
      const parsed = parseNaturalDate(input);
      const described = describeNaturalDate(input);
      
      expect(parsed).not.toBeNull();
      expect(described).not.toBeNull();
      
      // Both should refer to the same future date
      const parsedDate = new Date(parsed! + 'T12:00:00');
      const describedDate = new Date(described!);
      
      expect(parsedDate.getFullYear()).toBe(describedDate.getFullYear());
      expect(parsedDate.getMonth()).toBe(describedDate.getMonth());
      expect(parsedDate.getDate()).toBe(describedDate.getDate());
      // Both should be in the future
      expect(parsedDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    });

    it('should produce matching dates for future inputs', () => {
      const input = 'in 2 weeks';
      const parsed = parseNaturalDate(input);
      const described = describeNaturalDate(input);
      
      expect(parsed).not.toBeNull();
      expect(described).not.toBeNull();
      
      // Verify they refer to the same calendar day
      const parsedDate = new Date(parsed! + 'T12:00:00');
      const describedDate = new Date(described!);
      
      expect(parsedDate.getFullYear()).toBe(describedDate.getFullYear());
      expect(parsedDate.getMonth()).toBe(describedDate.getMonth());
      expect(parsedDate.getDate()).toBe(describedDate.getDate());
      // Both should be in the future
      expect(parsedDate.getTime()).toBeGreaterThan(today.getTime());
    });
  });
});

