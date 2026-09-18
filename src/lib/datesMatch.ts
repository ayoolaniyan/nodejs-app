import { TimeUnit } from '../enums/timeUnit.enum';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the start of the calendar bucket `date` falls into, for the given
 * unit, as a comparable string key. Two dates are in the same bucket when
 * their keys are identical.
 *
 * Buckets are aligned to calendar boundaries rather than to elapsed time:
 * 23:59 and 00:01 the next day are one minute apart but are different days,
 * and 31 December and 1 January are different years.
 */
function bucketKey(date: Date, unit: TimeUnit): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  switch (unit) {
    case TimeUnit.Minute:
      return `${year}-${month}-${day}T${date.getUTCHours()}:${date.getUTCMinutes()}`;
    case TimeUnit.Hour:
      return `${year}-${month}-${day}T${date.getUTCHours()}`;
    case TimeUnit.Day:
      return `${year}-${month}-${day}`;
    case TimeUnit.Week: {
      // Monday-based week. getUTCDay() is 0 for Sunday, so shift it so that
      // Monday is 0 and Sunday is 6, then step back to that week's Monday.
      const dayOfWeek = (date.getUTCDay() + 6) % 7;
      const monday = new Date(
        Date.UTC(year, month, day) - dayOfWeek * MS_PER_DAY,
      );
      return `W${monday.toISOString().slice(0, 10)}`;
    }
    case TimeUnit.Month:
      return `${year}-${month}`;
    case TimeUnit.Quarter:
      return `${year}-Q${Math.floor(month / 3)}`;
    case TimeUnit.Year:
      return `${year}`;
    default: {
      // Exhaustiveness check: adding a TimeUnit without handling it here is a
      // compile error rather than a silent `false` at runtime.
      const unhandled: never = unit;
      throw new Error(`Unsupported time unit: ${unhandled}`);
    }
  }
}

/**
 * Whether two dates fall within the same calendar bucket at the given
 * granularity.
 *
 * @example
 * datesMatch(new Date('2023-05-03T10:00:00Z'), new Date('2023-05-03T10:00:30Z'), TimeUnit.Minute) // true
 * datesMatch(new Date('2023-05-03T10:00:00Z'), new Date('2023-05-03T10:01:00Z'), TimeUnit.Minute) // false
 */
export function datesMatch(a: Date, b: Date, unit: TimeUnit): boolean {
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    throw new TypeError('datesMatch received an invalid Date');
  }
  return bucketKey(a, unit) === bucketKey(b, unit);
}
