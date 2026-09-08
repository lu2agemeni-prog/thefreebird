'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Plus, Loader2, ArrowUpCircle, ArrowDownCircle, Search, CheckCircle2 } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { toTransactionType, TransactionType, TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from '@/lib/types';

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
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addedOk, setAddedOk] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => { setPage(0); }, [search]);

  const fetchTransactions = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP);

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل سجل المعاملات.'));
      setTransactions([]);
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddedOk(null);
    if (!amount || !category) {
      setAddError('يرجى إدخال المبلغ والتصنيف.');
      return;
    }
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setAddError('المبلغ يجب أن يكون رقمًا أكبر من صفر.');
      return;
    }

    setAdding(true);
    const { error } = await supabase.from('transactions').insert([{
      amount: amt,
      type,
      category: category.trim(),
      description: description.trim(),
    }]);

    setAdding(false);
    if (!error) {
      setAmount('');
      setCategory('');
      setDescription('');
      fetchTransactions();
      setAddedOk('تم تسجيل المعاملة المالية بنجاح.');
    } else {
      setAddError(getFriendlyErrorMessage(error, 'حدث خطأ أثناء تسجيل المعاملة.'));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t =>
      String(t.category || '').toLowerCase().includes(q) ||
      String(t.description || '').toLowerCase().includes(q) ||
      TRANSACTION_TYPE_LABELS[toTransactionType(t.type)].toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">إدارة الإيرادات والمصروفات</h2>
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
                  {TRANSACTION_TYPES.map(t => (
                    <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>
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
                className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
              >
                {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                تسجيل المعاملة
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 bg-gray-50 border-b flex flex-wrap justify-between items-center gap-3">
            <h3 className="font-bold text-gray-700">سجل المعاملات</h3>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث في التصنيف أو البيان…"
                className="border rounded-lg py-2 pr-4 pl-10 text-sm w-56 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={fetchTransactions} compact />
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {transactions.length === 0 ? 'لا توجد معاملات مسجلة بعد.' : 'لا توجد نتائج مطابقة للبحث.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-white border-b">
                    <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                    <th className="p-4 font-semibold text-gray-600">النوع</th>
                    <th className="p-4 font-semibold text-gray-600">التصنيف</th>
                    <th className="p-4 font-semibold text-gray-600">البيان</th>
                    <th className="p-4 font-semibold text-gray-600 text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(t => {
                    const ttype = toTransactionType(t.type);
                    const isExpense = ttype !== 'income';
                    return (
                      <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-gray-600" dir="ltr">
                          {new Date(t.created_at).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="p-4">
                          <span className={`flex items-center gap-1 font-bold px-2 py-1 rounded w-fit ${TRANSACTION_TYPE_COLORS[ttype]}`}>
                            {isExpense ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                            {TRANSACTION_TYPE_LABELS[ttype]}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-gray-800">{t.category}</td>
                        <td className="p-4 text-gray-600">{t.description || '---'}</td>
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
