'use client';

// ============================================================================
// components/dashboards/manager/tabs/FinancialsTab.tsx
// تبويب "الماليات والأرباح" — مستخرج من ManagerDashboard.tsx، وبقى بيستخدم
// /api/manager/transactions بترقيم حقيقي بدل سحب 2000 صف وتقطيعهم بالمتصفح.
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { authFetchJson } from '@/lib/api-client';
import { toTransactionType, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from '@/lib/types';

const PAGE_SIZE = 10;

export function FinancialsTab() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(0);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search.trim()) params.set('q', search.trim());
    if (typeFilter) params.set('type', typeFilter);
    const { data, error } = await authFetchJson(`/api/manager/transactions?${params.toString()}`);
    if (error) setError(error);
    else {
      setTransactions(data.rows || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [page, search, typeFilter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { setPage(0); }, [search, typeFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>الماليات والأرباح</CardTitle>
        <CardDescription>سجل الإيرادات والمصروفات الخاصة بالمركز</CardDescription>
        <div className="mt-3 flex flex-col md:flex-row gap-3 max-w-2xl">
          <div className="flex-1">
            <SearchInput value={search} onValueChange={setSearch} placeholder="ابحث بالوصف أو التصنيف..." />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded-xl p-2.5 text-sm bg-white"
          >
            <option value="">جميع الحركات</option>
            <option value="income">إيرادات فقط</option>
            <option value="expense">مصروفات فقط</option>
            <option value="salary">رواتب ومستحقات أطباء</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {error && <ErrorState message={error} onRetry={fetchTransactions} compact />}
        {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                  <th className="p-4 font-semibold text-gray-600">النوع</th>
                  <th className="p-4 font-semibold text-gray-600">التصنيف</th>
                  <th className="p-4 font-semibold text-gray-600">المبلغ</th>
                  <th className="p-4 font-semibold text-gray-600">البيان</th>
                  <th className="p-4 font-semibold text-gray-600">بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${TRANSACTION_TYPE_COLORS[toTransactionType(t.type)]}`}>
                        {TRANSACTION_TYPE_LABELS[toTransactionType(t.type)]}
                      </span>
                    </td>
                    <td className="p-4">{t.category}</td>
                    <td className="p-4 font-bold" dir="ltr">{t.amount} EGP</td>
                    <td className="p-4 text-gray-600">{t.description}</td>
                    <td className="p-4 text-sm">{t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : 'غير محدد'}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">لا توجد حركات مالية مطابقة</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} isLoading={loading} />}
      </CardContent>
    </Card>
  );
}
