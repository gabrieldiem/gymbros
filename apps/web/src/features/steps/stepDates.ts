/** Dates here are days on the crew's calendar, so they never go through a time zone. */
export const toDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

export const fromDay = (day: string): Date => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
};

export const addDays = (day: string, count: number): string => {
  const date = fromDay(day);
  date.setDate(date.getDate() + count);
  return toDay(date);
};

export type DayRange = { start: string; end: string };

/** Whether any day of a period is already logged. */
export const rangeIsFree = ({ start, end }: DayRange, taken: string[]): boolean =>
  !taken.some((day) => day >= start && day <= end);
