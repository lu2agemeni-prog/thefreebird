'use client';

// ============================================================================
// components/dashboards/manager/tabs/FinancialsTab.tsx
// تبويب "الماليات والأرباح" للمدير:
// - عرض شامل لجدول transactions مع إمكانية التعديل والحذف المباشر لكل حركة.
// - فلترة ذكية حسب: الشهر المالي (21 - 20) مع قائمة منسدلة لآخر 12 شهراً،
//   نطاق التواريخ، نوع الحركة، العيادة، والتصنيف، وبحث فوري.
// - ترتيب مرن حسب: التاريخ والوقت (تصاعدي/تنازلي) أو المبلغ (الأعلى/الأقل).
// - إحصائيات فورية للخزينة، وتصدير إكسيل (.xlsx) وطباعة PDF.
// ============================================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download,
  Printer,
  X,
  Building2,
  Calendar,
  Wallet,
  Clock,
  User,
  Tag,
  FileText,
  Filter,
  Sparkles,
  CheckCircle2,
  Pencil,
  Trash2,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  CalendarRange,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { authFetchJson } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { toTransactionType, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from '@/lib/types';
import {
  getFinancialMonthBounds,
  getPreviousFinancialMonthBounds,
  getFinancialMonthsList,
  toDateInputValue,
  getTodayDateStr,
} from '@/lib/financialMonth';
import { exportRowsToExcel } from '@/lib/export-excel';
import { PrintableReportModal } from '@/components/ui/printable-report-modal';
import { ProfitReportPanel } from './ProfitReportPanel';
import { EditTransactionModal } from './EditTransactionModal';

const PAGE_SIZE = 15;

const EXPENSE_GROUP_LABELS: Record<string, string> = {
  rent_utilities: 'المصروفات العامة والإيجار',
  consumables: 'المستهلكات والمستلزمات',
  wages: 'الأجور والرواتب',
  equipment_maintenance: 'الأجهزة والصيانة والانتقالات',
  misc: 'نثريات ومصروفات أخرى',
  'كشف وعيادات': 'كشف واستشارات عيادات',
  'معمل وتحاليل': 'تحاليل وخدمات معمل',
  'أدوية وصيدلية': 'أدوية وصيدلية',
};

export function FinancialsTab() {
  const [view, setView] = useState<'list' | 'profit_report'>('list');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // قائمة العيادات للفلترة والتعديل
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);

  // الفلاتر
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clinicFilter, setClinicFilter] = useState('');
  const [expenseGroupFilter, setExpenseGroupFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(() => getFinancialMonthBounds().startStr);
  const [dateTo, setDateTo] = useState(() => getFinancialMonthBounds().endStr);
  const [selectedMonthId, setSelectedMonthId] = useState<string>(() => {
    const cur = getFinancialMonthBounds();
    return `${cur.startStr}_${cur.endStr}`;
  });

  // الترتيب: حسب التاريخ أو المبلغ، تصاعدي أو تنازلي
  const [sortBy, setSortBy] = useState<'created_at' | 'amount'>('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(0);

  // قائمة الأشهر المالية لآخر 12 شهراً
  const financialMonths = useMemo(() => getFinancialMonthsList(12), []);

  // المودالات وإجراءات التعديل والحذف
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // جلب العيادات
  useEffect(() => {
    supabase
      .from('clinics')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setClinics(data);
      });
  }, []);

  // جلب المعاملات المالية
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (search.trim()) params.set('q', search.trim());
    if (typeFilter) params.set('type', typeFilter);
    if (clinicFilter) params.set('clinicId', clinicFilter);
    if (expenseGroupFilter) params.set('expenseGroup', expenseGroupFilter);
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    const { data, error: fetchErr } = await authFetchJson(`/api/manager/transactions?${params.toString()}`);
    if (fetchErr) setError(fetchErr);
    else {
      setTransactions(data.rows || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [page, search, typeFilter, clinicFilter, expenseGroupFilter, sortBy, sortOrder, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(fetchTransactions, 0);
    return () => clearTimeout(t);
  }, [fetchTransactions]);

  // تصفير الصفحة عند تغيير الفلاتر
  useEffect(() => {
    const t = setTimeout(() => setPage(0), 0);
    return () => clearTimeout(t);
  }, [search, typeFilter, clinicFilter, expenseGroupFilter, sortBy, sortOrder, dateFrom, dateTo]);

  // اختيار شهر مالي محدد من القائمة المنسدلة
  const handleSelectFinancialMonth = (val: string) => {
    setSelectedMonthId(val);
    if (!val) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const found = financialMonths.find((m) => m.id === val);
    if (found) {
      setDateFrom(found.startStr);
      setDateTo(found.endStr);
    }
  };

  // أزرار الفترات السريعة
  const setQuickPeriod = (mode: 'current_fin' | 'prev_fin' | 'today' | 'week' | 'all') => {
    if (mode === 'current_fin') {
      const cur = getFinancialMonthBounds();
      setDateFrom(cur.startStr);
      setDateTo(cur.endStr);
      setSelectedMonthId(`${cur.startStr}_${cur.endStr}`);
    } else if (mode === 'prev_fin') {
      const prev = getPreviousFinancialMonthBounds();
      setDateFrom(prev.startStr);
      setDateTo(prev.endStr);
      setSelectedMonthId(`${prev.startStr}_${prev.endStr}`);
    } else if (mode === 'today') {
      const today = getTodayDateStr();
      setDateFrom(today);
      setDateTo(today);
      setSelectedMonthId('');
    } else if (mode === 'week') {
      const now = new Date();
      const first = new Date(now.setDate(now.getDate() - now.getDay()));
      const last = new Date(now.setDate(now.getDate() - now.getDay() + 6));
      setDateFrom(toDateInputValue(first));
      setDateTo(toDateInputValue(last));
      setSelectedMonthId('');
    } else if (mode === 'all') {
      setDateFrom('');
      setDateTo('');
      setSelectedMonthId('');
    }
  };

  // تبديل الترتيب بالنقر على رأس العمود
  const handleToggleSort = (column: 'created_at' | 'amount') => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // مسح الفلاتر
  const hasActiveFilters = Boolean(typeFilter || clinicFilter || expenseGroupFilter || dateFrom || dateTo || search);
  const clearFilters = () => {
    setTypeFilter('');
    setClinicFilter('');
    setExpenseGroupFilter('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setSelectedMonthId('');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  // حذف حركة مالية من الحسابات
  const handleDeleteTransaction = async (id: string, desc?: string, amount?: number) => {
    const descText = desc ? ` (${desc})` : '';
    const amountText = amount !== undefined ? ` بمبلغ ${amount.toLocaleString('ar-EG')} ج.م` : '';
    if (!confirm(`هل تريد بالتأكيد حذف هذه الحركة المالية${descText}${amountText} نهائياً؟\nسيتم إزالتها من سجلات الخزينة والحسابات بشكل دائم.`)) return;

    setDeletingTxId(id);
    const { data, error: delErr } = await authFetchJson('/api/manager/transactions', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    setDeletingTxId(null);

    if (delErr) {
      alert(`تعذر حذف الحركة المالية: ${delErr}`);
    } else {
      setCleanupMessage(data?.message || 'تم حذف المعاملة المالية بنجاح.');
      setTimeout(() => setCleanupMessage(null), 5000);
      fetchTransactions();
    }
  };

  // فحص وتنظيف الحركات المكررة يدويًا
  const handleCleanDuplicates = async () => {
    if (!confirm('سيتم فحص سجلات الإيرادات وحذف أي قيود مكررة مسجلة بالخطأ في نفس اللحظة لنفس العيادة والمبلغ أو القيود الصفرية. هل تريد المتابعة؟')) return;
    setCleaningDuplicates(true);
    setCleanupMessage(null);
    const { data, error: cleanErr } = await authFetchJson('/api/manager/transactions', {
      method: 'POST',
      body: JSON.stringify({ action: 'clean_duplicates' }),
    });
    setCleaningDuplicates(false);
    if (cleanErr) {
      setError(cleanErr);
    } else {
      setCleanupMessage(data?.message || 'تم تنظيف القيود المكررة بنجاح.');
      setTimeout(() => setCleanupMessage(null), 6000);
      fetchTransactions();
    }
  };

  // تصفية أي حركات مكررة أو قيود مشوهة لضمان دقة الجدول ومطابقته للإحصائيات والخزينة
  const displayTransactions = useMemo(() => {
    const validRows: any[] = [];
    transactions.forEach((t) => {
      if (t.type === 'income') {
        if (Number(t.amount) === 0) return; // استبعاد قيود الصفر الناتجة عن الطابور
        const curTime = t.created_at ? new Date(t.created_at).getTime() : 0;
        const curDesc = (t.description || '').trim().toLowerCase();
        const isTwin = validRows.some((prev) => {
          if (prev.type !== 'income') return false;
          if (Number(prev.amount) !== Number(t.amount)) return false;
          const prevTime = prev.created_at ? new Date(prev.created_at).getTime() : 0;
          const prevDesc = (prev.description || '').trim().toLowerCase();
          const quickTwin = Math.abs(curTime - prevTime) <= 60000 && (prev.clinic_id === t.clinic_id || !prev.clinic_id || !t.clinic_id);
          const descTwin = curDesc && curDesc === prevDesc && Math.abs(curTime - prevTime) <= 86400000;
          return quickTwin || descTwin;
        });
        if (!isTwin) validRows.push(t);
      } else {
        validRows.push(t);
      }
    });
    return validRows;
  }, [transactions]);

  // إحصائيات الصفحة الحالية المعروضة
  const pageStats = useMemo(() => {
    const incomeRows = displayTransactions.filter((t) => t.type === 'income');
    const expenseRows = displayTransactions.filter((t) => t.type !== 'income');
    const income = incomeRows.reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = expenseRows.reduce((s, t) => s + Number(t.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [displayTransactions]);

  // تصدير إكسيل
  const handleExportExcel = () => {
    if (displayTransactions.length === 0) return;
    const rows = displayTransactions.map((t, idx) => ({
      'م': idx + 1,
      'رقم الحركة': t.id ? t.id.slice(0, 8) : '',
      'التاريخ': new Date(t.created_at).toLocaleDateString('ar-EG'),
      'الوقت': new Date(t.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      'النوع': t.type === 'income' ? 'إيراد' : t.type === 'salary' ? 'راتب/مستحق' : 'مصروف',
      'التصنيف': EXPENSE_GROUP_LABELS[t.category] || t.category || 'عام',
      'المبلغ (ج.م)': Number(t.amount || 0),
      'البيان': t.description || '—',
      'العيادة': t.clinics?.name || 'المركز العام',
      'بواسطة': t.profiles ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim() : 'النظام',
      'المستفيد': t.beneficiary ? `${t.beneficiary.first_name || ''} ${t.beneficiary.last_name || ''}`.trim() : '—',
    }));

    exportRowsToExcel(
      rows,
      'سجل الحركات المالية',
      `سجل_الحركات_${dateFrom || 'الكل'}_${dateTo || 'الكل'}`
    );
  };

  return (
    <div className="space-y-6">
      {/* شريط العنوان والتبديل بين سجل الحركات وتقرير الأرباح */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200/80">
          <button
            onClick={() => setView('list')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              view === 'list'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            سجل الحركات والمعاملات
          </button>
          <button
            onClick={() => setView('profit_report')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              view === 'profit_report'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            تقرير الأرباح والموقف المالي
          </button>
        </div>

        {view === 'list' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCleanDuplicates}
              disabled={cleaningDuplicates}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-800 border border-amber-300 font-bold px-3 py-2 rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
              title="فحص وحذف أي قيود مكررة مسجلة في نفس اللحظة"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{cleaningDuplicates ? 'جاري الفحص...' : 'فحص وتنظيف التكرار'}</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={transactions.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تصدير إكسيل</span>
            </button>
            <button
              onClick={() => setIsPrintModalOpen(true)}
              disabled={transactions.length === 0}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-700 border border-gray-300 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / PDF</span>
            </button>
          </div>
        )}
      </div>

      {cleanupMessage && (
        <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{cleanupMessage}</span>
          </div>
          <button onClick={() => setCleanupMessage(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {view === 'profit_report' ? (
        <ProfitReportPanel />
      ) : (
        <Card className="border border-gray-200/80 shadow-xs">
          <CardHeader className="space-y-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  <span>جدول الحركات والمعاملات المالية (Transactions)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  عرض وتعديل وتصفية كافة الحركات المالية المسجلة بالخزينة والحسابات ({total} حركة مطابقة)
                </CardDescription>
              </div>
            </div>

            {/* شريط فلترة الشهر المالي المتقدم والفترات */}
            <div className="p-3 bg-gray-50 border border-gray-200/70 rounded-2xl space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
                {/* قائمة الأشهر المالية */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <CalendarDays className="w-4 h-4 text-emerald-600" /> الشهر المالي:
                  </span>
                  <select
                    value={selectedMonthId}
                    onChange={(e) => handleSelectFinancialMonth(e.target.value)}
                    className="border border-emerald-300 bg-white text-emerald-900 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  >
                    <option value="">-- اختر شهراً مالياً محدداً --</option>
                    {financialMonths.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayTitle}
                      </option>
                    ))}
                  </select>
                </div>

                {/* أزرار الفترات السريعة */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuickPeriod('current_fin')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedMonthId === `${getFinancialMonthBounds().startStr}_${getFinancialMonthBounds().endStr}`
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    }`}
                  >
                    الشهر الحالي (21 - 20)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickPeriod('prev_fin')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors cursor-pointer"
                  >
                    الشهر السابق (21 - 20)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickPeriod('today')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors cursor-pointer"
                  >
                    اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickPeriod('all')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors cursor-pointer"
                  >
                    كل الأوقات
                  </button>
                </div>
              </div>

              {/* اختيار نطاق التواريخ اليدوي والترتيب */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-gray-200/60 flex-wrap text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-600 flex items-center gap-1">
                    <CalendarRange className="w-3.5 h-3.5 text-gray-400" /> نطاق مخصص:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span>من:</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setSelectedMonthId('');
                      }}
                      className="border border-gray-300 rounded-lg p-1.5 bg-white text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                    <span>إلى:</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setSelectedMonthId('');
                      }}
                      className="border border-gray-300 rounded-lg p-1.5 bg-white text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* خيار الترتيب */}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-600 flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" /> الترتيب:
                  </span>
                  <select
                    value={`${sortBy}_${sortOrder}`}
                    onChange={(e) => {
                      const [col, ord] = e.target.value.split('_');
                      setSortBy(col as any);
                      setSortOrder(ord as any);
                    }}
                    className="border border-gray-300 bg-white rounded-lg px-2.5 py-1 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="created_at_desc">التاريخ: الأحدث أولاً ↓</option>
                    <option value="created_at_asc">التاريخ: الأقدم أولاً ↑</option>
                    <option value="amount_desc">المبلغ: الأعلى أولاً ↓</option>
                    <option value="amount_asc">المبلغ: الأقل أولاً ↑</option>
                  </select>
                </div>
              </div>
            </div>

            {/* شريط البحث والفلترة حسب النوع والعيادة والتصنيف */}
            <div className="flex flex-col md:flex-row gap-2.5 flex-wrap items-stretch md:items-center">
              <div className="flex-1 min-w-[200px]">
                <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث بالبيان أو التصنيف أو المريض أو المستفيد..." />
              </div>

              {/* نوع الحركة */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-xl p-2 text-xs bg-white text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                <option value="">جميع أنواع الحركات</option>
                <option value="income">إيرادات (+) فقط</option>
                <option value="expense">مصروفات (-) فقط</option>
                <option value="salary">رواتب ومستحقات (-)</option>
              </select>

              {/* فلتر العيادة */}
              <select
                value={clinicFilter}
                onChange={(e) => setClinicFilter(e.target.value)}
                className="border border-gray-300 rounded-xl p-2 text-xs bg-white text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">كل العيادات</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* فلتر التصنيف */}
              <select
                value={expenseGroupFilter}
                onChange={(e) => setExpenseGroupFilter(e.target.value)}
                className="border border-gray-300 rounded-xl p-2 text-xs bg-white text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">كل التصنيفات</option>
                {Object.entries(EXPENSE_GROUP_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-600 font-bold hover:underline px-2 cursor-pointer self-center"
                >
                  مسح الفلاتر
                </button>
              )}
            </div>

            {/* ملخص أرقام الصفحة الحالية */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5 text-center">
                <p className="text-[11px] text-emerald-700 font-medium">إيرادات الصفحة</p>
                <p className="text-base font-black text-emerald-800" dir="ltr">
                  +{pageStats.income.toLocaleString('ar-EG')} ج.م
                </p>
              </div>
              <div className="bg-red-50/70 border border-red-100 rounded-xl p-2.5 text-center">
                <p className="text-[11px] text-red-700 font-medium">مصروفات الصفحة</p>
                <p className="text-base font-black text-red-800" dir="ltr">
                  -{pageStats.expense.toLocaleString('ar-EG')} ج.م
                </p>
              </div>
              <div
                className={`border rounded-xl p-2.5 text-center ${
                  pageStats.net >= 0
                    ? 'bg-blue-50/70 border-blue-100 text-blue-800'
                    : 'bg-orange-50/70 border-orange-100 text-orange-800'
                }`}
              >
                <p className="text-[11px] font-medium">صافي الصفحة</p>
                <p className="text-base font-black" dir="ltr">
                  {pageStats.net >= 0 ? '+' : ''}
                  {pageStats.net.toLocaleString('ar-EG')} ج.م
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200/70 rounded-xl p-2.5 text-center">
                <p className="text-[11px] text-gray-500 font-medium">إجمالي الحركات المطابقة</p>
                <p className="text-base font-black text-gray-800" dir="ltr">
                  {total} <span className="text-[10px] text-gray-400 font-normal">سجل</span>
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {error && <ErrorState message={error} onRetry={fetchTransactions} compact />}
            {loading ? (
              <div className="text-center py-12 text-gray-500 space-y-2">
                <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs">جاري تحميل البيانات المالية...</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-gray-100/80 text-gray-700">
                      <th className="p-3 font-bold w-10 text-center">#</th>
                      <th
                        className="p-3 font-bold cursor-pointer select-none hover:bg-gray-200/60 transition-colors"
                        onClick={() => handleToggleSort('created_at')}
                        title="انقر لترتيب الحركات بالتاريخ والوقت"
                      >
                        <div className="flex items-center gap-1">
                          <span>التاريخ والوقت</span>
                          {sortBy === 'created_at' ? (
                            sortOrder === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th className="p-3 font-bold">النوع والتصنيف</th>
                      <th
                        className="p-3 font-bold cursor-pointer select-none hover:bg-gray-200/60 transition-colors"
                        onClick={() => handleToggleSort('amount')}
                        title="انقر لترتيب الحركات بالمبلغ"
                      >
                        <div className="flex items-center gap-1">
                          <span>المبلغ</span>
                          {sortBy === 'amount' ? (
                            sortOrder === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th className="p-3 font-bold">البيان / الوصف</th>
                      <th className="p-3 font-bold">العيادة</th>
                      <th className="p-3 font-bold">المستفيد / المسؤول</th>
                      <th className="p-3 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayTransactions.map((t, idx) => (
                      <tr
                        key={t.id || idx}
                        className="hover:bg-emerald-50/40 transition-colors group"
                      >
                        <td className="p-3 text-center text-gray-400 font-mono text-[11px]">
                          {page * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <p className="font-bold text-gray-800">
                            {new Date(t.created_at).toLocaleDateString('ar-EG')}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {new Date(t.created_at).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              TRANSACTION_TYPE_COLORS[toTransactionType(t.type)]
                            }`}
                          >
                            {TRANSACTION_TYPE_LABELS[toTransactionType(t.type)]}
                          </span>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {EXPENSE_GROUP_LABELS[t.category] || t.category || 'عام'}
                          </p>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`font-black text-sm ${
                              t.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                            }`}
                            dir="ltr"
                          >
                            {t.type === 'income' ? '+' : '-'}
                            {Number(t.amount || 0).toLocaleString('ar-EG')} ج.م
                          </span>
                        </td>
                        <td className="p-3 text-gray-700 min-w-[200px]">
                          <p className="font-medium line-clamp-2">{t.description || '—'}</p>
                        </td>
                        <td className="p-3 whitespace-nowrap text-gray-600">
                          {t.clinics?.name ? (
                            <span className="bg-gray-100 px-2 py-0.5 rounded-md text-[11px]">
                              {t.clinics.name}
                            </span>
                          ) : (
                            <span className="text-gray-400">المركز العام</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {t.beneficiary ? (
                            <span className="text-amber-800 font-bold block text-[11px]">
                              مستفيد: {t.beneficiary.first_name} {t.beneficiary.last_name}
                            </span>
                          ) : null}
                          <span className="text-gray-500 text-[10px]">
                            بواسطة: {t.profiles ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim() : 'النظام'}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* زر التعديل */}
                            <button
                              onClick={() => {
                                setEditingTransaction(t);
                                setIsEditModalOpen(true);
                              }}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="تعديل هذه الحركة المالية"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* زر حذف الحركة */}
                            <button
                              onClick={() => handleDeleteTransaction(t.id, t.description, t.amount)}
                              disabled={deletingTxId === t.id}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                              title="حذف هذه الحركة المالية نهائياً"
                            >
                              {deletingTxId === t.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>

                            {/* زر عرض التفاصيل */}
                            <button
                              onClick={() => setSelectedTransaction(t)}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                              title="عرض تفاصيل الحركة"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {displayTransactions.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-gray-400">
                          لا توجد حركات مالية مطابقة للفلاتر المحددة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                isLoading={loading}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* مودال تعديل المعاملة المالية */}
      <EditTransactionModal
        isOpen={isEditModalOpen}
        transaction={editingTransaction}
        clinics={clinics}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTransaction(null);
        }}
        onSaved={(updatedTx) => {
          setCleanupMessage('تم تعديل الحركة المالية بنجاح وضبط الحسابات.');
          setTimeout(() => setCleanupMessage(null), 5000);
          fetchTransactions();
        }}
      />

      {/* مودال تفاصيل المعاملة عند النقر على عرض */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div
                  className={`p-2 rounded-xl text-white ${
                    selectedTransaction.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">تفاصيل الحركة المالية</h3>
                  <p className="text-[10px] text-gray-400 font-mono">
                    ID: {selectedTransaction.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const toEdit = selectedTransaction;
                    setSelectedTransaction(null);
                    setEditingTransaction(toEdit);
                    setIsEditModalOpen(true);
                  }}
                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="تعديل هذه الحركة"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>تعديل</span>
                </button>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="text-center py-3 bg-gray-50/80 rounded-2xl border border-gray-100">
                <span className="text-[11px] text-gray-400 block mb-1">المبلغ الإجمالي</span>
                <span
                  className={`text-2xl font-black ${
                    selectedTransaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                  }`}
                  dir="ltr"
                >
                  {selectedTransaction.type === 'income' ? '+' : '-'}
                  {Number(selectedTransaction.amount || 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border rounded-xl p-3 space-y-1">
                  <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-gray-400" /> التاريخ والوقت
                  </span>
                  <p className="font-bold text-gray-800">
                    {new Date(selectedTransaction.created_at).toLocaleDateString('ar-EG')} -{' '}
                    {new Date(selectedTransaction.created_at).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                <div className="bg-white border rounded-xl p-3 space-y-1">
                  <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                    <Tag className="w-3.5 h-3.5 text-gray-400" /> التصنيف
                  </span>
                  <p className="font-bold text-gray-800">
                    {EXPENSE_GROUP_LABELS[selectedTransaction.category] ||
                      selectedTransaction.category ||
                      'عام'}
                  </p>
                </div>

                <div className="bg-white border rounded-xl p-3 space-y-1">
                  <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" /> العيادة المرتبطة
                  </span>
                  <p className="font-bold text-gray-800">
                    {selectedTransaction.clinics?.name || 'المركز العام'}
                  </p>
                </div>

                <div className="bg-white border rounded-xl p-3 space-y-1">
                  <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                    <User className="w-3.5 h-3.5 text-gray-400" /> المستخدم المسؤول
                  </span>
                  <p className="font-bold text-gray-800">
                    {selectedTransaction.profiles
                      ? `${selectedTransaction.profiles.first_name || ''} ${selectedTransaction.profiles.last_name || ''}`.trim()
                      : 'النظام'}
                  </p>
                </div>
              </div>

              {selectedTransaction.beneficiary && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                  <span className="text-amber-800 font-bold block mb-1">المستفيد من الصرف:</span>
                  <p className="text-gray-800 font-medium">
                    {selectedTransaction.beneficiary.first_name} {selectedTransaction.beneficiary.last_name}
                  </p>
                </div>
              )}

              <div className="bg-gray-50 border rounded-xl p-3 space-y-1">
                <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                  <FileText className="w-3.5 h-3.5 text-gray-400" /> البيان / الملاحظات
                </span>
                <p className="font-medium text-gray-800 leading-relaxed">
                  {selectedTransaction.description || 'لا يوجد بيان مسجل لهذه الحركة.'}
                </p>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => {
                  const toDelete = selectedTransaction;
                  setSelectedTransaction(null);
                  handleDeleteTransaction(toDelete.id, toDelete.description, toDelete.amount);
                }}
                className="px-3 py-1.5 border border-red-200 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف الحركة</span>
              </button>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="px-4 py-1.5 border rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال الطباعة وتصدير PDF لسجل الحركات */}
      <PrintableReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="كشف الحركات والمعاملات المالية"
        subtitle="سجل حركات الخزينة والإيرادات والمصروفات"
        dateRange={dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined}
        metaItems={[
          { label: 'إجمالي السجلات', value: `${transactions.length} حركة معروضة` },
          { label: 'إجمالي الإيرادات', value: `+${pageStats.income.toLocaleString('ar-EG')} ج.م` },
          { label: 'إجمالي المصروفات', value: `-${pageStats.expense.toLocaleString('ar-EG')} ج.م` },
          { label: 'الصافي', value: `${pageStats.net >= 0 ? '+' : ''}${pageStats.net.toLocaleString('ar-EG')} ج.م` },
        ]}
        sections={[
          {
            title: 'جدول الحركات المالية',
            columns: [
              {
                header: 'التاريخ',
                render: (r) => new Date(r.created_at).toLocaleDateString('ar-EG'),
              },
              {
                header: 'النوع والتصنيف',
                render: (r) => (
                  <span>
                    {TRANSACTION_TYPE_LABELS[toTransactionType(r.type)]} - {EXPENSE_GROUP_LABELS[r.category] || r.category || 'عام'}
                  </span>
                ),
              },
              {
                header: 'المبلغ',
                align: 'left',
                render: (r) => (
                  <span dir="ltr" className="font-bold">
                    {r.type === 'income' ? '+' : '-'}
                    {Number(r.amount || 0).toLocaleString('ar-EG')} ج.م
                  </span>
                ),
              },
              {
                header: 'البيان',
                key: 'description',
              },
              {
                header: 'العيادة',
                render: (r) => r.clinics?.name || 'المركز العام',
              },
              {
                header: 'المستفيد',
                render: (r) =>
                  r.beneficiary
                    ? `${r.beneficiary.first_name || ''} ${r.beneficiary.last_name || ''}`.trim()
                    : '—',
              },
            ],
            data: displayTransactions,
          },
        ]}
      />
    </div>
  );
}
