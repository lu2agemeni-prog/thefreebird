'use client';

// ============================================================================
// components/dashboards/manager/tabs/FinancialsTab.tsx
// تبويب "الماليات والأرباح" — يعرض سجل الحركات مع فلترة ذكية، وتصدير إكسيل (.xlsx)
// وطباعة PDF، ومودال تفاصيل عند النقر على أي حركة، مع تبويب تقرير الأرباح المفصل.
// ============================================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download,
  Printer,
  X,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  Wallet,
  Clock,
  User,
  Tag,
  FileText,
  Filter,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { authFetchJson } from '@/lib/api-client';
import { toTransactionType, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from '@/lib/types';
import { getFinancialMonthBounds, getPreviousFinancialMonthBounds } from '@/lib/financialMonth';
import { exportRowsToExcel } from '@/lib/export-excel';
import { PrintableReportModal } from '@/components/ui/printable-report-modal';
import { ProfitReportPanel } from './ProfitReportPanel';

const PAGE_SIZE = 15;

const EXPENSE_GROUP_LABELS: Record<string, string> = {
  rent_utilities: 'المصروفات العامة والإيجار',
  consumables: 'المستهلكات والمستلزمات',
  wages: 'الأجور والرواتب',
  equipment_maintenance: 'الأجهزة والصيانة والانتقالات',
  misc: 'نثريات ومصروفات أخرى',
};

export function FinancialsTab() {
  const [view, setView] = useState<'list' | 'profit_report'>('list');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // الفلاتر
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expenseGroupFilter, setExpenseGroupFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(() => getFinancialMonthBounds().startStr);
  const [dateTo, setDateTo] = useState(() => getFinancialMonthBounds().endStr);
  const [page, setPage] = useState(0);

  // المودالات
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search.trim()) params.set('q', search.trim());
    if (typeFilter) params.set('type', typeFilter);
    if (expenseGroupFilter) params.set('expenseGroup', expenseGroupFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    const { data, error } = await authFetchJson(`/api/manager/transactions?${params.toString()}`);
    if (error) setError(error);
    else {
      setTransactions(data.rows || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [page, search, typeFilter, expenseGroupFilter, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(fetchTransactions, 0);
    return () => clearTimeout(t);
  }, [fetchTransactions]);

  useEffect(() => {
    const t = setTimeout(() => setPage(0), 0);
    return () => clearTimeout(t);
  }, [search, typeFilter, expenseGroupFilter, dateFrom, dateTo]);

  const hasActiveFilters = !!(typeFilter || expenseGroupFilter || dateFrom || dateTo || search);
  const clearFilters = () => {
    setTypeFilter('');
    setExpenseGroupFilter('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  // إحصائيات الصفحة الحالية المعروضة
  const pageStats = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = transactions
      .filter((t) => t.type !== 'income')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [transactions]);

  // تصدير إكسيل
  const handleExportExcel = () => {
    if (transactions.length === 0) return;
    const rows = transactions.map((t, idx) => ({
      'م': idx + 1,
      'رقم الحركة': t.id ? t.id.slice(0, 8) : '',
      'التاريخ': new Date(t.created_at).toLocaleDateString('ar-EG'),
      'الوقت': new Date(t.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      'النوع': t.type === 'income' ? 'إيراد' : t.type === 'salary' ? 'راتب/مستحق' : 'مصروف',
      'التصنيف': EXPENSE_GROUP_LABELS[t.category] || t.category || 'عام',
      'المبلغ (ج.م)': Number(t.amount || 0),
      'البيان': t.description || '—',
      'العيادة': t.clinics?.name || 'غير محدد',
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
      {/* التبديل بين سجل الحركات وتقرير الأرباح */}
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
            سجل الحركات اليومية
          </button>
          <button
            onClick={() => setView('profit_report')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              view === 'profit_report'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            تقرير الأرباح والموقف المالي المفصل
          </button>
        </div>

        {view === 'list' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={transactions.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تصدير إكسيل (.xlsx)</span>
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

      {view === 'profit_report' ? (
        <ProfitReportPanel />
      ) : (
        <Card className="border border-gray-200/80 shadow-xs">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  <span>سجل الحركات والمعاملات المالية</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  كافة المقبوضات والمصروفات المسجلة بالخزينة والحسابات ({total} حركة مسجلة)
                </CardDescription>
              </div>
            </div>

            {/* أزرار الشهر المالي والفترات السريعة */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 pb-1 border-y border-gray-100">
              <span className="text-xs font-bold text-gray-500 ml-1">الشهر المالي:</span>
              <button
                type="button"
                onClick={() => {
                  const fin = getFinancialMonthBounds();
                  setDateFrom(fin.startStr);
                  setDateTo(fin.endStr);
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors cursor-pointer"
              >
                الشهر الحالي (21 - 20)
              </button>
              <button
                type="button"
                onClick={() => {
                  const prev = getPreviousFinancialMonthBounds();
                  setDateFrom(prev.startStr);
                  setDateTo(prev.endStr);
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                الشهر السابق (21 - 20)
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date().toISOString().slice(0, 10);
                  setDateFrom(now);
                  setDateTo(now);
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                كل الأوقات
              </button>
            </div>

            {/* شريط الفلاتر والبحث */}
            <div className="flex flex-col md:flex-row gap-2.5 flex-wrap items-stretch md:items-center">
              <div className="flex-1 min-w-[220px]">
                <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث بالوصف أو التصنيف أو المستفيد..." />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-xl p-2 text-xs bg-white text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">جميع أنواع الحركات</option>
                <option value="income">إيرادات فقط</option>
                <option value="expense">مصروفات فقط</option>
                <option value="salary">رواتب ومستحقات أطباء</option>
              </select>
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
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>من:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border border-gray-300 rounded-xl p-2 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <span>إلى:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border border-gray-300 rounded-xl p-2 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-600 font-bold hover:underline px-2 cursor-pointer"
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
                      <th className="p-3 font-bold">التاريخ والوقت</th>
                      <th className="p-3 font-bold">النوع والتصنيف</th>
                      <th className="p-3 font-bold">المبلغ</th>
                      <th className="p-3 font-bold">البيان / الوصف</th>
                      <th className="p-3 font-bold">العيادة</th>
                      <th className="p-3 font-bold">المستفيد / الطبيب</th>
                      <th className="p-3 font-bold">المسؤول</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((t, idx) => (
                      <tr
                        key={t.id || idx}
                        onClick={() => setSelectedTransaction(t)}
                        className="hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                        title="انقر لعرض تفاصيل الحركة المالية الكاملة"
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
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {t.beneficiary ? (
                            <span className="text-amber-800 font-bold">
                              {t.beneficiary.first_name} {t.beneficiary.last_name}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap text-gray-500 text-[11px]">
                          {t.profiles
                            ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}`.trim()
                            : 'النظام'}
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
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

      {/* مودال تفاصيل المعاملة عند النقر عليها */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                    selectedTransaction.type === 'income'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {selectedTransaction.type === 'income' ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">تفاصيل المعاملة المالية</h3>
                  <p className="text-[11px] text-gray-400 font-mono">
                    معرف الحركة: {selectedTransaction.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">المبلغ المالي</p>
                <p
                  className={`text-3xl font-black ${
                    selectedTransaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                  }`}
                  dir="ltr"
                >
                  {selectedTransaction.type === 'income' ? '+' : '-'}
                  {Number(selectedTransaction.amount || 0).toLocaleString('ar-EG')} ج.م
                </p>
                <span
                  className={`inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-bold ${
                    TRANSACTION_TYPE_COLORS[toTransactionType(selectedTransaction.type)]
                  }`}
                >
                  {TRANSACTION_TYPE_LABELS[toTransactionType(selectedTransaction.type)]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border rounded-xl p-3 space-y-1">
                  <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-gray-400" /> التاريخ والوقت
                  </span>
                  <p className="font-bold text-gray-800">
                    {new Date(selectedTransaction.created_at).toLocaleDateString('ar-EG')}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono">
                    {new Date(selectedTransaction.created_at).toLocaleTimeString('ar-EG')}
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

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
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
                render: (r) => r.clinics?.name || 'عام',
              },
              {
                header: 'المستفيد',
                render: (r) =>
                  r.beneficiary
                    ? `${r.beneficiary.first_name || ''} ${r.beneficiary.last_name || ''}`.trim()
                    : '—',
              },
            ],
            data: transactions,
          },
        ]}
      />
    </div>
  );
}
