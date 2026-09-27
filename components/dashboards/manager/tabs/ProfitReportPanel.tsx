'use client';

// ============================================================================
// components/dashboards/manager/tabs/ProfitReportPanel.tsx
// تقرير أرباح مفصّل للمركز والعيادات والأطباء — مع إمكانية النقر على أي
// إجمالي (إيرادات، مصروفات، أرباح، عيادات، أطباء) لعرض الحركات التفصيلية،
// ودعم تصدير إكسيل متعدد الأوراق (.xlsx) وطباعة / حفظ PDF رسمي باللغة العربية.
// ============================================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Printer,
  Building2,
  User,
  Download,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Percent,
  Layers,
  ChevronLeft,
  Info,
  DollarSign,
  PieChart,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { getFinancialMonthBounds, getPreviousFinancialMonthBounds, toDateInputValue } from '@/lib/financialMonth';
import { exportMultiSheetExcel, ExcelSheetConfig } from '@/lib/export-excel';
import { PrintableReportModal } from '@/components/ui/printable-report-modal';
import { FinancialDrilldownModal } from './FinancialDrilldownModal';

const FETCH_CAP = 5000;
const UNASSIGNED_KEY = '__unassigned__';

const EXPENSE_GROUPS: Record<string, string> = {
  rent_utilities: 'المصروفات العامة والإيجار',
  consumables: 'المستهلكات والمستلزمات',
  wages: 'الأجور والرواتب الإدارية',
  equipment_maintenance: 'الأجهزة والصيانة والانتقالات',
  misc: 'نثريات ومصروفات أخرى',
};

