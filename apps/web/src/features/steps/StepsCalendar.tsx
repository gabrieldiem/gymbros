import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { enUS, es } from 'react-day-picker/locale';

import { useI18n } from '../../i18n/context';
import { fromDay, toDay, type DayRange } from './stepDates';
import styles from './StepsCalendar.module.css';

type Props = {
  value: DayRange | null;
  onChange: (range: DayRange | null) => void;
  today: string;
  earliest: string;
  taken: string[];
};

/** One tap for a day, a second for a period. Days already logged show a dot, and can't be chosen
 * or crossed. Only loaded on the steps page. */
export default function StepsCalendar({ value, onChange, today, earliest, taken }: Props) {
  const { lang } = useI18n();
  const selected: DateRange | undefined = value
    ? { from: fromDay(value.start), to: fromDay(value.end) }
    : undefined;
  const takenDates = taken.map(fromDay);
  return (
    <DayPicker
      mode="range"
      locale={lang === 'es' ? es : enUS}
      weekStartsOn={1}
      showOutsideDays
      excludeDisabled
      min={0}
      selected={selected}
      defaultMonth={fromDay(today)}
      startMonth={fromDay(earliest)}
      endMonth={fromDay(today)}
      disabled={[{ before: fromDay(earliest) }, { after: fromDay(today) }, ...takenDates]}
      modifiers={{ logged: takenDates }}
      modifiersClassNames={{ logged: styles.logged ?? '' }}
      onSelect={(range) =>
        onChange(
          range?.from ? { start: toDay(range.from), end: toDay(range.to ?? range.from) } : null,
        )
      }
      classNames={{
        root: styles.root ?? '',
        months: styles.months ?? '',
        month: styles.month ?? '',
        month_caption: styles.caption ?? '',
        caption_label: styles.captionLabel ?? '',
        nav: styles.nav ?? '',
        button_previous: styles.navButton ?? '',
        button_next: styles.navButton ?? '',
        month_grid: styles.grid ?? '',
        weekday: styles.weekday ?? '',
        day: styles.day ?? '',
        day_button: styles.dayButton ?? '',
        today: styles.today ?? '',
        outside: styles.outside ?? '',
        disabled: styles.disabled ?? '',
        selected: styles.selected ?? '',
        range_start: styles.rangeStart ?? '',
        range_middle: styles.rangeMiddle ?? '',
        range_end: styles.rangeEnd ?? '',
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft size={20} aria-hidden="true" />
          ) : (
            <ChevronRight size={20} aria-hidden="true" />
          ),
      }}
    />
  );
}
