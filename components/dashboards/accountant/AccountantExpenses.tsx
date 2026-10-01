'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  Plus,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  CheckCircle2,
  CalendarRange,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  toTransactionType,
  TransactionType,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_COLORS,
} from '@/lib/types';
import {
  getFinancialMonthBounds,
  getPreviousFinancialMonthBounds,
  getTodayDateStr,
  toDateInputValue,
} from '@/lib/financialMonth';
import { DateRangePicker, DateRange } from '@/components/ui/date-range-picker';
import { exportRowsToExcel } from '@/lib/export-excel';

const FETCH_CAP = 2000;
const PAGE_SIZE = 10;

export function AccountantExpenses() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addedOk, setAddedOk] = useState<string | null>(null);

  // فلاتر جدول المعاملات
  const [search, setSearch] = useState('');
  const [tableTypeFilter, setTableTypeFilter] = useState('all');
  const [page, setPage] = useState(0);

  // فلتر نطاق التاريخ عبر DateRangePicker (افتراضياً الشهر المالي الحالي)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const fin = getFinancialMonthBounds();
    return {
      from: fin.startStr,
      to: fin.endStr,
    };
  });

  useEffect(() => {
    fetchTransactions();
    // لازم قائمة الأطباء عشان نقدر نربط معاملة "راتب طبيب" بطبيب محدد
    // (user_id) — من غيرها الطبيب معنديش أي وسيلة يشوف مستحقاته لاحقًا.
    supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('role', 'doctor')
      .then(({ data }) => {
        setDoctors(data || []);
      });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setPage(0), 0);
    return () => clearTimeout(t);
  }, [search, tableTypeFilter, dateRange.from, dateRange.to]);

  async function fetchTransactions() {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      // transactions فيها علاقتين بـ profiles (user_id و beneficiary_id) —
      // لازم نحدد المقصود صراحةً وإلا Postgrest بيرفض الطلب بخطأ الغموض.
      .select('*, profiles!transactions_user_id_fkey(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP);

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل سجل المعاملات.'));
      setTransactions([]);
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddedOk(null);
    if (!amount || !category) {
      setAddError('يرجى إدخال المبلغ والتصنيف.');
      return;
    }
    if (type === 'salary' && !doctorId) {
      setAddError('يرجى اختيار الطبيب المستحق للمبلغ حتى يظهر له في حساباته.');
      return;
    }
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setAddError('المبلغ يجب أن يكون رقمًا أكبر من صفر.');
      return;
    }

    setAdding(true);
    const { error } = await supabase.from('transactions').insert([
      {
        amount: amt,
        type,
        category: category.trim(),
        description: description.trim(),
        user_id: type === 'salary' ? doctorId : null,
      },
    ]);

    setAdding(false);
    if (!error) {
      setAmount('');
      setCategory('');
      setDescription('');
      setDoctorId('');
      fetchTransactions();
      setAddedOk('تم تسجيل المعاملة المالية بنجاح.');
    } else {
      setAddError(getFriendlyErrorMessage(error, 'حدث خطأ أثناء تسجيل المعاملة.'));
    }
  };

  // دوال الفترات السريعة
  const handleQuickPreset = (preset: 'currentFin' | 'prevFin' | 'today' | 'all') => {
    const today = getTodayDateStr();
    if (preset === 'currentFin') {
      const fin = getFinancialMonthBounds();
      setDateRange({ from: fin.startStr, to: fin.endStr });
    } else if (preset === 'prevFin') {
      const prev = getPreviousFinancialMonthBounds();
      setDateRange({ from: prev.startStr, to: prev.endStr });
    } else if (preset === 'today') {
      setDateRange({ from: today, to: today });
    } else if (preset === 'all') {
      setDateRange({ from: '', to: '' });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTime = dateRange.from ? new Date(dateRange.from + 'T00:00:00').getTime() : null;
    const toTime = dateRange.to ? new Date(dateRange.to + 'T23:59:59').getTime() : null;

    return transactions.filter((t) => {
      const matchesSearch =
        !q ||
        String(t.category || '').toLowerCase().includes(q) ||
        String(t.description || '').toLowerCase().includes(q) ||
        TRANSACTION_TYPE_LABELS[toTransactionType(t.type)].toLowerCase().includes(q) ||
        (t.profiles &&
          `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`
            .toLowerCase()
            .includes(q));

      const matchesType = tableTypeFilter === 'all' || t.type === tableTypeFilter;

      const created = new Date(t.created_at).getTime();
      const matchesDate =
        (!fromTime || created >= fromTime) && (!toTime || created <= toTime);

      return matchesSearch && matchesType && matchesDate;
    });
  }, [transactions, search, tableTypeFilter, dateRange.from, dateRange.to]);

  // إحصائيات سريعة للبيانات المفلترة حسب النطاق الزمني
  const periodTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filtered.forEach((t) => {
      if (t.type === 'income') income += Number(t.amount || 0);
      else expense += Number(t.amount || 0); // expense or salary
    });
    return {
      income,
      expense,
      net: income - expense,
      count: filtered.length,
    };
  }, [filtered]);

  const currentFinBounds = useMemo(() => getFinancialMonthBounds(), []);
  const prevFinBounds = useMemo(() => getPreviousFinancialMonthBounds(), []);
  const isCurrentFinActive =
    dateRange.from === currentFinBounds.startStr && dateRange.to === currentFinBounds.endStr;
  const isPrevFinActive =
    dateRange.from === prevFinBounds.startStr && dateRange.to === prevFinBounds.endStr;
  const isAllActive = !dateRange.from && !dateRange.to;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // تصدير جدول المعاملات المفلترة حالياً إلى Excel (.xlsx)
  const handleExportExcel = () => {
    if (!filtered || filtered.length === 0) return;

    const dataRows = filtered.map((t, idx) => {
      const ttype = toTransactionType(t.type);
      const isIncome = ttype === 'income';
      const isSalary = ttype === 'salary';
      const typeLabel = TRANSACTION_TYPE_LABELS[ttype];
      const createdDate = new Date(t.created_at);
      const dateStr = createdDate.toISOString().slice(0, 10);
      const doctorName = t.profiles
        ? `د. ${t.profiles.first_name} ${t.profiles.last_name}`
        : 'المركز';
      const numAmt = Number(t.amount || 0);

      return {
        'م': idx + 1,
        'تاريخ الحركة': dateStr,
        'نوع الحركة': typeLabel,
        'التصنيف': t.category || '',
        'المستفيد / المسؤول': doctorName,
        'البيان / الملاحظات': t.description || '',
        'المبلغ (ج.م)': numAmt,
        'التأثير المالي': isIncome ? +numAmt : -numAmt,
        'معرف الحركة (ID)': t.id,
      };
    });

    const summaryRows = [
      {
        'م': '',
        'تاريخ الحركة': '---',
        'نوع الحركة': '=== إجمالي الإيرادات ===',
        'التصنيف': '',
        'المستفيد / المسؤول': '',
        'البيان / الملاحظات': `عدد حركات الإيراد: ${
          filtered.filter((t) => t.type === 'income').length
        }`,
        'المبلغ (ج.م)': periodTotals.income,
        'التأثير المالي': periodTotals.income,
        'معرف الحركة (ID)': '',
      },
      {
        'م': '',
        'تاريخ الحركة': '---',
        'نوع الحركة': '=== إجمالي المصروفات والأجور ===',
        'التصنيف': '',
        'المستفيد / المسؤول': '',
        'البيان / الملاحظات': `عدد حركات المصروف: ${
          filtered.filter((t) => t.type !== 'income').length
        }`,
        'المبلغ (ج.م)': periodTotals.expense,
        'التأثير المالي': -periodTotals.expense,
        'معرف الحركة (ID)': '',
      },
      {
        'م': '',
        'تاريخ الحركة': '---',
        'نوع الحركة': '=== صافي الفترة ===',
        'التصنيف': '',
        'المستفيد / المسؤول': '',
        'البيان / الملاحظات': periodTotals.net >= 0 ? 'فائض مالي (+)' : 'عجز مالي (-)',
        'المبلغ (ج.م)': periodTotals.net,
        'التأثير المالي': periodTotals.net,
        'معرف الحركة (ID)': '',
      },
    ];

    const allRows = [...dataRows, ...summaryRows];
    const periodSlug =
      dateRange.from && dateRange.to
        ? `${dateRange.from}_إلى_${dateRange.to}`
        : 'كافة_المعاملات';
    const fileName = `سجل_المعاملات_المالية_${periodSlug}_${getTodayDateStr()}`;

    exportRowsToExcel(allRows, 'سجل المعاملات', fileName, {
      'م': 6,
      'تاريخ الحركة': 14,
      'نوع الحركة': 20,
      'التصنيف': 20,
      'المستفيد / المسؤول': 22,
      'البيان / الملاحظات': 35,
      'المبلغ (ج.م)': 16,
      'التأثير المالي': 16,
      'معرف الحركة (ID)': 20,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-8 h-8 text-emerald-600" />
        <div>
          <h2 className="text-3xl font-bold text-gray-800">إدارة الإيرادات والمصروفات</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            تسجيل القيود الجديدة واستعراض سجل الحركات المالية مع فلترة نطاق التاريخ
          </p>
        </div>
      </div>

      <Card className="border-emerald-100 shadow-sm">
        <CardHeader className="bg-emerald-50 rounded-t-xl border-b border-emerald-100">
          <CardTitle className="text-emerald-800 text-lg">تسجيل معاملة مالية جديدة</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">النوع</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TransactionType)}
                  className="w-full border rounded-lg p-3 bg-white"
                >
                  {TRANSACTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TRANSACTION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ (ج.م)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border rounded-lg p-3"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">التصنيف</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border rounded-lg p-3"
                  placeholder="مثال: مستهلكات، كهرباء، كشف..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات / بيان</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border rounded-lg p-3"
                  placeholder="تفاصيل إضافية..."
                />
              </div>
            </div>
            {type === 'salary' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الطبيب المستحق</label>
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full md:w-1/2 border rounded-lg p-3 bg-white"
                  required
                >
                  <option value="">-- اختر الطبيب --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      د. {d.first_name} {d.last_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  لازم تحديد الطبيب عشان يظهر له المبلغ في تبويب &quot;الحسابات والرواتب&quot; الخاص به.
                </p>
              </div>
            )}
            {addError && <InlineError message={addError} />}
            {addedOk && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{addedOk}</span>
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={adding}
                className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                تسجيل المعاملة
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* جدول الحركات والمعاملات المالية مع فلتر DateRangePicker */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          {/* شريط عنوان الجدول والفلاتر */}
          <div className="p-4 bg-gray-50 border-b space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-800 text-base">سجل الحركات والمعاملات المالية</h3>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {filtered.length} حركة
                </span>
              </div>

              {/* حقل البحث ونوع الحركة وزر التصدير */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="تحميل جدول المعاملات المفلترة حالياً بصيغة Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير إلى Excel</span>
                </button>

                <select
                  value={tableTypeFilter}
                  onChange={(e) => setTableTypeFilter(e.target.value)}
                  className="border rounded-lg py-2 px-3 text-xs font-semibold bg-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="income">إيرادات فقط</option>
                  <option value="expense">مصروفات فقط</option>
                  <option value="salary">رواتب أطباء</option>
                </select>

                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="بحث في التصنيف أو البيان…"
                    className="border rounded-lg py-2 pr-3 pl-9 text-xs w-48 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            {/* صف فلتر نطاق التاريخ (Date Range Picker) المتقدم */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                  <CalendarRange className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تحديد النطاق:</span>
                </div>
                <DateRangePicker
                  value={dateRange}
                  onChange={(newRange) => setDateRange(newRange)}
                  placeholder="اختر نطاق التاريخ..."
                  showFinancialPresets={true}
                />
              </div>

              {/* أزرار الفترات السريعة */}
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickPreset('currentFin')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isCurrentFinActive
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                  title="الشهر المالي الحالي (من 21 إلى 20)"
                >
                  الشهر المالي الحالي
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('prevFin')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isPrevFinActive
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                  title="الشهر المالي السابق (من 21 إلى 20)"
                >
                  الشهر المالي السابق
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('today')}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 transition-all cursor-pointer"
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('all')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isAllActive
                      ? 'bg-gray-800 text-white shadow-2xs'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  الكل
                </button>

                {(dateRange.from || dateRange.to || search || tableTypeFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickPreset('currentFin');
                      setSearch('');
                      setTableTypeFilter('all');
                    }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2 py-1 transition-colors cursor-pointer"
                    title="إعادة تعيين الفلاتر"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>تصفير</span>
                  </button>
                )}
              </div>
            </div>

            {/* شريط ملخص إحصائيات النطاق الزمني المحدد */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-200/60 text-xs">
              <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
                <span className="text-gray-500 block">إجمالي حركات الفترة</span>
                <span className="font-bold text-gray-800">{periodTotals.count} حركة</span>
              </div>
              <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                <span className="text-emerald-700 block font-medium">إيرادات الفترة</span>
                <span className="font-black text-emerald-700" dir="ltr">
                  +{periodTotals.income.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              <div className="bg-red-50/70 p-2 rounded-lg border border-red-100">
                <span className="text-red-700 block font-medium">مصروفات وأجور الفترة</span>
                <span className="font-black text-red-700" dir="ltr">
                  -{periodTotals.expense.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              <div className={`p-2 rounded-lg border ${periodTotals.net >= 0 ? 'bg-blue-50/70 border-blue-100 text-blue-700' : 'bg-orange-50/70 border-orange-100 text-orange-700'}`}>
                <span className="block font-medium">صافي الفترة</span>
                <span className="font-black" dir="ltr">
                  {periodTotals.net.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={fetchTransactions} compact />
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {transactions.length === 0
                ? 'لا توجد معاملات مسجلة بعد.'
                : 'لا توجد حركات مالية مطابقة للفلاتر ونطاق التاريخ المحدد.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100/70 border-b text-gray-700">
                    <th className="p-3.5 font-bold">التاريخ</th>
                    <th className="p-3.5 font-bold">النوع</th>
                    <th className="p-3.5 font-bold">التصنيف</th>
                    <th className="p-3.5 font-bold">المستفيد</th>
                    <th className="p-3.5 font-bold">البيان</th>
                    <th className="p-3.5 font-bold text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageItems.map((t) => {
                    const ttype = toTransactionType(t.type);
                    const isExpense = ttype !== 'income';
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3.5 text-gray-600 font-medium" dir="ltr">
                          {new Date(t.created_at).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs w-fit ${TRANSACTION_TYPE_COLORS[ttype]}`}
                          >
                            {isExpense ? (
                              <ArrowDownCircle className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpCircle className="w-3.5 h-3.5" />
                            )}
                            {TRANSACTION_TYPE_LABELS[ttype]}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-gray-800">{t.category}</td>
                        <td className="p-3.5 text-gray-600 text-sm">
                          {t.profiles ? `د. ${t.profiles.first_name} ${t.profiles.last_name}` : '---'}
                        </td>
                        <td className="p-3.5 text-gray-600">{t.description || '---'}</td>
                        <td
                          className={`p-3.5 text-left font-black ${
                            isExpense ? 'text-red-600' : 'text-emerald-600'
                          }`}
                          dir="ltr"
                        >
                          {isExpense ? '-' : '+'}
                          {Number(t.amount).toLocaleString('ar-EG')} ج.م
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-gray-500 font-medium">
              عرض {safePage * PAGE_SIZE + 1} - {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} من إجمالي {filtered.length} حركة مالية
            </div>
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}