export function ProfitReportPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // الافتراضي: الشهر المالي الحالي (من 21 في الشهر إلى 20 في الشهر التالي)
  const [dateFrom, setDateFrom] = useState(() => getFinancialMonthBounds().startStr);
  const [dateTo, setDateTo] = useState(() => getFinancialMonthBounds().endStr);

  // حالة المودالات
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [drilldown, setDrilldown] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    type: 'income' | 'expense' | 'clinic' | 'doctor' | 'all';
    transactions: any[];
    extraMeta?: { clinicName?: string; doctorName?: string };
  }>({
    isOpen: false,
    title: '',
    type: 'income',
    transactions: [],
  });

  const setQuickPreset = (preset: 'currentFin' | 'prevFin' | 'today' | 'week' | 'last30' | 'all') => {
    const now = new Date();
    if (preset === 'currentFin') {
      const fin = getFinancialMonthBounds(now);
      setDateFrom(fin.startStr);
      setDateTo(fin.endStr);
    } else if (preset === 'prevFin') {
      const prev = getPreviousFinancialMonthBounds(now);
      setDateFrom(prev.startStr);
      setDateTo(prev.endStr);
    } else if (preset === 'today') {
      const s = toDateInputValue(now);
      setDateFrom(s);
      setDateTo(s);
    } else if (preset === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diffToSaturday = (day + 1) % 7;
      d.setDate(d.getDate() - diffToSaturday);
      setDateFrom(toDateInputValue(d));
      setDateTo(toDateInputValue(now));
    } else if (preset === 'last30') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setDateFrom(toDateInputValue(d));
      setDateTo(toDateInputValue(now));
    } else if (preset === 'all') {
      setDateFrom('2024-01-01');
      setDateTo(toDateInputValue(now));
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('transactions')
      .select('*, clinics(name), profiles!transactions_user_id_fkey(first_name, last_name)')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل بيانات التقرير.'));
    else setRows(data || []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(fetchData, 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  // حسابات المركز العامة
  const center = useMemo(() => {
    const incomeRows = rows.filter((t) => t.type === 'income');
    const expenseRows = rows.filter((t) => t.type !== 'income');
    const income = incomeRows.reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = expenseRows.reduce((s, t) => s + Number(t.amount || 0), 0);
    const net = income - expense;
    const profitMargin = income > 0 ? Math.round((net / income) * 100) : 0;
    return { income, expense, net, profitMargin, incomeRows, expenseRows };
  }, [rows]);

  // تفصيل أرباح ومصروفات كل عيادة
  const clinicBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; income: number; expense: number; transactions: any[] }
    >();
    rows.forEach((t) => {
      const key = t.clinic_id || UNASSIGNED_KEY;
      const name = t.clinics?.name || 'مصروفات عامة (غير مخصصة لعيادة)';
      if (!map.has(key)) map.set(key, { name, income: 0, expense: 0, transactions: [] });
      const row = map.get(key)!;
      row.transactions.push(t);
      if (t.type === 'income') row.income += Number(t.amount || 0);
      else row.expense += Number(t.amount || 0);
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({
        key,
        ...v,
        net: v.income - v.expense,
        margin: v.income > 0 ? Math.round(((v.income - v.expense) / v.income) * 100) : 0,
      }))
      .sort((a, b) =>
        a.key === UNASSIGNED_KEY ? 1 : b.key === UNASSIGNED_KEY ? -1 : b.net - a.net
      );
  }, [rows]);

  // تصنيف المصروفات (مجموعات)
  const expenseCategoriesBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; amount: number; count: number; transactions: any[] }>();

    // 1) رواتب ومستحقات الأطباء (type === 'salary')
    const doctorSalaries = rows.filter((t) => t.type === 'salary');
    if (doctorSalaries.length > 0) {
      map.set('doctor_salaries', {
        label: 'مستحقات وأجور الأطباء',
        amount: doctorSalaries.reduce((s, t) => s + Number(t.amount || 0), 0),
        count: doctorSalaries.length,
        transactions: doctorSalaries,
      });
    }

    // 2) بقية المصروفات
    rows
      .filter((t) => t.type !== 'income' && t.type !== 'salary')
      .forEach((t) => {
        const catKey = t.category || 'misc';
        const label = EXPENSE_GROUPS[catKey] || catKey || 'نثريات أخرى';
        if (!map.has(catKey)) {
          map.set(catKey, { label, amount: 0, count: 0, transactions: [] });
        }
        const grp = map.get(catKey)!;
        grp.amount += Number(t.amount || 0);
        grp.count += 1;
        grp.transactions.push(t);
      });

    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [rows]);

  // إجمالي المدفوع لكل طبيب
  const doctorBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; amount: number; count: number; transactions: any[] }
    >();
    rows
      .filter((t) => t.type === 'salary' && t.user_id)
      .forEach((t) => {
        const key = t.user_id;
        const name = t.profiles
          ? `د. ${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim()
          : 'طبيب غير معروف';
        if (!map.has(key)) map.set(key, { name, amount: 0, count: 0, transactions: [] });
        const row = map.get(key)!;
        row.amount += Number(t.amount || 0);
        row.count += 1;
        row.transactions.push(t);
      });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [rows]);

  // ==========================================
  // تصدير إكسيل متعدد الأوراق شامل
  // ==========================================
  const handleExportFullExcel = () => {
    if (rows.length === 0) {
      return;
    }

    const sheets: ExcelSheetConfig[] = [];

    // 1) ورقة ملخص المركز والعيادات
    const summaryRows = [
      { 'البيان': 'إجمالي الإيرادات للفترة', 'المبلغ (ج.م)': center.income, 'الملاحظات': `عدد الحركات: ${center.incomeRows.length}` },
      { 'البيان': 'إجمالي المصروفات للفترة', 'المبلغ (ج.م)': center.expense, 'الملاحظات': `عدد الحركات: ${center.expenseRows.length}` },
      { 'البيان': 'صافي ربح المركز ككل', 'المبلغ (ج.م)': center.net, 'الملاحظات': `نسبة هامش الربح: ${center.profitMargin}%` },
    ];
    sheets.push({
      sheetName: 'الملخص المالي العام',
      rows: summaryRows,
    });

    // 2) ورقة أداء العيادات
    const clinicsRows = clinicBreakdown.map((c, i) => ({
      'م': i + 1,
      'العيادة': c.name,
      'إجمالي الإيرادات (ج.م)': c.income,
      'إجمالي المصروفات (ج.م)': c.expense,
      'صافي الربح (ج.م)': c.net,
      'هامش الربح': `${c.margin}%`,
      'عدد الحركات': c.transactions.length,
    }));
    sheets.push({
      sheetName: 'أرباح العيادات',
      rows: clinicsRows,
    });

    // 3) ورقة مدفوعات الأطباء
    if (doctorBreakdown.length > 0) {
      const doctorsRows = doctorBreakdown.map((d, i) => ({
        'م': i + 1,
        'اسم الطبيب': d.name,
        'عدد الدفعات': d.count,
        'إجمالي المدفوع (ج.م)': d.amount,
      }));
      sheets.push({
        sheetName: 'مدفوعات الأطباء',
        rows: doctorsRows,
      });
    }

    // 4) ورقة تفاصيل كل الإيرادات
    if (center.incomeRows.length > 0) {
      const incomeRowsExport = center.incomeRows.map((t, idx) => ({
        'م': idx + 1,
        'التاريخ': new Date(t.created_at).toLocaleDateString('ar-EG'),
        'الوقت': new Date(t.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        'المبلغ (ج.م)': Number(t.amount || 0),
        'التصنيف': t.category || 'إيراد',
        'البيان': t.description || '—',
        'العيادة': t.clinics?.name || 'عام',
        'المستخدم': t.profiles ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim() : 'النظام',
      }));
      sheets.push({
        sheetName: 'كشف الإيرادات',
        rows: incomeRowsExport,
      });
    }

    // 5) ورقة تفاصيل كل المصروفات
    if (center.expenseRows.length > 0) {
      const expenseRowsExport = center.expenseRows.map((t, idx) => ({
        'م': idx + 1,
        'التاريخ': new Date(t.created_at).toLocaleDateString('ar-EG'),
        'الوقت': new Date(t.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        'النوع': t.type === 'salary' ? 'راتب/مستحق' : 'مصروف',
        'المبلغ (ج.م)': Number(t.amount || 0),
        'التصنيف': EXPENSE_GROUPS[t.category] || t.category || 'عام',
        'البيان': t.description || '—',
        'العيادة': t.clinics?.name || 'عام',
        'المستخدم': t.profiles ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim() : 'النظام',
      }));
      sheets.push({
        sheetName: 'كشف المصروفات',
        rows: expenseRowsExport,
      });
    }

    exportMultiSheetExcel(sheets, `تقرير_الأرباح_الشامل_${dateFrom}_${dateTo}`);
  };

  return (
    <div className="space-y-6">
      {/* شريط الفلاتر والتحكم السريع */}
      <Card className="print:hidden border border-gray-200/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-gray-500 ml-2">فترات سريعة:</span>
              <button
                onClick={() => setQuickPreset('today')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 transition-colors cursor-pointer"
              >
                اليوم
              </button>
              <button
                onClick={() => setQuickPreset('week')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 transition-colors cursor-pointer"
              >
                هذا الأسبوع
              </button>
              <button
                onClick={() => setQuickPreset('currentFin')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors cursor-pointer"
                title="الشهر المالي الحالي (من 21 إلى 20)"
              >
                الشهر المالي الحالي (21 - 20)
              </button>
              <button
                onClick={() => setQuickPreset('prevFin')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 transition-colors cursor-pointer"
                title="الشهر المالي السابق من 21 إلى 20"
              >
                الشهر المالي السابق
              </button>
              <button
                onClick={() => setQuickPreset('last30')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 transition-colors cursor-pointer"
              >
                آخر 30 يوم
              </button>
              <button
                onClick={() => setQuickPreset('all')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 transition-colors cursor-pointer"
              >
                كل الأوقات
              </button>
            </div>

            {/* أزرار التصدير والطباعة الشاملة */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportFullExcel}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
                title="تصدير ملف إكسيل كامل يحتوي على كافة الأوراق والبيانات"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تحميل إكسيل شامل (.xlsx)</span>
              </button>
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
                title="معاينة التقرير والطباعة أو الحفظ كملف PDF"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة / PDF</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-bold">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>من:</span>
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-xl p-2 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-gray-400 text-xs">إلى:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-xl p-2 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-400 mr-2">
              (يتم تحديث جميع الأرقام والرسوم تلقائياً وفق النطاق الزمني المحدد)
            </span>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorState message={error} onRetry={fetchData} />}

      {loading ? (
        <div className="bg-white border rounded-2xl p-12 text-center text-gray-500 space-y-2">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="font-bold text-sm text-gray-700">جاري تدقيق وحساب التقارير المالية...</p>
          <p className="text-xs text-gray-400">نطاق الفترة: من {dateFrom} إلى {dateTo}</p>
        </div>
      ) : (
        <>
          {/* كروت الإجماليات الثلاثة التفاعلية */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* كارت الإيرادات — تفاعلي */}
            <div
              onClick={() =>
                setDrilldown({
                  isOpen: true,
                  title: 'تفاصيل كشف الإيرادات',
                  subtitle: `إجمالي المقبوضات والتحصيلات: ${center.income.toLocaleString('ar-EG')} ج.م`,
                  type: 'income',
                  transactions: center.incomeRows,
                })
              }
              className="group cursor-pointer bg-white border border-emerald-100 hover:border-emerald-300 hover:shadow-md rounded-2xl p-5 transition-all duration-200 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-emerald-500"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-600">إجمالي الإيرادات (كل العيادات)</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  انقر للتفاصيل ←
                </span>
              </div>
              <p className="text-2xl md:text-3xl font-black text-emerald-600 tracking-tight" dir="ltr">
                +{center.income.toLocaleString('ar-EG')} <span className="text-sm font-normal text-emerald-700">ج.م</span>
              </p>
              <p className="text-xs text-gray-400 mt-2 flex items-center justify-between">
                <span>{center.incomeRows.length} حركة تحصيل مسجلة</span>
                <span className="text-emerald-600 font-bold group-hover:underline">عرض الحركات</span>
              </p>
            </div>

            {/* كارت المصروفات — تفاعلي */}
            <div
              onClick={() =>
                setDrilldown({
                  isOpen: true,
                  title: 'تفاصيل كشف المصروفات والأجور',
                  subtitle: `إجمالي النفقات والرواتب: ${center.expense.toLocaleString('ar-EG')} ج.م`,
                  type: 'expense',
                  transactions: center.expenseRows,
                })
              }
              className="group cursor-pointer bg-white border border-red-100 hover:border-red-300 hover:shadow-md rounded-2xl p-5 transition-all duration-200 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-red-500"></div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-50 text-red-700 flex items-center justify-center font-bold">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-600">إجمالي المصروفات والأجور</span>
                </div>
                <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full group-hover:bg-red-600 group-hover:text-white transition-colors">
                  انقر للتفاصيل ←
                </span>
              </div>
              <p className="text-2xl md:text-3xl font-black text-red-600 tracking-tight" dir="ltr">
                -{center.expense.toLocaleString('ar-EG')} <span className="text-sm font-normal text-red-700">ج.م</span>
              </p>
              <p className="text-xs text-gray-400 mt-2 flex items-center justify-between">
                <span>{center.expenseRows.length} حركة صرف مسجلة</span>
                <span className="text-red-600 font-bold group-hover:underline">عرض الحركات</span>
              </p>
            </div>

            {/* كارت صافي الربح — تفاعلي */}
            <div
              onClick={() =>
                setDrilldown({
                  isOpen: true,
                  title: 'كافة الحركات المالية للمركز',
                  subtitle: `صافي الربح: ${center.net.toLocaleString('ar-EG')} ج.م (هامش ربح ${center.profitMargin}%)`,
                  type: 'all',
                  transactions: rows,
                })
              }
              className={`group cursor-pointer bg-white border hover:shadow-md rounded-2xl p-5 transition-all duration-200 relative overflow-hidden ${
                center.net >= 0 ? 'border-blue-100 hover:border-blue-300' : 'border-orange-100 hover:border-orange-300'
              }`}
            >
              <div
                className={`absolute top-0 right-0 left-0 h-1.5 ${
                  center.net >= 0 ? 'bg-blue-600' : 'bg-orange-500'
                }`}
              ></div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                      center.net >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                    }`}
                  >
                    <Percent className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-600">صافي ربح المركز ككل</span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    center.net >= 0
                      ? 'bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white'
                      : 'bg-orange-50 text-orange-700 group-hover:bg-orange-600 group-hover:text-white'
                  } transition-colors`}
                >
                  هامش الربح {center.profitMargin}%
                </span>
              </div>
              <p
                className={`text-2xl md:text-3xl font-black tracking-tight ${
                  center.net >= 0 ? 'text-blue-600' : 'text-orange-600'
                }`}
                dir="ltr"
              >
                {center.net >= 0 ? '+' : ''}
                {center.net.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span>
              </p>
              <p className="text-xs text-gray-400 mt-2 flex items-center justify-between">
                <span>إجمالي الحركات: {rows.length} حركة</span>
                <span className="font-bold text-blue-600 group-hover:underline">عرض كل العمليات</span>
              </p>
            </div>
          </div>

          {/* تبويب سريع لتصنيف المصروفات */}
          {expenseCategoriesBreakdown.length > 0 && (
            <Card className="border border-gray-200/80 shadow-2xs">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-emerald-600" />
                    <span>توزيع بنود المصروفات (انقر على أي بند لمعاينة تفاصيل حركاته)</span>
                  </h3>
                  <span className="text-xs text-gray-400">إجمالي {expenseCategoriesBreakdown.length} بنود</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {expenseCategoriesBreakdown.map((cat) => (
                    <div
                      key={cat.key}
                      onClick={() =>
                        setDrilldown({
                          isOpen: true,
                          title: `تفاصيل مصروفات: ${cat.label}`,
                          subtitle: `إجمالي المبلغ: ${cat.amount.toLocaleString('ar-EG')} ج.م (${cat.count} حركة)`,
                          type: 'expense',
                          transactions: cat.transactions,
                        })
                      }
                      className="cursor-pointer bg-gray-50/70 hover:bg-emerald-50/50 border border-gray-200/70 hover:border-emerald-300 rounded-xl p-3.5 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-gray-700 group-hover:text-emerald-800">
                          {cat.label}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {cat.count} حركات
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-lg font-black text-red-600" dir="ltr">
                          -{cat.amount.toLocaleString('ar-EG')} <span className="text-[10px] font-normal">ج.م</span>
                        </span>
                        <span className="text-[11px] text-emerald-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          عرض الحركات ←
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* جدول ربح كل عيادة على حدة */}
          <Card className="border border-gray-200/80 shadow-2xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                    <span>ربح كل عيادة على حدة للفترة المحددة</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    انقر على أي عيادة أو على زر &quot;عرض التفاصيل&quot; لمعاينة كشف الحركات الكامل الخاص بها
                  </p>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-bold">
                  {clinicBreakdown.length} سجلات
                </span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100/80 text-gray-700 border-b border-gray-200">
                      <th className="p-3 font-bold">العيادة</th>
                      <th className="p-3 font-bold">الإيرادات</th>
                      <th className="p-3 font-bold">المصروفات</th>
                      <th className="p-3 font-bold">صافي الربح</th>
                      <th className="p-3 font-bold">هامش الربح</th>
                      <th className="p-3 font-bold w-24 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clinicBreakdown.map((c) => (
                      <tr
                        key={c.key}
                        onClick={() =>
                          setDrilldown({
                            isOpen: true,
                            title: `كشف حركات عيادة: ${c.name}`,
                            subtitle: `صافي الربح: ${c.net.toLocaleString('ar-EG')} ج.م (${c.transactions.length} حركة)`,
                            type: 'clinic',
                            transactions: c.transactions,
                            extraMeta: { clinicName: c.name },
                          })
                        }
                        className={`hover:bg-emerald-50/40 cursor-pointer transition-colors ${
                          c.key === UNASSIGNED_KEY ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="p-3 font-bold text-gray-800">
                          <div className="flex items-center gap-2">
                            <span>{c.name}</span>
                            {c.key === UNASSIGNED_KEY && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-normal">
                                مصروفات مشتركة
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-emerald-600 font-bold whitespace-nowrap" dir="ltr">
                          +{c.income.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 text-red-600 font-bold whitespace-nowrap" dir="ltr">
                          -{c.expense.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`font-black text-sm ${
                              c.net >= 0 ? 'text-blue-600' : 'text-orange-600'
                            }`}
                            dir="ltr"
                          >
                            {c.net >= 0 ? '+' : ''}
                            {c.net.toLocaleString('ar-EG')} ج.م
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              c.margin > 40
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.margin >= 0
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {c.margin}%
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            className="text-emerald-700 hover:text-emerald-800 font-bold text-[11px] hover:underline"
                          >
                            التفاصيل ←
                          </button>
                        </td>
                      </tr>
                    ))}
                    {clinicBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400">
                          لا توجد حركات مالية مسجلة للعيادات ضمن النطاق المحدد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-start gap-2 text-xs text-gray-400 mt-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <p>
                  <strong>ملاحظة محاسبية:</strong> &quot;مصروفات عامة (غير مخصصة لعيادة)&quot; تشمل فواتير الإيجار، المرافق العامة، والرواتب المركزية التي تخص المركز كاملاً ولا تقتصر على عيادة واحدة.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* جدول إجمالي المدفوع لكل طبيب */}
          <Card className="border border-gray-200/80 shadow-2xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <User className="w-5 h-5 text-emerald-600" />
                    <span>إجمالي مستحقات وأجور الأطباء المسددة</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    انقر على أي طبيب لمعاينة سجل الدفعات وسندات الصرف الخاصة به
                  </p>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-bold">
                  {doctorBreakdown.length} أطباء
                </span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100/80 text-gray-700 border-b border-gray-200">
                      <th className="p-3 font-bold">اسم الطبيب</th>
                      <th className="p-3 font-bold">عدد الدفعات الصادرة</th>
                      <th className="p-3 font-bold">إجمالي المبلغ المسدد</th>
                      <th className="p-3 font-bold w-24 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {doctorBreakdown.map((d) => (
                      <tr
                        key={d.name}
                        onClick={() =>
                          setDrilldown({
                            isOpen: true,
                            title: `سجل مدفوعات: ${d.name}`,
                            subtitle: `إجمالي المسدد: ${d.amount.toLocaleString('ar-EG')} ج.م عبر ${d.count} دفعة`,
                            type: 'doctor',
                            transactions: d.transactions,
                            extraMeta: { doctorName: d.name },
                          })
                        }
                        className="hover:bg-purple-50/40 cursor-pointer transition-colors"
                      >
                        <td className="p-3 font-bold text-gray-800">{d.name}</td>
                        <td className="p-3 text-gray-600 font-mono">{d.count} دفعة</td>
                        <td className="p-3 font-black text-red-600 whitespace-nowrap" dir="ltr">
                          -{d.amount.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            className="text-purple-700 hover:text-purple-800 font-bold text-[11px] hover:underline"
                          >
                            الدفعات ←
                          </button>
                        </td>
                      </tr>
                    ))}
                    {doctorBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-400">
                          لا توجد سندات صرف أو تسديدات أطباء ضمن النطاق المحدد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* مودال استعراض الحركات التفصيلية (Drilldown) عند النقر على أي إجمالي أو عيادة أو طبيب */}
      <FinancialDrilldownModal
        isOpen={drilldown.isOpen}
        onClose={() => setDrilldown((prev) => ({ ...prev, isOpen: false }))}
        title={drilldown.title}
        subtitle={drilldown.subtitle}
        dateRange={{ from: dateFrom, to: dateTo }}
        type={drilldown.type}
        transactions={drilldown.transactions}
        extraMeta={drilldown.extraMeta}
      />

      {/* مودال الطباعة وتصدير PDF العام لتقرير الأرباح */}
      <PrintableReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="تقرير الأرباح والموقف المالي المفصل"
        subtitle="تقرير شامل يوضح إيرادات ومصروفات وصافي أرباح المركز والعيادات"
        dateRange={{ from: dateFrom, to: dateTo }}
        metaItems={[
          { label: 'إجمالي الحركات', value: `${rows.length} حركة` },
          { label: 'هامش الربح', value: `${center.profitMargin}%` },
        ]}
        summaryCards={[
          { label: 'إجمالي الإيرادات', value: `+${center.income.toLocaleString('ar-EG')} ج.م`, sub: `${center.incomeRows.length} حركة` },
          { label: 'إجمالي المصروفات', value: `-${center.expense.toLocaleString('ar-EG')} ج.م`, sub: `${center.expenseRows.length} حركة` },
          { label: 'صافي ربح المركز', value: `${center.net >= 0 ? '+' : ''}${center.net.toLocaleString('ar-EG')} ج.م`, sub: `نسبة ${center.profitMargin}%` },
        ]}
        sections={[
          {
            title: '1. أداء وأرباح العيادات',
            columns: [
              { header: 'العيادة', key: 'name' },
              { header: 'الإيرادات', render: (r) => `+${r.income.toLocaleString('ar-EG')} ج.م`, align: 'left' },
              { header: 'المصروفات', render: (r) => `-${r.expense.toLocaleString('ar-EG')} ج.م`, align: 'left' },
              { header: 'صافي الربح', render: (r) => `${r.net >= 0 ? '+' : ''}${r.net.toLocaleString('ar-EG')} ج.م`, align: 'left' },
              { header: 'هامش الربح', render: (r) => `${r.margin}%`, align: 'center' },
            ],
            data: clinicBreakdown,
          },
          ...(doctorBreakdown.length > 0
            ? [
                {
                  title: '2. مدفوعات ومستحقات الأطباء المسددة',
                  columns: [
                    { header: 'اسم الطبيب', key: 'name' },
                    { header: 'عدد الدفعات', key: 'count', align: 'center' as const },
                    { header: 'إجمالي المبلغ', render: (r: any) => `-${r.amount.toLocaleString('ar-EG')} ج.م`, align: 'left' as const },
                  ],
                  data: doctorBreakdown,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
