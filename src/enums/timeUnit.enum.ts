/**
 * Granularity used when comparing two dates.
 *
 * Every unit is evaluated in UTC so that results do not depend on the
 * timezone of the machine running the code.
 */
export enum TimeUnit {
  Minute = 'MINUTE',
  Hour = 'HOUR',
  Day = 'DAY',
  /** ISO week: Monday 00:00:00 UTC through Sunday 23:59:59 UTC. */
  Week = 'WEEK',
  Month = 'MONTH',
  Quarter = 'QUARTER',
  Year = 'YEAR',
}
