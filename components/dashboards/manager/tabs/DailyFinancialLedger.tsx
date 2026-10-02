'use client';

// ============================================================================
// components/dashboards/manager/tabs/DailyFinancialLedger.tsx
// السجل المالي اليومي للإيرادات والمصروفات لكافة العيادات:
// - كل صف يمثل يوماً واحداً مع إجمالي إيراداته ومصروفاته وصافيه وتفصيل كل عيادة.
// - يدعم تحديد الشهر المالي المعتمد (من 21 حتى 20) مع إمكانية اختيار يوم محدد أو نطاق تاريخ مخصص.
// - فلتر مالي مرن: (الكل / إيرادات فقط / مصروفات فقط) وفلتر العيادات والبحث.
// - تصدير مباشر إلى Excel بصيغة منسقة وطباعة تقرير رسمي A4.
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Building2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import {
  getFinancialMonthBounds,
  getPreviousFinancialMonthBounds,
  getFinancialMonthsList,
  toDateInputValue,
  getTodayDateStr,
} from '@/lib/financialMonth';
import { exportRowsToExcel } from '@/lib/export-excel';
import { PrintableReportModal } from '@/components/ui/printable-report-modal';

export interface DailyLedgerRow {
  dateStr: string; // YYYY-MM-DD
  dateObj: Date;
  dayName: string; // الخميس، الجمعة، ...
  dayNumber: number; // 21, 22, ...
  formattedDate: string; // 21 سبتمبر 2026
  isToday: boolean;
  isFriday: boolean;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  incomeCount: number;
  expenseCount: number;
  totalCount: number;
  clinicBreakdown: Record<string, {
    clinicName: string;
    income: number;
    expense: number;
    count: number;
  }>;
  transactions: any[];
}

