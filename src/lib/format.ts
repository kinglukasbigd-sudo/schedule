import { differenceInCalendarDays, format } from 'date-fns';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fromDateKey } from '@/domain/schedule';
import { dateLocale } from '@/i18n';

export function capitalizeFirst(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

/** Locale-aware date helpers bound to the current language. */
export function useFormat() {
  const { t, i18n } = useTranslation();
  // The resolved i18n language switches only once its date locale has loaded.
  const language = i18n.language;
  return useMemo(() => {
    const locale = dateLocale(language);
    const fmt = (d: Date, pattern: string) => format(d, pattern, { locale });
    return {
      locale,
      weekday: (d: Date) => capitalizeFirst(fmt(d, 'EEEE')),
      weekdayShort: (d: Date) => capitalizeFirst(fmt(d, 'EEE')),
      dayMonth: (d: Date) => fmt(d, 'd MMM'),
      fullDate: (d: Date) => capitalizeFirst(fmt(d, 'EEEE, d MMMM')),
      monthDay: (d: Date) => fmt(d, 'd'),
      /**
       * "Today", "Tomorrow", "Friday", or "Mon 12 Oct" further out.
       * `inline` gives the mid-sentence form ("due tomorrow", "рок: петок").
       */
      relativeDay: (key: string, now: Date, inline = false) => {
        const d = fromDateKey(key);
        const diff = differenceInCalendarDays(d, now);
        const cap = inline ? (x: string) => x : capitalizeFirst;
        if (diff === 0) return t(inline ? 'time.todayInline' : 'time.today');
        if (diff === 1) return t(inline ? 'time.tomorrowInline' : 'time.tomorrow');
        if (diff === -1) return t(inline ? 'time.yesterdayInline' : 'time.yesterday');
        if (diff > 1 && diff < 7) return cap(fmt(d, 'EEEE'));
        return cap(fmt(d, 'EEE d MMM'));
      },
      /** "in 5 min", "in 1 h 20 min". */
      countdown: (minutes: number) => {
        if (minutes < 60) return t('time.inMinutes', { count: Math.max(1, Math.round(minutes)) });
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return m ? t('time.inHoursMinutes', { h, m }) : t('time.inHours', { count: h });
      },
    };
  }, [language, t]);
}
