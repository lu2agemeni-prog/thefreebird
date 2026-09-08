'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Calculator, ArrowDownCircle, ArrowUpCircle, Wallet, Loader2, Search } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { toTransactionType, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from '@/lib/types';

const FETCH_CAP = 2000;
const PAGE_SIZE = 10;

export function DoctorFinancials() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalIncome, setTotalIncome] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP);

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل سجل المعاملات المالية.'));
      setTransactions([]);
    } else {
      setTransactions(data || []);
      // الإجمالي الكلي لكل المعاملات
      const total = (data || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
      setTotalIncome(total);
      // إجمالي هذا الشهر فقط — كان الكود السابق يجمع الكل رغم أن العنوان "هذا الشهر"
      const now = new Date();
      const monthTotal = (data || [])
        .filter(t => {
          const d = new Date(t.created_at);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      setMonthIncome(monthTotal);
    }
    setLoading(false);
  };

  // بحث بالوصف/النوع + ترقيم صفحات من جهة العميل
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t =>
      String(t.description || '').toLowerCase().includes(q) ||
      String(t.category || '').toLowerCase().includes(q) ||
      TRANSACTION_TYPE_LABELS[toTransactionType(t.type)].toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }
  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchTransactions} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الحسابات والرواتب</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-emerald-600 text-white shadow-lg border-0 md:col-span-1">
          <CardContent className="p-6">
            <h3 className="text-emerald-100 font-bold mb-2 flex items-center gap-2">
              <Wallet className="w-5 h-5" /> إجمالي المستحقات (هذا الشهر)
            </h3>
            <div className="text-4xl font-black" dir="ltr">{monthIncome.toLocaleString()} EGP</div>
            <p className="text-emerald-100 text-xs mt-2">مجموع معاملات {new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })} فقط</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <h3 className="text-gray-500 font-bold mb-2 text-sm">الإجمالي التاريخي لكل المعاملات</h3>
            <div className="text-3xl font-black text-gray-800" dir="ltr">{totalIncome.toLocaleString()} EGP</div>
            <p className="text-gray-400 text-xs mt-2">{transactions.length} معاملة مسجلة</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 bg-gray-50 border-b flex flex-wrap justify-between items-center gap-3">
            <h3 className="font-bold text-gray-700">سجل المعاملات والمستحقات</h3>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث في المعاملات…"
                className="border rounded-lg py-2 pr-4 pl-10 text-sm w-56 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {transactions.length === 0
                ? 'لا توجد معاملات مالية مسجلة بعد.'
                : 'لا توجد نتائج مطابقة للبحث.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-white border-b">
                    <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                    <th className="p-4 font-semibold text-gray-600">النوع</th>
                    <th className="p-4 font-semibold text-gray-600">البيان</th>
                    <th className="p-4 font-semibold text-gray-600 text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(t => {
                    const type = toTransactionType(t.type);
                    const isExpense = type === 'expense';
                    return (
                      <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-gray-600" dir="ltr">
                          {new Date(t.created_at).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="p-4">
                          <span className={`flex items-center gap-1 font-bold px-2 py-1 rounded w-fit ${TRANSACTION_TYPE_COLORS[type]}`}>
                            {isExpense ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                            {TRANSACTION_TYPE_LABELS[type]}
                          </span>
                        </td>
                        <td className="p-4 text-gray-800">{t.description || t.category}</td>
                        <td className={`p-4 text-left font-bold ${isExpense ? 'text-red-600' : 'text-emerald-600'}`} dir="ltr">
                          {isExpense ? '-' : '+'}{Number(t.amount).toLocaleString()} EGP
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-4 border-t">
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
