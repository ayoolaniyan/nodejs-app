import { TimeUnit } from 'src/enums/timeUnit.enum';
import { datesMatch } from 'src/lib/datesMatch';

// Include the datesMatch function here or import it from another file

// Test cases for datesMatch function
describe('datesMatch', () => {
  test('should correctly compare dates with time unit "Minute"', () => {
    const date1 = new Date('2023-05-03T10:00:00Z');
    const date2 = new Date('2023-05-03T10:00:30Z');
    const date3 = new Date('2023-05-03T10:01:00Z');

    expect(datesMatch(date1, date2, TimeUnit.Minute)).toBe(true);
    expect(datesMatch(date1, date3, TimeUnit.Minute)).toBe(false);
  });

  test('should correctly compare dates with time unit "Hour"', () => {
    const date1 = new Date('2023-05-03T10:00:00Z');
    const date2 = new Date('2023-05-03T10:15:00Z');
    const date3 = new Date('2023-05-03T11:00:00Z');

    expect(datesMatch(date1, date2, TimeUnit.Hour)).toBe(true);
    expect(datesMatch(date1, date3, TimeUnit.Hour)).toBe(false);
  });

  test('should correctly compare dates with time unit "Day"', () => {
    const date1 = new Date('2023-05-03T10:10:00Z');
    const date2 = new Date('2023-05-03T12:20:00Z');
    const date3 = new Date('2023-05-04T10:00:00Z');

    expect(datesMatch(date1, date2, TimeUnit.Day)).toBe(true);
    expect(datesMatch(date1, date3, TimeUnit.Day)).toBe(false);
  });

  test('should correctly compare dates with time unit "Week"', () => {
    const date1 = new Date('2023-05-03T10:00:00Z');
    const date2 = new Date('2023-05-05T10:00:00Z');
    const date3 = new Date('2023-05-08T10:00:00Z');

    expect(datesMatch(date1, date2, TimeUnit.Week)).toBe(true);
    expect(datesMatch(date1, date3, TimeUnit.Week)).toBe(false);
  });

  test('should correctly compare dates with time unit "Month"', () => {
    const date1 = new Date('2023-05-03T10:00:00Z');
    const date2 = new Date('2023-05-15T10:00:00Z');
    const date3 = new Date('2023-06-03T10:00:00Z');

    expect(datesMatch(date1, date2, TimeUnit.Month)).toBe(true);
    expect(datesMatch(date1, date3, TimeUnit.Month)).toBe(false);
  });

  test('should correctly compare dates with time unit "Quarter"', () => {
    const date1 = new Date('2023-05-03T10:00:00Z');
    const date2 = new Date('2023-06-15T10:00:00Z');
    const date3 = new Date('2023-07-03T10:00:00Z');

    expect(datesMatch(date1, date2, TimeUnit.Quarter)).toBe(true);
    expect(datesMatch(date1, date3, TimeUnit.Quarter)).toBe(false);
  });

  test('should correctly compare dates with time unit "Year"', () => {
    const date1 = new Date('2023-05-03T10:00:00Z');
    const date2 = new Date('2023-11-15T10:00:00Z');
    const date3 = new Date('2024-05-03T10:00:00Z');

    expect(datesMatch(date1, date2, TimeUnit.Year)).toBe(true);
    expect(datesMatch(date1, date3, TimeUnit.Year)).toBe(false);
  });

  test('treats calendar boundaries, not elapsed time, as the bucket edge', () => {
    // Two minutes apart, but on different days and in different years.
    const lastMinuteOfYear = new Date('2023-12-31T23:59:00Z');
    const firstMinuteOfYear = new Date('2024-01-01T00:01:00Z');

    expect(datesMatch(lastMinuteOfYear, firstMinuteOfYear, TimeUnit.Day)).toBe(
      false,
    );
    expect(datesMatch(lastMinuteOfYear, firstMinuteOfYear, TimeUnit.Year)).toBe(
      false,
    );
    // 2023-12-31 is a Sunday and 2024-01-01 a Monday: different ISO weeks.
    expect(datesMatch(lastMinuteOfYear, firstMinuteOfYear, TimeUnit.Week)).toBe(
      false,
    );
  });

  test('rejects an invalid Date rather than comparing NaN', () => {
    expect(() =>
      datesMatch(new Date('not a date'), new Date(), TimeUnit.Day),
    ).toThrow(TypeError);
  });
});
