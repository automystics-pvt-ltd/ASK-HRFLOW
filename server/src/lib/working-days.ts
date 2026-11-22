/** Count weekdays (Mon–Fri) inclusive between two `yyyy-mm-dd` dates. */
export function workingDaysBetween(start: string, end: string): number {
  let n = 0;
  for (let d = new Date(start + 'T00:00'); d <= new Date(end + 'T00:00'); d.setDate(d.getDate() + 1)) {
    if (d.getDay() % 6 !== 0) n++;
  }
  return n;
}

/** Hours between two timestamps, floored at 0, rounded to 2 decimals. */
export function hoursBetween(checkIn: string | Date, checkOut: string | Date): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round(((b - a) / 3_600_000) * 100) / 100;
}
