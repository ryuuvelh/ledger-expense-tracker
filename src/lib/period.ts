import { addMonths, startOfMonth } from "date-fns";
import { CustomDateRange, DateRange, getPeriodRange, ReportPreset } from "./reports";

export function getPresetRange(
  preset: ReportPreset,
  referenceDate: Date,
  customRange?: CustomDateRange
): DateRange {
  return getPeriodRange({ preset, referenceDate, customRange });
}

export function getCurrentMonthRange(referenceDate: Date): DateRange {
  const start = startOfMonth(referenceDate);
  const end = addMonths(start, 1);
  return { start, end };
}
