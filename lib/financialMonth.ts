// ============================================================================
// lib/financialMonth.ts
// الشهر المالي المعتمد للعيادات:
// يبدأ من أول يوم 21 في الشهر وحتى نهاية يوم 20 في الشهر التالي.
// ============================================================================

export function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * إرجاع تاريخ اليوم بصيغة YYYY-MM-DD وفق التوقيت المحلي للمركز (توقيت القاهرة)
 * لتفادي مشاكل فرق التوقيت مع جرينتش (UTC) في الساعات المسائية والليلية.
 */
export function getTodayDateStr(): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  } catch {
    return toDateInputValue(new Date());
  }
}

export interface FinancialPeriod {
  start: Date;
  end: Date;
  startStr: string; // YYYY-MM-21
  endStr: string;   // YYYY-MM-20
  label: string;
}

/**
 * إرجاع حدود الشهر المالي لتاريخ مرجعي معين (أو تاريخ اليوم افتراضياً).
 * القاعدة:
 * - إذا كان اليوم >= 21: الشهر المالي يبدأ في 21 من الشهر الحالي وينتهي في 20 من الشهر التالي.
 * - إذا كان اليوم < 21: الشهر المالي بدأ في 21 من الشهر السابق وينتهي في 20 من الشهر الحالي.
 */
export function getFinancialMonthBounds(refDate: Date | string = new Date()): FinancialPeriod {
  const d = typeof refDate === 'string' ? new Date(`${refDate.slice(0, 10)}T00:00:00`) : new Date(refDate);
  const day = d.getDate();
  const month = d.getMonth(); // 0 to 11
  const year = d.getFullYear();

  let startYear = year;
  let startMonth = month;
  let endYear = year;
  let endMonth = month;

  if (day >= 21) {
    // يبدأ من 21 في هذا الشهر الحالي
    startYear = year;
    startMonth = month;
    // وينتهي في 20 من الشهر التالي
    if (month === 11) {
      endYear = year + 1;
      endMonth = 0;
    } else {
      endYear = year;
      endMonth = month + 1;
    }
  } else {
    // يبدأ من 21 في الشهر الماضي
    if (month === 0) {
      startYear = year - 1;
      startMonth = 11;
    } else {
      startYear = year;
      startMonth = month - 1;
    }
    // وينتهي في 20 من هذا الشهر الحالي
    endYear = year;
    endMonth = month;
  }

  const start = new Date(startYear, startMonth, 21, 0, 0, 0);
  const end = new Date(endYear, endMonth, 20, 23, 59, 59);
  const startStr = toDateInputValue(start);
  const endStr = toDateInputValue(end);

  const startMonthName = start.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  const endMonthName = end.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  const label = `الشهر المالي (${startStr} إلى ${endStr})`;

  return { start, end, startStr, endStr, label };
}

/**
 * إرجاع حدود الشهر المالي السابق
 */
export function getPreviousFinancialMonthBounds(refDate: Date | string = new Date()): FinancialPeriod {
  const current = getFinancialMonthBounds(refDate);
  // نرجع يوماً واحداً قبل تاريخ بداية الشهر الحالي
  const prevRef = new Date(current.start);
  prevRef.setDate(prevRef.getDate() - 1);
  return getFinancialMonthBounds(prevRef);
}

/**
 * التحقق مما إذا كان تاريخ معين يقع داخل نطاق شهر مالي
 */
export function isDateInFinancialMonth(dateStr: string, period: FinancialPeriod): boolean {
  const target = dateStr.slice(0, 10);
  return target >= period.startStr && target <= period.endStr;
}

/**
 * إرجاع قائمة بالأشهر المالية لآخر N شهراً (لتسهيل الاختيار من Dropdown في واجهة الإدارة)
 */
export function getFinancialMonthsList(count = 12): Array<FinancialPeriod & { id: string; displayTitle: string }> {
  const list: Array<FinancialPeriod & { id: string; displayTitle: string }> = [];
  let ref = new Date();
  for (let i = 0; i < count; i++) {
    const period = getFinancialMonthBounds(ref);
    const startMonth = period.start.toLocaleDateString('ar-EG', { month: 'short' });
    const endMonth = period.end.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' });
    list.push({
      ...period,
      id: `${period.startStr}_${period.endStr}`,
      displayTitle: `${startMonth} - ${endMonth} (${period.startStr.slice(5)} إلى ${period.endStr.slice(5)})`,
    });
    // نرجع يوماً واحداً قبل بداية الشهر للوصول للشهر السابق
    const prev = new Date(period.start);
    prev.setDate(prev.getDate() - 1);
    ref = prev;
  }
  return list;
}