export function DailyFinancialLedger() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);

  // وضع التاريخ: نطاق (Range) أو يوم محدد (Single Day)
  const [dateMode, setDateMode] = useState<'range' | 'single'>('range');

  // حدود التواريخ (الافتراضي: الشهر المالي الحالي من 21 حتى 20)
  const [dateFrom, setDateFrom] = useState(() => getFinancialMonthBounds().startStr);
  const [dateTo, setDateTo] = useState(() => getFinancialMonthBounds().endStr);
  const [singleDate, setSingleDate] = useState(() => getTodayDateStr());

  // الشهر المالي المختار من القائمة المنسدلة
  const [selectedMonthId, setSelectedMonthId] = useState<string>(() => {
    const cur = getFinancialMonthBounds();
    return `${cur.startStr}_${cur.endStr}`;
  });

  // فلاتر العرض
  // typeFilter: 'all' | 'income' | 'expense'
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [clinicFilter, setClinicFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [showZeroDays, setShowZeroDays] = useState<boolean>(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // ترتيب الأيام تنازلي أو تصاعدي

  // الأيام الموسعة لعرض تفاصيل الحركات
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // نافذة الطباعة
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // قائمة الأشهر المالية لآخر 12 شهراً
  const financialMonths = useMemo(() => getFinancialMonthsList(12), []);

  // جلب قائمة العيادات
  useEffect(() => {
    supabase
      .from('clinics')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setClinics(data);
      });
  }, []);

  // تحديد النطاق الفعلي للجلب
  const activeDateFrom = dateMode === 'single' ? singleDate : (dateFrom || getFinancialMonthBounds().startStr);
  const activeDateTo = dateMode === 'single' ? singleDate : (dateTo || getFinancialMonthBounds().endStr);

  // جلب حركات الفترة المحددة
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('transactions')
        .select(`
          id,
          type,
          amount,
          created_at,
          clinic_id,
          category,
          expense_group,
          description,
          clinics:clinic_id(id, name),
          profiles:user_id(first_name, last_name),
          beneficiary:beneficiary_id(first_name, last_name)
        `)
        .gte('created_at', `${activeDateFrom}T00:00:00`)
        .lte('created_at', `${activeDateTo}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (fetchErr) {
        setError('تعذر تحميل بيانات الحركات المالية للفترة المحددة.');
      } else {
        setTransactions(data || []);
      }
    } catch {
      setError('حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  }, [activeDateFrom, activeDateTo]);

  useEffect(() => {
    const t = setTimeout(fetchData, 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  // استبعاد القيود المكررة أو المشوهة لضمان دقة الأرقام
  const cleanedTransactions = useMemo(() => {
    const validRows: any[] = [];
    transactions.forEach((t) => {
      if (t.type === 'income') {
        if (Number(t.amount) === 0) return;
        const curTime = t.created_at ? new Date(t.created_at).getTime() : 0;
        const isTwin = validRows.some((prev) => {
          if (prev.type !== 'income') return false;
          if (Number(prev.amount) !== Number(t.amount)) return false;
          if (prev.clinic_id !== t.clinic_id) return false;
          const prevTime = prev.created_at ? new Date(prev.created_at).getTime() : 0;
          return Math.abs(curTime - prevTime) <= 15000;
        });
        if (!isTwin) validRows.push(t);
      } else {
        validRows.push(t);
      }
    });
    return validRows;
  }, [transactions]);

  // تطبيق فلاتر العيادة والبحث على الحركات قبل التجميع اليومي
  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cleanedTransactions.filter((t) => {
      // فلتر العيادة
      if (clinicFilter !== 'all') {
        if (clinicFilter === '__unassigned__') {
          if (t.clinic_id) return false;
        } else if (t.clinic_id !== clinicFilter) {
          return false;
        }
      }

      // فلتر نوع الحركة (إيراد أو مصروف)
      if (typeFilter === 'income' && t.type !== 'income') return false;
      if (typeFilter === 'expense' && t.type === 'income') return false;

      // فلتر البحث بالبيان أو الطبيب
      if (q) {
        const desc = (t.description || '').toLowerCase();
        const cat = (t.category || '').toLowerCase();
        const clinicName = (t.clinics?.name || '').toLowerCase();
        const userName = `${t.profiles?.first_name || ''} ${t.profiles?.last_name || ''}`.toLowerCase();
        const beneName = `${t.beneficiary?.first_name || ''} ${t.beneficiary?.last_name || ''}`.toLowerCase();
        const match = desc.includes(q) || cat.includes(q) || clinicName.includes(q) || userName.includes(q) || beneName.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [cleanedTransactions, clinicFilter, typeFilter, search]);

  // تجميع الأيام وفق النطاق المحدد (من 21 حتى 20 أو يوم محدد)
  // بحيث كل صف يكون فيه يوماً واحداً
  const dailyRows = useMemo(() => {
    if (!activeDateFrom || !activeDateTo) return [];

    const start = new Date(`${activeDateFrom}T00:00:00`);
    const end = new Date(`${activeDateTo}T00:00:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

    // خريطة لتجميع الحركات حسب التاريخ
    const groups: Record<string, any[]> = {};
    filteredTransactions.forEach((t) => {
      const d = t.created_at ? t.created_at.slice(0, 10) : '';
      if (!d) return;
      if (!groups[d]) groups[d] = [];
      groups[d].push(t);
    });

    const todayStr = getTodayDateStr();
    const rows: DailyLedgerRow[] = [];

    // توليد الأيام يوماً بيوم من البداية إلى النهاية
    const curr = new Date(start);
    while (curr <= end) {
      const dateStr = toDateInputValue(curr);
      const dayTransactions = groups[dateStr] || [];

      let totalIncome = 0;
      let totalExpense = 0;
      let incomeCount = 0;
      let expenseCount = 0;

      const clinicBreakdown: Record<string, { clinicName: string; income: number; expense: number; count: number }> = {};

      dayTransactions.forEach((t) => {
        const amt = Number(t.amount || 0);
        const clinicKey = t.clinic_id || '__unassigned__';
        const clinicName = t.clinics?.name || 'المركز العام / غير محدد';

        if (!clinicBreakdown[clinicKey]) {
          clinicBreakdown[clinicKey] = {
            clinicName,
            income: 0,
            expense: 0,
            count: 0,
          };
        }

        clinicBreakdown[clinicKey].count += 1;

        if (t.type === 'income') {
          totalIncome += amt;
          incomeCount += 1;
          clinicBreakdown[clinicKey].income += amt;
        } else {
          totalExpense += amt;
          expenseCount += 1;
          clinicBreakdown[clinicKey].expense += amt;
        }
      });

      const dayOfWeekIdx = curr.getDay(); // 5 = الجمعة
      const dayName = curr.toLocaleDateString('ar-EG', { weekday: 'long' });
      const dayNumber = curr.getDate();
      const formattedDate = curr.toLocaleDateString('ar-EG', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const row: DailyLedgerRow = {
        dateStr,
        dateObj: new Date(curr),
        dayName,
        dayNumber,
        formattedDate,
        isToday: dateStr === todayStr,
        isFriday: dayOfWeekIdx === 5,
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        incomeCount,
        expenseCount,
        totalCount: dayTransactions.length,
        clinicBreakdown,
        transactions: dayTransactions,
      };

      // إذا كان خيار إخفاء الأيام الخالية مفعلاً، يتم تجاهل اليوم إذا كانت حركاته 0
      if (showZeroDays || row.totalCount > 0) {
        rows.push(row);
      }

      // زيادة يوم واحد
      curr.setDate(curr.getDate() + 1);
    }

    // الترتيب حسب رغبة المستخدم
    if (sortOrder === 'desc') {
      rows.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    } else {
      rows.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }

    return rows;
  }, [activeDateFrom, activeDateTo, filteredTransactions, showZeroDays, sortOrder]);

  // إحصائيات الفترة الإجمالية
  const periodTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let totalCount = 0;
    let activeDaysCount = 0;
    let maxIncomeDay: { date: string; amount: number } = { date: '', amount: 0 };

    dailyRows.forEach((r) => {
      income += r.totalIncome;
      expense += r.totalExpense;
      totalCount += r.totalCount;
      if (r.totalCount > 0) activeDaysCount++;
      if (r.totalIncome > maxIncomeDay.amount) {
        maxIncomeDay = { date: `${r.dayName} ${r.formattedDate}`, amount: r.totalIncome };
      }
    });

    const net = income - expense;
    const avgDailyIncome = activeDaysCount > 0 ? Math.round(income / activeDaysCount) : 0;
    const avgDailyNet = activeDaysCount > 0 ? Math.round(net / activeDaysCount) : 0;

    return {
      income,
      expense,
      net,
      totalCount,
      activeDaysCount,
      daysCount: dailyRows.length,
      avgDailyIncome,
      avgDailyNet,
      maxIncomeDay,
    };
  }, [dailyRows]);

  // تبديل توسيع يوم معين
  const toggleDateExpanded = (dateStr: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  // توسيع / طي كافة الأيام
  const toggleAllExpanded = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    if (expand) {
      dailyRows.forEach((r) => {
        if (r.totalCount > 0) next[r.dateStr] = true;
      });
    }
    setExpandedDates(next);
  };

  // تحديد شهر مالي من القائمة (21 - 20)
  const handleSelectFinancialMonth = (monthId: string) => {
    setSelectedMonthId(monthId);
    setDateMode('range');
    if (!monthId) return;
    const found = financialMonths.find((m) => m.id === monthId);
    if (found) {
      setDateFrom(found.startStr);
      setDateTo(found.endStr);
    }
  };

  // أزرار الاختيار السريع للفترات
  const handleQuickPreset = (preset: 'current_fin' | 'prev_fin' | 'today' | 'last7' | 'last30') => {
    const now = new Date();
    if (preset === 'current_fin') {
      const fin = getFinancialMonthBounds(now);
      setDateMode('range');
      setDateFrom(fin.startStr);
      setDateTo(fin.endStr);
      setSelectedMonthId(`${fin.startStr}_${fin.endStr}`);
    } else if (preset === 'prev_fin') {
      const prev = getPreviousFinancialMonthBounds(now);
      setDateMode('range');
      setDateFrom(prev.startStr);
      setDateTo(prev.endStr);
      setSelectedMonthId(`${prev.startStr}_${prev.endStr}`);
    } else if (preset === 'today') {
      const today = getTodayDateStr();
      setDateMode('single');
      setSingleDate(today);
      setSelectedMonthId('');
    } else if (preset === 'last7') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setDateMode('range');
      setDateFrom(toDateInputValue(d));
      setDateTo(toDateInputValue(now));
      setSelectedMonthId('');
    } else if (preset === 'last30') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setDateMode('range');
      setDateFrom(toDateInputValue(d));
      setDateTo(toDateInputValue(now));
      setSelectedMonthId('');
    }
  };

  // التنقل بين الأيام في وضع اليوم المحدد
  const handleStepDay = (step: number) => {
    const cur = new Date(`${singleDate}T00:00:00`);
    cur.setDate(cur.getDate() + step);
    setSingleDate(toDateInputValue(cur));
  };

  // تصدير السجل اليومي إلى ملف Excel
  const handleExportExcel = () => {
    if (dailyRows.length === 0) return;

    const rows = dailyRows.map((r, idx) => {
      // إعداد ملخص العيادات كنص توضيحي
      const clinicBreakdownText = Object.values(r.clinicBreakdown)
        .map((c) => `${c.clinicName}: +${c.income.toLocaleString('ar-EG')} / -${c.expense.toLocaleString('ar-EG')}`)
        .join(' | ') || '—';

      return {
        'م': idx + 1,
        'اليوم': r.dayName,
        'التاريخ': r.dateStr,
        'التاريخ المنسق': r.formattedDate,
        'إجمالي الإيرادات (ج.م)': r.totalIncome,
        'إجمالي المصروفات (ج.م)': r.totalExpense,
        'صافي اليوم (ج.م)': r.netProfit,
        'عدد حركات الإيراد': r.incomeCount,
        'عدد حركات المصروف': r.expenseCount,
        'إجمالي الحركات': r.totalCount,
        'تفصيل مساهمة العيادات': clinicBreakdownText,
      };
    });

    // صف إجمالي للفترة
    rows.push({
      'م': '' as any,
      'اليوم': 'الإجمالي العام',
      'التاريخ': `${activeDateFrom} إلى ${activeDateTo}`,
      'التاريخ المنسق': `إجمالي الفترة (${periodTotals.daysCount} يوم)`,
      'إجمالي الإيرادات (ج.م)': periodTotals.income,
      'إجمالي المصروفات (ج.م)': periodTotals.expense,
      'صافي اليوم (ج.م)': periodTotals.net,
      'عدد حركات الإيراد': dailyRows.reduce((s, r) => s + r.incomeCount, 0),
      'عدد حركات المصروف': dailyRows.reduce((s, r) => s + r.expenseCount, 0),
      'إجمالي الحركات': periodTotals.totalCount,
      'تفصيل مساهمة العيادات': 'إجمالي صافي المركز لكامل الفترة',
    });

    const filename = `السجل_اليومي_${activeDateFrom}_إلى_${activeDateTo}`;
    exportRowsToExcel(rows, 'السجل المالي اليومي', filename);
  };

  return (
    <div className="space-y-6">
      {/* الرأس وشريط الإجراءات */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-gray-200 p-5 rounded-2xl shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 shadow-2xs">
            <CalendarDays className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-gray-800">السجل اليومي للإيرادات والمصروفات</h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                الشهر المالي (21 - 20)
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              جدول يومي منظم بحيث يمثل كل صف يوماً مستقلاً مع الإيرادات والمصروفات وصافي كل عيادة
            </p>
          </div>
        </div>

        {/* أزرار الإجراءات السريعة */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 font-bold px-3 py-2 rounded-xl hover:bg-gray-50 text-xs shadow-2xs cursor-pointer transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={dailyRows.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
            title="تصدير السجل اليومي إلى ملف Excel منسق"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير Excel ({dailyRows.length} يوم)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            disabled={dailyRows.length === 0}
            className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
            title="معاينة وطباعة السجل اليومي بصيغة A4"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة / PDF</span>
          </button>
        </div>
      </div>

      {/* بطاقة التحكم في التاريخ والفلاتر المالية */}
      <Card className="border border-gray-200 shadow-xs bg-gradient-to-b from-gray-50/50 to-white">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* اختيار وضع التاريخ: نطاق (من 21 إلى 20) أو يوم محدد */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600">طريقة العرض:</span>
              <div className="flex bg-gray-200/80 p-0.5 rounded-xl border border-gray-300">
                <button
                  type="button"
                  onClick={() => setDateMode('range')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    dateMode === 'range'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  نطاق تاريخ (من 21 حتى 20)
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode('single')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    dateMode === 'single'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  تحديد تاريخ يوم مفرد
                </button>
              </div>
            </div>

            {/* أزرار الفترات السريعة */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-gray-500 ml-1">فترات سريعة:</span>
              <button
                type="button"
                onClick={() => handleQuickPreset('current_fin')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  dateMode === 'range' && selectedMonthId === `${getFinancialMonthBounds().startStr}_${getFinancialMonthBounds().endStr}`
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                الشهر المالي الحالي (21 - 20)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('prev_fin')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer"
              >
                الشهر السابق (21 - 20)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('today')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  dateMode === 'single' && singleDate === getTodayDateStr()
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('last7')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer"
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('last30')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer"
              >
                آخر 30 يوماً
              </button>
            </div>
          </div>

          {/* محددات التواريخ بناءً على الوضع */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {dateMode === 'range' ? (
              <>
                {/* قائمة الأشهر المالية (21 إلى 20) */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    الشهر المالي (من 21 إلى 20)
                  </label>
                  <select
                    value={selectedMonthId}
                    onChange={(e) => handleSelectFinancialMonth(e.target.value)}
                    className="w-full border border-emerald-300 bg-white text-emerald-950 font-bold rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 shadow-2xs outline-none"
                  >
                    <option value="">-- تخصيص نطاق حر بالأسفل --</option>
                    {financialMonths.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayTitle}
                      </option>
                    ))}
                  </select>
                </div>

                {/* تاريخ البداية */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-gray-700 mb-1">من تاريخ (البداية)</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setSelectedMonthId('');
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs bg-white font-semibold focus:ring-2 focus:ring-emerald-500 shadow-2xs outline-none"
                  />
                </div>

                {/* تاريخ النهاية */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-gray-700 mb-1">إلى تاريخ (النهاية)</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setSelectedMonthId('');
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs bg-white font-semibold focus:ring-2 focus:ring-emerald-500 shadow-2xs outline-none"
                  />
                </div>
              </>
            ) : (
              /* وضع اليوم المحدد */
              <div className="md:col-span-12 flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-4 h-4 text-emerald-600" /> اختر اليوم المراد فحصه:
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleStepDay(-1)}
                    className="p-2 border border-gray-200 hover:bg-gray-100 rounded-xl text-gray-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="اليوم السابق"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>السابق</span>
                  </button>
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="border border-emerald-300 rounded-xl px-3 py-2 text-xs bg-white font-black text-emerald-900 focus:ring-2 focus:ring-emerald-500 shadow-2xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepDay(1)}
                    className="p-2 border border-gray-200 hover:bg-gray-100 rounded-xl text-gray-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="اليوم التالي"
                  >
                    <span>التالي</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs text-gray-500 mr-auto font-medium">
                  {new Date(`${singleDate}T00:00:00`).toLocaleDateString('ar-EG', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            )}
          </div>

          {/* فلاتر النوع (إيراد/مصروف) والعيادات والبحث */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 pt-3 border-t border-gray-200/80 items-center">
            {/* فلتر نوع الحركة (إيرادات / مصروفات / الكل) */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                فلتر نوع الحركة (إيرادات / مصروفات)
              </label>
              <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-300">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                    typeFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('income')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                    typeFilter === 'income'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  إيرادات فقط
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('expense')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                    typeFilter === 'expense'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  مصروفات فقط
                </button>
              </div>
            </div>

            {/* فلتر العيادة */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-700 mb-1">العيادة</label>
              <select
                value={clinicFilter}
                onChange={(e) => setClinicFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-xs bg-white font-semibold focus:ring-2 focus:ring-emerald-500 shadow-2xs outline-none"
              >
                <option value="all">كل العيادات (المركز بالكامل)</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__unassigned__">المصروفات العامة والمركز (بدون عيادة)</option>
              </select>
            </div>

            {/* البحث السريع */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-700 mb-1">بحث في تفاصيل الحركات</label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالبيان، الطبيب..."
                  className="w-full border border-gray-300 rounded-xl pr-8 pl-3 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* خيارات العرض والترتيب */}
            <div className="md:col-span-2 flex flex-col justify-end gap-1.5">
              <label className="text-xs font-bold text-gray-700">ترتيب الأيام</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="flex-1 flex items-center justify-center gap-1 border border-gray-300 bg-white hover:bg-gray-50 py-1.5 px-2 rounded-xl text-xs font-bold text-gray-700 cursor-pointer shadow-2xs"
                  title="تغيير اتجاه ترتيب الأيام"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{sortOrder === 'desc' ? 'الأحدث أولاً' : 'الأقدم أولاً'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* شريط الإحصائيات السريعة والتحكم في إظهار الأيام */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showZeroDays}
                  onChange={(e) => setShowZeroDays(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-gray-700">عرض جميع أيام الشهر (بما فيها الأيام بدون حركات)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAllExpanded(true)}
                className="text-emerald-700 hover:underline font-bold text-[11px]"
              >
                توسيع تفاصيل كل الأيام
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => toggleAllExpanded(false)}
                className="text-gray-500 hover:underline font-semibold text-[11px]"
              >
                طي التفاصيل
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* كروت الإحصائيات الإجمالية للفترة (21 - 20) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* إجمالي الإيرادات */}
        <Card className="border-t-4 border-t-emerald-500 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">إجمالي إيرادات الفترة</span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-700">
              {periodTotals.income.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              متوسط يومي: {periodTotals.avgDailyIncome.toLocaleString('ar-EG')} ج.م
            </p>
          </CardContent>
        </Card>

        {/* إجمالي المصروفات */}
        <Card className="border-t-4 border-t-rose-500 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">إجمالي مصروفات الفترة</span>
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-rose-700">
              {periodTotals.expense.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              تشمل الرواتب والمستهلكات والمصروفات العامة
            </p>
          </CardContent>
        </Card>

        {/* صافي الفترة */}
        <Card className={`border-t-4 shadow-xs ${periodTotals.net >= 0 ? 'border-t-blue-500' : 'border-t-amber-500'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">صافي الأرباح (الفائض)</span>
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className={`text-2xl font-black ${periodTotals.net >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
              {periodTotals.net.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              {periodTotals.income > 0
                ? `هامش الربح: ${Math.round((periodTotals.net / periodTotals.income) * 100)}%`
                : 'لا توجد إيرادات مسجلة'}
            </p>
          </CardContent>
        </Card>

        {/* عدد الأيام والحركات */}
        <Card className="border-t-4 border-t-purple-500 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">أيام وحركات الفترة</span>
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-purple-700">
              {periodTotals.activeDaysCount} <span className="text-xs font-normal text-gray-500">من {periodTotals.daysCount} يوم</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              إجمالي {periodTotals.totalCount} حركة مالية مسجلة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* جدول السجل اليومي - كل صف يمثل يوماً */}
      <Card className="border border-gray-200/90 shadow-xs overflow-hidden">
        <CardHeader className="bg-gray-50/80 border-b border-gray-200 p-4 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-black text-gray-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>جدول السجل المالي اليومي (كل صف = يوم واحد)</span>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              الفترة من {activeDateFrom} إلى {activeDateTo} ({dailyRows.length} صف يومي)
            </CardDescription>
          </div>
          <div className="text-xs font-bold text-gray-500">
            {typeFilter === 'income' ? 'عرض الإيرادات فقط' : typeFilter === 'expense' ? 'عرض المصروفات فقط' : 'عرض الإيرادات والمصروفات معاً'}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-bold text-gray-500">جاري تجميع وحساب السجل اليومي للعيادات...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-rose-600 font-bold text-xs space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
              <p>{error}</p>
              <button
                type="button"
                onClick={fetchData}
                className="mt-2 px-3 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : dailyRows.length === 0 ? (
            <div className="p-16 text-center text-gray-500 font-bold text-xs space-y-2">
              <CalendarDays className="w-8 h-8 mx-auto text-gray-400" />
              <p>لا توجد بيانات مطابقة للفترة والخيارات المحددة.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 border-b border-gray-200">
                    <th className="p-3.5 font-black text-gray-800">اليوم والتاريخ</th>
                    <th className="p-3.5 font-black text-emerald-800 text-left">إجمالي الإيرادات</th>
                    <th className="p-3.5 font-black text-rose-800 text-left">إجمالي المصروفات</th>
                    <th className="p-3.5 font-black text-blue-900 text-left">الصافي اليومي</th>
                    <th className="p-3.5 font-black text-gray-800">تفصيل مساهمة العيادات</th>
                    <th className="p-3.5 font-black text-center text-gray-800">الحركات</th>
                    <th className="p-3.5 font-black text-center text-gray-800">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dailyRows.map((row) => {
                    const isExpanded = !!expandedDates[row.dateStr];
                    const hasTransactions = row.totalCount > 0;
                    const clinicsList = Object.values(row.clinicBreakdown);

                    return (
                      <React.Fragment key={row.dateStr}>
                        <tr
                          className={`transition-colors ${
                            row.isToday
                              ? 'bg-emerald-50/50 hover:bg-emerald-50/80 font-semibold'
                              : row.isFriday
                              ? 'bg-gray-50/70 hover:bg-gray-100/70'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* اليوم والتاريخ */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center font-mono font-black text-xs shrink-0 ${
                                  row.isToday
                                    ? 'bg-emerald-600 text-white'
                                    : row.totalCount > 0
                                    ? 'bg-gray-800 text-white'
                                    : 'bg-gray-100 text-gray-400'
                                }`}
                              >
                                <span>{row.dayNumber}</span>
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-black text-gray-800">{row.dayName}</span>
                                  {row.isToday && (
                                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">
                                      اليوم
                                    </span>
                                  )}
                                  {row.isFriday && (
                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-semibold">
                                      جمعة
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-gray-400 font-mono block">
                                  {row.formattedDate}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* إجمالي الإيرادات */}
                          <td className="p-3.5 text-left font-mono font-black text-emerald-700 text-sm">
                            {row.totalIncome > 0 ? (
                              <span>
                                +{row.totalIncome.toLocaleString('ar-EG')} <span className="text-[10px] font-normal">ج.م</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 font-normal">0</span>
                            )}
                            {row.incomeCount > 0 && (
                              <span className="block text-[10px] text-emerald-600/80 font-sans font-medium">
                                ({row.incomeCount} إيصال)
                              </span>
                            )}
                          </td>

                          {/* إجمالي المصروفات */}
                          <td className="p-3.5 text-left font-mono font-black text-rose-700 text-sm">
                            {row.totalExpense > 0 ? (
                              <span>
                                -{row.totalExpense.toLocaleString('ar-EG')} <span className="text-[10px] font-normal">ج.م</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 font-normal">0</span>
                            )}
                            {row.expenseCount > 0 && (
                              <span className="block text-[10px] text-rose-600/80 font-sans font-medium">
                                ({row.expenseCount} قيد)
                              </span>
                            )}
                          </td>

                          {/* الصافي اليومي */}
                          <td className="p-3.5 text-left font-mono">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg font-black text-xs ${
                                row.netProfit > 0
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : row.netProfit < 0
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {row.netProfit > 0 ? '+' : ''}
                              {row.netProfit.toLocaleString('ar-EG')} ج.م
                            </span>
                          </td>

                          {/* تفصيل مساهمة العيادات */}
                          <td className="p-3.5">
                            {clinicsList.length === 0 ? (
                              <span className="text-gray-400 text-[11px]">لا توجد حركات في هذا اليوم</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 max-w-md">
                                {clinicsList.map((c) => {
                                  const net = c.income - c.expense;
                                  return (
                                    <span
                                      key={c.clinicName}
                                      className="inline-flex items-center gap-1 text-[11px] bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-2xs"
                                    >
                                      <Building2 className="w-3 h-3 text-gray-400" />
                                      <span className="font-bold text-gray-700">{c.clinicName}:</span>
                                      {c.income > 0 && (
                                        <span className="text-emerald-700 font-mono font-bold" dir="ltr">
                                          +{c.income.toLocaleString('ar-EG')}
                                        </span>
                                      )}
                                      {c.expense > 0 && (
                                        <span className="text-rose-700 font-mono font-bold" dir="ltr">
                                          -{c.expense.toLocaleString('ar-EG')}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* عدد الحركات */}
                          <td className="p-3.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                hasTransactions
                                  ? 'bg-gray-100 text-gray-800 font-mono'
                                  : 'text-gray-300'
                              }`}
                            >
                              {row.totalCount}
                            </span>
                          </td>

                          {/* زر التوسيع والمعاينة */}
                          <td className="p-3.5 text-center">
                            {hasTransactions ? (
                              <button
                                type="button"
                                onClick={() => toggleDateExpanded(row.dateStr)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                <span>{isExpanded ? 'طي' : 'عرض الحركات'}</span>
                              </button>
                            ) : (
                              <span className="text-gray-300 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>

                        {/* الصف الموسع لتفاصيل حركات اليوم */}
                        {isExpanded && hasTransactions && (
                          <tr className="bg-emerald-50/20 border-b border-emerald-100">
                            <td colSpan={7} className="p-4">
                              <div className="bg-white border border-emerald-200 rounded-xl p-3 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-emerald-600" />
                                    <span className="font-bold text-gray-800 text-xs">
                                      سجل الحركات التفصيلي ليوم {row.dayName} ({row.formattedDate})
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-gray-500 font-mono">
                                    {row.transactions.length} حركة مسجلة
                                  </span>
                                </div>

                                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                  <table className="w-full text-right text-[11px] border-collapse">
                                    <thead>
                                      <tr className="bg-gray-50 text-gray-600 border-b">
                                        <th className="p-2">الوقت</th>
                                        <th className="p-2">النوع</th>
                                        <th className="p-2">العيادة</th>
                                        <th className="p-2">البيان والتصنيف</th>
                                        <th className="p-2 text-left">المبلغ</th>
                                        <th className="p-2">بواسطة</th>
                                        <th className="p-2">المستفيد</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 font-sans">
                                      {row.transactions.map((tx: any) => {
                                        const timeStr = tx.created_at
                                          ? new Date(tx.created_at).toLocaleTimeString('ar-EG', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })
                                          : '—';
                                        const isIncome = tx.type === 'income';

                                        return (
                                          <tr key={tx.id} className="hover:bg-gray-50">
                                            <td className="p-2 font-mono text-gray-500" dir="ltr">
                                              {timeStr}
                                            </td>
                                            <td className="p-2">
                                              <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                  isIncome
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-rose-100 text-rose-800'
                                                }`}
                                              >
                                                {isIncome ? 'إيراد' : 'مصروف'}
                                              </span>
                                            </td>
                                            <td className="p-2 font-semibold text-gray-800">
                                              {tx.clinics?.name || 'المركز العام'}
                                            </td>
                                            <td className="p-2 text-gray-700">
                                              <span>{tx.description || '—'}</span>
                                              {tx.category && (
                                                <span className="text-[10px] text-gray-400 mr-1.5">
                                                  ({tx.category})
                                                </span>
                                              )}
                                            </td>
                                            <td className="p-2 text-left font-mono font-bold">
                                              <span className={isIncome ? 'text-emerald-700' : 'text-rose-700'}>
                                                {isIncome ? '+' : '-'}
                                                {Number(tx.amount || 0).toLocaleString('ar-EG')} ج.م
                                              </span>
                                            </td>
                                            <td className="p-2 text-gray-500">
                                              {tx.profiles
                                                ? `${tx.profiles.first_name || ''} ${tx.profiles.last_name || ''}`.trim()
                                                : 'النظام'}
                                            </td>
                                            <td className="p-2 text-gray-500">
                                              {tx.beneficiary
                                                ? `${tx.beneficiary.first_name || ''} ${tx.beneficiary.last_name || ''}`.trim()
                                                : '—'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>

                {/* صف الإجمالي النهائي لكامل الفترة المحددة */}
                <tfoot>
                  <tr className="bg-gray-900 text-white font-bold border-t-2 border-gray-700">
                    <td className="p-4 text-sm font-black">
                      إجمالي الفترة ({periodTotals.daysCount} يوم)
                    </td>
                    <td className="p-4 text-left font-mono text-emerald-400 text-base font-black">
                      +{periodTotals.income.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
                    </td>
                    <td className="p-4 text-left font-mono text-rose-400 text-base font-black">
                      -{periodTotals.expense.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
                    </td>
                    <td className="p-4 text-left font-mono text-base font-black">
                      <span className={periodTotals.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                        {periodTotals.net >= 0 ? '+' : ''}
                        {periodTotals.net.toLocaleString('ar-EG')} ج.م
                      </span>
                    </td>
                    <td className="p-4 text-xs text-gray-300">
                      صافي نشاط المركز لكل العيادات
                    </td>
                    <td className="p-4 text-center font-mono text-gray-200">
                      {periodTotals.totalCount}
                    </td>
                    <td className="p-4 text-center text-xs text-gray-400">
                      —
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* مودال الطباعة الرسمي A4 للسجل اليومي */}
      {isPrintModalOpen && (
        <PrintableReportModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="السجل المالي اليومي للإيرادات والمصروفات"
          subtitle={`الفترة المعتمدة: من ${activeDateFrom} إلى ${activeDateTo}`}
          dateRange={{ from: activeDateFrom, to: activeDateTo }}
          summaryCards={[
            { label: 'إجمالي الإيرادات', value: `${periodTotals.income.toLocaleString('ar-EG')} ج.م` },
            { label: 'إجمالي المصروفات', value: `${periodTotals.expense.toLocaleString('ar-EG')} ج.م` },
            { label: 'صافي الأرباح', value: `${periodTotals.net.toLocaleString('ar-EG')} ج.م` },
            { label: 'إجمالي الأيام', value: `${periodTotals.daysCount} يوم` },
          ]}
          sections={[
            {
              title: 'جدول حركة الأيام التفصيلي',
              columns: [
                { header: 'اليوم والتاريخ', render: (r) => `${r.dayName} (${r.dateStr})` },
                {
                  header: 'الإيرادات',
                  align: 'left',
                  render: (r) => `${r.totalIncome.toLocaleString('ar-EG')} ج.م`,
                },
                {
                  header: 'المصروفات',
                  align: 'left',
                  render: (r) => `${r.totalExpense.toLocaleString('ar-EG')} ج.م`,
                },
                {
                  header: 'الصافي',
                  align: 'left',
                  render: (r) => `${r.netProfit.toLocaleString('ar-EG')} ج.م`,
                },
                { header: 'الحركات', align: 'center', render: (r) => r.totalCount },
                {
                  header: 'مساهمة العيادات',
                  render: (r) =>
                    Object.values(r.clinicBreakdown)
                      .map((c: any) => `${c.clinicName} (+${c.income}/-${c.expense})`)
                      .join(' - ') || '—',
                },
              ],
              data: dailyRows,
              totals: {
                'اليوم والتاريخ': 'الإجمالي العام',
                'الإيرادات': `${periodTotals.income.toLocaleString('ar-EG')} ج.م`,
                'المصروفات': `${periodTotals.expense.toLocaleString('ar-EG')} ج.م`,
                'الصافي': `${periodTotals.net.toLocaleString('ar-EG')} ج.م`,
                'الحركات': periodTotals.totalCount,
              },
            },
          ]}
        />
      )}
    </div>
  );
}
