'use client';

// ============================================================================
// components/dashboards/accountant/AccountantReports.tsx
// التقارير التحليلية — بحث/فلترة + رسم بياني للإيرادات (recharts كان مثبّت
// وغير مستخدم) + فلتر نطاق زمني + تصدير PDF (طباعة) + تحديث Realtime
// تلقائي عند أي حركة مالية جديدة (كان التحديث يدوي فقط بالـ refresh).
// ============================================================================
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart as BarChartIcon,
  Search,
  Loader2,
  Printer,
  Calendar,
  CalendarRange,
  Filter,
  X,
  RotateCcw,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  getFinancialMonthBounds,
  getPreviousFinancialMonthBounds,
  getTodayDateStr,
  toDateInputValue,
} from '@/lib/financialMonth';
import { DateRangePicker, DateRange } from '@/components/ui/date-range-picker';
import { Pagination } from '@/components/ui/pagination';
import { exportRowsToExcel } from '@/lib/export-excel';

const PAGE_SIZE = 15;

export function AccountantReports() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [excelExporting, setExcelExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // فلتر نطاق زمني احترافي عبر DateRangePicker — افتراضيًا الشهر المالي الحالي (من 21 إلى 20)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const fin = getFinancialMonthBounds();
    return {
      from: fin.startStr,
      to: fin.endStr,
    };
  });

  async function fetchTransactions() {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*, user:user_id(first_name, last_name)')
      .order('created_at', { ascending: false });

    if (data) setTransactions(data);
    setLoading(false);
  }

  useEffect(() => {
    setTimeout(fetchTransactions, 0);

    const channel = supabase
      .channel('accountant_reports_transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        setTimeout(fetchTransactions, 0);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // تصفير الصفحة عند تغيير الفلاتر
  useEffect(() => {
    setPage(0);
  }, [search, typeFilter, dateRange.from, dateRange.to]);

  // دوال ضبط الفترات السريعة
  const handleQuickPreset = (preset: 'currentFin' | 'prevFin' | 'today' | 'last30' | 'all') => {
    const today = getTodayDateStr();
    if (preset === 'currentFin') {
      const fin = getFinancialMonthBounds();
      setDateRange({ from: fin.startStr, to: fin.endStr });
    } else if (preset === 'prevFin') {
      const prev = getPreviousFinancialMonthBounds();
      setDateRange({ from: prev.startStr, to: prev.endStr });
    } else if (preset === 'today') {
      setDateRange({ from: today, to: today });
    } else if (preset === 'last30') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setDateRange({ from: toDateInputValue(d), to: today });
    } else if (preset === 'all') {
      setDateRange({ from: '', to: '' });
    }
  };

  const filteredTransactions = useMemo(() => {
    const fromTime = dateRange.from ? new Date(dateRange.from + 'T00:00:00').getTime() : null;
    const toTime = dateRange.to ? new Date(dateRange.to + 'T23:59:59').getTime() : null;

    return transactions.filter((t) => {
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesSearch =
        (t.category && t.category.toLowerCase().includes(search.toLowerCase())) ||
        (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
        (t.user &&
          `${t.user.first_name || ''} ${t.user.last_name || ''}`
            .toLowerCase()
            .includes(search.toLowerCase()));

      const created = new Date(t.created_at).getTime();
      const matchesDate =
        (!fromTime || created >= fromTime) && (!toTime || created <= toTime);

      return matchesType && (search ? matchesSearch : true) && matchesDate;
    });
  }, [transactions, typeFilter, search, dateRange.from, dateRange.to]);

  // تجميع الإيرادات/المصروفات يوميًا للرسم البياني ضمن النطاق الزمني المختار
  const chartData = useMemo(() => {
    const byDay = new Map<string, { date: string; income: number; expense: number }>();
    filteredTransactions.forEach((t) => {
      const day = new Date(t.created_at).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { date: day, income: 0, expense: 0 });
      const row = byDay.get(day)!;
      if (t.type === 'income') row.income += Number(t.amount || 0);
      else row.expense += Number(t.amount || 0); // expense + salary
    });
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions]);

  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = filteredTransactions
      .filter((t) => t.type !== 'income')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    return {
      income,
      expense,
      net: income - expense,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // تقسيم الجدول لصفحات
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedTransactions = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, safePage]);

  // فحص النطاق النشط
  const currentFinBounds = useMemo(() => getFinancialMonthBounds(), []);
  const prevFinBounds = useMemo(() => getPreviousFinancialMonthBounds(), []);

  const isCurrentFinActive =
    dateRange.from === currentFinBounds.startStr && dateRange.to === currentFinBounds.endStr;
  const isPrevFinActive =
    dateRange.from === prevFinBounds.startStr && dateRange.to === prevFinBounds.endStr;
  const isAllTimeActive = !dateRange.from && !dateRange.to;

  const handlePrint = () => {
    window.print();
  };

  // تصدير جدول المعاملات المفلترة حالياً بصيغة ملف Excel (.xlsx) للمحاسب
  const handleExportExcel = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) return;
    setExcelExporting(true);
    setExportNotice(null);

    try {
      const dataRows = filteredTransactions.map((t, idx) => {
        const isIncome = t.type === 'income';
        const isSalary = t.type === 'salary';
        const typeLabel = isIncome ? 'إيراد (+)' : isSalary ? 'راتب طبيب (-)' : 'مصروف تشغيلي (-)';
        const createdDate = new Date(t.created_at);
        const dateStr = createdDate.toISOString().slice(0, 10);
        const timeStr = createdDate.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const doctorName = t.user ? `د. ${t.user.first_name} ${t.user.last_name}` : 'المركز';
        const numAmt = Number(t.amount || 0);

        return {
          'م': idx + 1,
          'تاريخ الحركة': dateStr,
          'التوقيت': timeStr,
          'نوع الحركة': typeLabel,
          'التصنيف': t.category || 'غير مصنف',
          'المستفيد / المسؤول': doctorName,
          'البيان / الملاحظات': t.description || '',
          'المبلغ (ج.م)': numAmt,
          'التأثير المالي': isIncome ? +numAmt : -numAmt,
          'معرف الحركة (ID)': t.id,
        };
      });

      // إضافة أسطر إحصائية ختامية بالملف لمساعدة المحاسبين في المراجعة
      const summaryRows = [
        {
          'م': '',
          'تاريخ الحركة': '---',
          'التوقيت': '---',
          'نوع الحركة': '=== إجمالي الإيرادات ===',
          'التصنيف': '',
          'المستفيد / المسؤول': '',
          'البيان / الملاحظات': `عدد حركات الإيراد: ${
            filteredTransactions.filter((t) => t.type === 'income').length
          }`,
          'المبلغ (ج.م)': totals.income,
          'التأثير المالي': totals.income,
          'معرف الحركة (ID)': '',
        },
        {
          'م': '',
          'تاريخ الحركة': '---',
          'التوقيت': '---',
          'نوع الحركة': '=== إجمالي المصروفات والأجور ===',
          'التصنيف': '',
          'المستفيد / المسؤول': '',
          'البيان / الملاحظات': `عدد حركات المصروف: ${
            filteredTransactions.filter((t) => t.type !== 'income').length
          }`,
          'المبلغ (ج.م)': totals.expense,
          'التأثير المالي': -totals.expense,
          'معرف الحركة (ID)': '',
        },
        {
          'م': '',
          'تاريخ الحركة': '---',
          'التوقيت': '---',
          'نوع الحركة': '=== صافي الفائض / العجز ===',
          'التصنيف': '',
          'المستفيد / المسؤول': '',
          'البيان / الملاحظات': totals.net >= 0 ? 'فائض مالي (+)' : 'عجز مالي (-)',
          'المبلغ (ج.م)': totals.net,
          'التأثير المالي': totals.net,
          'معرف الحركة (ID)': '',
        },
        {
          'م': '',
          'تاريخ الحركة': '---',
          'التوقيت': '---',
          'نوع الحركة': '=== إجمالي الحركات المفلترة ===',
          'التصنيف': '',
          'المستفيد / المسؤول': '',
          'البيان / الملاحظات': `الفترة: من ${dateRange.from || 'بداية السجلات'} إلى ${
            dateRange.to || 'الآن'
          }`,
          'المبلغ (ج.م)': totals.count,
          'التأثير المالي': totals.count,
          'معرف الحركة (ID)': '',
        },
      ];

      const allRows = [...dataRows, ...summaryRows];

      const periodSlug =
        dateRange.from && dateRange.to
          ? `${dateRange.from}_إلى_${dateRange.to}`
          : 'كافة_الحركات';
      const fileName = `تقرير_المعاملات_المالية_${periodSlug}_${getTodayDateStr()}`;

      const ok = exportRowsToExcel(allRows, 'المعاملات المالية', fileName, {
        'م': 6,
        'تاريخ الحركة': 14,
        'التوقيت': 12,
        'نوع الحركة': 24,
        'التصنيف': 20,
        'المستفيد / المسؤول': 22,
        'البيان / الملاحظات': 35,
        'المبلغ (ج.م)': 16,
        'التأثير المالي': 16,
        'معرف الحركة (ID)': 20,
      });

      if (ok) {
        setExportNotice(`تم تصدير ${filteredTransactions.length} حركة مالية إلى ملف Excel بنجاح.`);
        setTimeout(() => setExportNotice(null), 5000);
      }
    } catch (err) {
      console.error('Failed to export transactions to Excel:', err);
    } finally {
      setExcelExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <BarChartIcon className="w-8 h-8 text-emerald-600" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">التقارير المالية والتحليلية</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              استعراض جدول الحركات وتوزيع الإيرادات والمصروفات حسب نطاق التاريخ والشهر المالي
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* زر تصدير إلى Excel الرئيسي */}
          <button
            onClick={handleExportExcel}
            disabled={filteredTransactions.length === 0 || excelExporting}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer transition-all disabled:opacity-50"
            title="تحميل جدول المعاملات المفلترة حالياً بصيغة Excel لإجراء تعديلات خارجية"
          >
            {excelExporting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-5 h-5" />
            )}
            <span>تصدير إلى Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 font-bold px-4 py-2.5 rounded-xl hover:bg-gray-50 shadow-xs cursor-pointer transition-all"
          >
            <Printer className="w-5 h-5 text-emerald-600" />
            <span>تصدير PDF (طباعة)</span>
          </button>
        </div>
      </div>

      {/* تنبيه نجاح التصدير */}
      {exportNotice && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* قسم البحث وفلتر نوع الحركة */}
      <div className="flex flex-col md:flex-row gap-4 print:hidden">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="بحث في التصنيف، البيان، أو اسم المستفيد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-10 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-sm text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full md:w-1/4 border rounded-xl p-3 bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold cursor-pointer"
        >
          <option value="all">جميع الحركات (إيرادات ومصروفات)</option>
          <option value="income">إيرادات فقط</option>
          <option value="expense">مصروفات تشغيلية فقط</option>
          <option value="salary">رواتب ومستحقات أطباء</option>
        </select>
      </div>

      {/* قسم فلاتر اختيار نطاق تاريخ (Date Range Picker) المطور بدلاً من التحديد البسيط */}
      <div className="flex flex-col gap-3 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CalendarRange className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>نطاق التاريخ (Date Range Picker):</span>
            </div>

            {/* مكوّن DateRangePicker الاحترافي بدلاً من حقول التاريخ المنفصلة البسيطة */}
            <DateRangePicker
              value={dateRange}
              onChange={(newRange) => setDateRange(newRange)}
              placeholder="اختر نطاق التاريخ المالي..."
              showFinancialPresets={true}
            />
          </div>

          {/* أزرار الفترات الجاهزة وسريعة الوصول */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-gray-500 ml-1">فترات سريعة:</span>
            <button
              type="button"
              onClick={() => handleQuickPreset('currentFin')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                isCurrentFinActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
              title="الشهر المالي الحالي (من 21 إلى 20)"
            >
              الشهر المالي الحالي (21 - 20)
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('prevFin')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                isPrevFinActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
              }`}
              title="الشهر المالي السابق (من 21 إلى 20)"
            >
              الشهر المالي السابق
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('today')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-all cursor-pointer"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('last30')}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-all cursor-pointer"
            >
              آخر 30 يوم
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                isAllTimeActive
                  ? 'bg-gray-800 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              كافة الفترات
            </button>
          </div>
        </div>

        {/* شريط حالة النطاق الزمني وإجمالي الحركات المندرجة */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-gray-100 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-500">الفترة المفعلة للتقارير:</span>
            {dateRange.from && dateRange.to ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-gray-800 bg-gray-50 border px-2.5 py-1 rounded-md" dir="ltr">
                <span>{dateRange.from}</span>
                <span className="text-gray-400">➔</span>
                <span>{dateRange.to}</span>
              </span>
            ) : (
              <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                كافة الحركات المالية المسجلة بدون تحديد نطاق
              </span>
            )}
            {isCurrentFinActive && (
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold">
                دورة الشهر المالي للعيادات
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-700">
              عدد الحركات المطابقة: <span className="text-emerald-700 font-black">{filteredTransactions.length}</span> حركة
            </span>
            {(dateRange.from || dateRange.to || search || typeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  handleQuickPreset('currentFin');
                  setSearch('');
                  setTypeFilter('all');
                }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط الفلاتر</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* كروت الإحصائيات المالية للنطاق الزمني المحدد */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-t-4 border-t-emerald-500 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-gray-500">إجمالي الإيرادات (النطاق المحدد)</p>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-600" dir="ltr">
              +{totals.income.toLocaleString('ar-EG')} <span className="text-sm font-bold">ج.م</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-red-500 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-gray-500">إجمالي المصروفات والأجور (النطاق المحدد)</p>
              <TrendingDown className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-2xl font-black text-red-600" dir="ltr">
              -{totals.expense.toLocaleString('ar-EG')} <span className="text-sm font-bold">ج.م</span>
            </p>
          </CardContent>
        </Card>

        <Card className={`border-t-4 shadow-sm ${totals.net >= 0 ? 'border-t-blue-500' : 'border-t-orange-500'}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-gray-500">صافي الفائض / العجز</p>
              <DollarSign className={`w-4 h-4 ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
            <p className={`text-2xl font-black ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} dir="ltr">
              {totals.net.toLocaleString('ar-EG')} <span className="text-sm font-bold">ج.م</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* رسم بياني يومي للإيرادات والمصروفات حسب النطاق الزمني المختار */}
      <Card className="shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-base">
              الإيرادات والمصروفات اليومية ضمن النطاق الزمني المحدد
            </h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
              {chartData.length} يوم مسجل به حركات
            </span>
          </div>

          {chartData.length === 0 ? (
            <p className="text-center text-gray-400 py-10 font-medium text-sm">
              لا توجد حركات مالية مسجلة ضمن النطاق الزمني المحدد
            </p>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => `${Number(value ?? 0).toLocaleString('ar-EG')} ج.م`}
                    labelFormatter={(label) => `التاريخ: ${label}`}
                  />
                  <Legend formatter={(value) => (value === 'income' ? 'إيرادات' : 'مصروفات وأجور')} />
                  <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* جدول الحركات والمعاملات المالية مع الفلترة والترقيم */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          <div className="p-4 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-800">جدول الحركات والمعاملات المالية</h3>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                {filteredTransactions.length} حركة مطابقة
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={filteredTransactions.length === 0 || excelExporting}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="تصدير جدول المعاملات المفلترة إلى ملف Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>تصدير إلى Excel ({filteredTransactions.length})</span>
              </button>

              <div className="text-xs text-gray-500 font-medium">
                الصفحة {safePage + 1} من {totalPages}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-bold">
              لا توجد حركات مالية مطابقة للفلاتر ونطاق التاريخ المحدد
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100/70 border-b text-gray-700">
                    <th className="p-3.5 font-bold">التاريخ والتوقيت</th>
                    <th className="p-3.5 font-bold">النوع</th>
                    <th className="p-3.5 font-bold">التصنيف</th>
                    <th className="p-3.5 font-bold">البيان / الملاحظات</th>
                    <th className="p-3.5 font-bold">المستفيد / المسؤول</th>
                    <th className="p-3.5 font-bold text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedTransactions.map((t) => {
                    const isIncome = t.type === 'income';
                    const isSalary = t.type === 'salary';
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3.5 text-gray-600 font-medium" dir="ltr">
                          {new Date(t.created_at).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3.5">
                          {isIncome && (
                            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md text-xs font-bold">
                              إيراد (+)
                            </span>
                          )}
                          {t.type === 'expense' && (
                            <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-md text-xs font-bold">
                              مصروف (-)
                            </span>
                          )}
                          {isSalary && (
                            <span className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-md text-xs font-bold">
                              راتب طبيب
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-bold text-gray-800">{t.category}</td>
                        <td className="p-3.5 text-gray-600">{t.description || '---'}</td>
                        <td className="p-3.5 text-gray-700 font-medium">
                          {t.user ? `د. ${t.user.first_name} ${t.user.last_name}` : 'المركز'}
                        </td>
                        <td
                          className={`p-3.5 text-left font-black ${
                            isIncome ? 'text-emerald-600' : 'text-red-600'
                          }`}
                          dir="ltr"
                        >
                          {isIncome ? '+' : '-'}
                          {Number(t.amount).toLocaleString('ar-EG')} ج.م
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* أدوات التنقل بين الصفحات */}
          {!loading && filteredTransactions.length > 0 && (
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-gray-500 font-medium">
                عرض {safePage * PAGE_SIZE + 1} - {Math.min((safePage + 1) * PAGE_SIZE, filteredTransactions.length)} من إجمالي {filteredTransactions.length} حركة مالية
              </div>
              <Pagination
                page={safePage}
                pageSize={PAGE_SIZE}
                total={filteredTransactions.length}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
