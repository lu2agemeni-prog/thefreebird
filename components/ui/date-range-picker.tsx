'use client';

// ============================================================================
// components/ui/date-range-picker.tsx
// منتقي نطاق التاريخ الاحترافي (Date Range Picker) للتقارير والحسابات المالية:
// - يدعم دورات الأشهر المالية للعيادات (من 21 إلى 20) وقائمة الأشهر الـ 12
// - خيارات وفترات سريعة: اليوم، أمس، هذا الأسبوع، آخر 30 يوماً، هذا العام، إلخ
// - إدخال نطاق مخصص (من تاريخ - إلى تاريخ) بدقة مع التحقق من صحة التواريخ
// - واجهة عربية كاملة، دعم الإغلاق عند النقر بالخارج، وتصميم متوافق مع Tailwind
// ============================================================================
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  X,
  Check,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';
import {
  getFinancialMonthBounds,
  getPreviousFinancialMonthBounds,
  getFinancialMonthsList,
  toDateInputValue,
  getTodayDateStr,
} from '@/lib/financialMonth';

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange, presetLabel?: string) => void;
  className?: string;
  placeholder?: string;
  showFinancialPresets?: boolean;
}

export function DateRangePicker({
  value,
  onChange,
  className = '',
  placeholder = 'اختر نطاق التاريخ...',
  showFinancialPresets = true,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // حالة الإدخال المؤقتة قبل الضغط على تطبيق
  const [tempFrom, setTempFrom] = useState(value.from || '');
  const [tempTo, setTempTo] = useState(value.to || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // قائمة الأشهر المالية لآخر 12 شهراً
  const financialMonths = useMemo(() => getFinancialMonthsList(12), []);

  // تحديث القيم المؤقتة عند تغير القيمة الخارجية
  useEffect(() => {
    const t = setTimeout(() => {
      setTempFrom(value.from || '');
      setTempTo(value.to || '');
    }, 0);
    return () => clearTimeout(t);
  }, [value.from, value.to]);

  // إغلاق النافذة عند النقر بالخارج
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // حساب عدد الأيام المحددة
  const daysCount = useMemo(() => {
    if (!value.from || !value.to) return null;
    const f = new Date(value.from);
    const t = new Date(value.to);
    const diff = Math.round((t.getTime() - f.getTime()) / (1000 * 3600 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [value.from, value.to]);

  // صياغة النص المعروض في الزر الرئيسي
  const displayLabel = useMemo(() => {
    if (!value.from && !value.to) return placeholder;

    // فحص ما إذا كان النطاق يطابق شهراً مالياً
    const curFin = getFinancialMonthBounds();
    if (value.from === curFin.startStr && value.to === curFin.endStr) {
      return 'الشهر المالي الحالي (21 - 20)';
    }

    const prevFin = getPreviousFinancialMonthBounds();
    if (value.from === prevFin.startStr && value.to === prevFin.endStr) {
      return 'الشهر المالي السابق (21 - 20)';
    }

    const matchedMonth = financialMonths.find(
      (m) => m.startStr === value.from && m.endStr === value.to
    );
    if (matchedMonth) {
      return matchedMonth.displayTitle;
    }

    const today = getTodayDateStr();
    if (value.from === today && value.to === today) {
      return 'اليوم';
    }

    if (value.from && value.to) {
      if (value.from === value.to) {
        return new Date(value.from).toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
      const fromFormatted = new Date(value.from).toLocaleDateString('ar-EG', {
        month: 'short',
        day: 'numeric',
      });
      const toFormatted = new Date(value.to).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      return `${fromFormatted} ➔ ${toFormatted}`;
    }

    if (value.from) return `من ${value.from}`;
    if (value.to) return `حتى ${value.to}`;
    return placeholder;
  }, [value, placeholder, financialMonths]);

  // تطبيق النطاق المخصص
  const handleApplyCustom = () => {
    setErrorMsg(null);
    if (tempFrom && tempTo && tempFrom > tempTo) {
      setErrorMsg('تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.');
      return;
    }
    onChange({ from: tempFrom, to: tempTo }, 'نطاق مخصص');
    setIsOpen(false);
  };

  // مسح الفلتر
  const handleClear = () => {
    setTempFrom('');
    setTempTo('');
    setErrorMsg(null);
    onChange({ from: '', to: '' }, 'كل الأوقات');
    setIsOpen(false);
  };

  // اختيار أحد الخيارات الجاهزة
  const handleSelectPreset = (
    from: string,
    to: string,
    label: string
  ) => {
    setTempFrom(from);
    setTempTo(to);
    setErrorMsg(null);
    onChange({ from, to }, label);
    setIsOpen(false);
  };

  // دوال الفترات الجاهزة
  const applyPreset = (preset: string) => {
    const now = new Date();
    const todayStr = getTodayDateStr();

    switch (preset) {
      case 'today':
        handleSelectPreset(todayStr, todayStr, 'اليوم');
        break;
      case 'yesterday': {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yStr = toDateInputValue(y);
        handleSelectPreset(yStr, yStr, 'أمس');
        break;
      }
      case 'currentFin': {
        const fin = getFinancialMonthBounds();
        handleSelectPreset(fin.startStr, fin.endStr, 'الشهر المالي الحالي');
        break;
      }
      case 'prevFin': {
        const pFin = getPreviousFinancialMonthBounds();
        handleSelectPreset(pFin.startStr, pFin.endStr, 'الشهر المالي السابق');
        break;
      }
      case 'last7': {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        handleSelectPreset(toDateInputValue(d), todayStr, 'آخر 7 أيام');
        break;
      }
      case 'last30': {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        handleSelectPreset(toDateInputValue(d), todayStr, 'آخر 30 يوماً');
        break;
      }
      case 'currentMonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        handleSelectPreset(toDateInputValue(start), toDateInputValue(end), 'هذا الشهر الميلادي');
        break;
      }
      case 'lastMonth': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        handleSelectPreset(toDateInputValue(start), toDateInputValue(end), 'الشهر الميلادي السابق');
        break;
      }
      case 'currentYear': {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        handleSelectPreset(toDateInputValue(start), toDateInputValue(end), 'هذا العام');
        break;
      }
      case 'all':
        handleClear();
        break;
      default:
        break;
    }
  };

  return (
    <div className={`relative inline-block text-right ${className}`} ref={containerRef}>
      {/* زر عرض منتقي التاريخ الرئيسي */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between gap-2.5 bg-white hover:bg-gray-50/90 text-gray-800 border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-2xs hover:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer min-w-[210px]"
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarRange className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">{displayLabel}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {daysCount && daysCount > 1 && (
            <span className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-md font-semibold border border-emerald-200/60">
              {daysCount} يوم
            </span>
          )}
          {value.from && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              title="مسح التاريخ"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-emerald-600' : ''
            }`}
          />
        </div>
      </button>

      {/* القائمة المنبثقة للاختيار (Dropdown Popover) */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-[340px] sm:w-[500px] animate-in fade-in zoom-in-95 duration-150"
          dir="rtl"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            {/* العمود الأيمن: الفترات السريعة ودورات الأشهر المالية */}
            <div className="sm:w-1/2 space-y-3 sm:border-l sm:border-gray-100 sm:pl-3">
              {showFinancialPresets && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                    دورات الشهر المالي (21 - 20):
                  </span>
                  <div className="grid grid-cols-1 gap-1">
                    <button
                      type="button"
                      onClick={() => applyPreset('currentFin')}
                      className="text-right px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-50 text-emerald-900 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>الشهر المالي الحالي (21 - 20)</span>
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('prevFin')}
                      className="text-right px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-50 text-gray-700 hover:text-emerald-900 transition-colors cursor-pointer"
                    >
                      <span>الشهر المالي السابق (21 - 20)</span>
                    </button>
                  </div>

                  {/* قائمة منسدلة بالأشهر الـ 12 السابقة */}
                  <div className="pt-1">
                    <label className="text-[10px] text-gray-400 block mb-1">اختر شهراً مالياً محدداً:</label>
                    <select
                      onChange={(e) => {
                        const found = financialMonths.find((m) => m.id === e.target.value);
                        if (found) {
                          handleSelectPreset(found.startStr, found.endStr, found.displayTitle);
                        }
                      }}
                      className="w-full border border-gray-200 rounded-lg p-1.5 text-xs bg-gray-50 focus:bg-white text-gray-800 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        -- أرشيف الأشهر المالية --
                      </option>
                      {financialMonths.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayTitle}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* الفترات الزمنية العامة */}
              <div className="pt-2 border-t border-gray-100 space-y-1">
                <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  فترات سريعة:
                </span>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => applyPreset('today')}
                    className="text-right px-2 py-1 rounded-md text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('yesterday')}
                    className="text-right px-2 py-1 rounded-md text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    أمس
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('last7')}
                    className="text-right px-2 py-1 rounded-md text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    آخر 7 أيام
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('last30')}
                    className="text-right px-2 py-1 rounded-md text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    آخر 30 يوماً
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('currentMonth')}
                    className="text-right px-2 py-1 rounded-md text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    هذا الشهر (ميلادي)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('all')}
                    className="text-right px-2 py-1 rounded-md text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    كل الأوقات
                  </button>
                </div>
              </div>
            </div>

            {/* العمود الأيسر: إدخال نطاق مخصص محدد */}
            <div className="sm:w-1/2 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1 border-b pb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  تحديد نطاق مخصص باليوم:
                </span>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">
                      من تاريخ (البداية):
                    </label>
                    <input
                      type="date"
                      value={tempFrom}
                      onChange={(e) => setTempFrom(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl p-2 text-xs font-mono bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">
                      إلى تاريخ (النهاية):
                    </label>
                    <input
                      type="date"
                      value={tempTo}
                      onChange={(e) => setTempTo(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl p-2 text-xs font-mono bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-[11px] text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-200">
                    {errorMsg}
                  </p>
                )}
              </div>

              {/* أزرار الإجراءات (تطبيق / مسح / إلغاء) */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-gray-500 hover:text-red-600 font-bold transition-colors cursor-pointer px-2 py-1"
                >
                  تصفير
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>تطبيق</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
