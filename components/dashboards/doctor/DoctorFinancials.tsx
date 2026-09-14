'use client';

// ============================================================================
// components/dashboards/doctor/DoctorFinancials.tsx
// "الحسابات" عند الطبيب — بيان تفصيلي بكل كشف حصّله، حالة الدفع (مدفوع
// ضمن تسديد / لسه معلّق) لكل كشف، فلترة بالتاريخ وحالة الدفع، + سجل
// التسديدات (المبالغ الفعلية اللي اتصرفت له) مع ترقيم صفحات.
// ============================================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Calculator, Wallet, Calendar, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { getFriendlyErrorMessage } from '@/lib/errors';

const PAGE_SIZE = 10;

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DoctorFinancials() {
  const { user } = useAuth();
  const [checkups, setCheckups] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toDateInputValue(d);
  });
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [page, setPage] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    setLoading(true);

    const [queueRes, settlementsRes] = await Promise.all([
      supabase.from('call_queue')
        .select('id, patient_name, paid_amount, status, created_at')
        .eq('doctor_id', user.id)
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false }),
      supabase.from('doctor_settlements')
        .select('*')
        .eq('doctor_id', user.id)
        .order('settled_at', { ascending: false }),
    ]);

    if (queueRes.error) setLoadError(getFriendlyErrorMessage(queueRes.error, 'تعذر تحميل بيان المدفوعات.'));
    else setCheckups(queueRes.data || []);

    setSettlements(settlementsRes.data || []);
    setLoading(false);
  }, [user, dateFrom, dateTo]);

  useEffect(() => { const t = setTimeout(fetchData, 0); return () => clearTimeout(t); }, [fetchData]);
  useEffect(() => { const t = setTimeout(() => setPage(0), 0); return () => clearTimeout(t); }, [statusFilter, dateFrom, dateTo]);

  const isDateSettled = useMemo(() => {
    return (dateStr: string) => settlements.some(s => dateStr >= s.period_start && dateStr <= s.period_end);
  }, [settlements]);

  const rows = useMemo(() => checkups.map(c => {
    const dateStr = toDateInputValue(new Date(c.created_at));
    return { ...c, paid: isDateSettled(dateStr) };
  }), [checkups, isDateSettled]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter(r => (statusFilter === 'paid' ? r.paid : !r.paid));
  }, [rows, statusFilter]);

  const totals = useMemo(() => {
    const collected = rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const paid = rows.filter(r => r.paid).reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const unpaid = collected - paid;
    return { collected, paid, unpaid };
  }, [rows]);

  const totalSettled = settlements.reduce((s, r) => s + Number(r.doctor_share_amount || 0), 0);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filteredRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (loading && checkups.length === 0) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }
  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الحسابات والمستحقات</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5"><p className="text-xs text-gray-500 mb-1">إجمالي المحصّل (النطاق المحدد)</p><p className="text-xl font-black text-gray-800" dir="ltr">{totals.collected.toLocaleString()} ج.م</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-gray-500 mb-1">مدفوع لك بالفعل</p><p className="text-xl font-black text-emerald-600" dir="ltr">{totals.paid.toLocaleString()} ج.م</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-gray-500 mb-1">لسه معلّق (لم يُسدد)</p><p className="text-xl font-black text-orange-600" dir="ltr">{totals.unpaid.toLocaleString()} ج.م</p></CardContent></Card>
        <Card className="bg-emerald-600 text-white border-0"><CardContent className="p-5"><p className="text-xs text-emerald-100 mb-1 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> إجمالي ما استلمته (كل الأوقات)</p><p className="text-xl font-black" dir="ltr">{totalSettled.toLocaleString()} ج.م</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-bold">
            <Calendar className="w-4 h-4" /> من
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded-lg p-2 text-sm" />
          <span className="text-gray-400 text-sm">إلى</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded-lg p-2 text-sm" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="border rounded-lg p-2 text-sm bg-white md:mr-auto">
            <option value="all">كل الحالات</option>
            <option value="paid">مدفوع فقط</option>
            <option value="unpaid">غير مدفوع فقط</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 bg-gray-50 border-b">
            <h3 className="font-bold text-gray-700">بيان المدفوعات — تفصيل كل كشف</h3>
          </div>
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">لا توجد كشوفات ضمن النطاق والفلتر المحددين.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-white border-b">
                    <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                    <th className="p-4 font-semibold text-gray-600">المريض</th>
                    <th className="p-4 font-semibold text-gray-600">المبلغ المحصّل</th>
                    <th className="p-4 font-semibold text-gray-600">حالة الدفع</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(r => (
                    <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600" dir="ltr">{new Date(r.created_at).toLocaleString('ar-EG')}</td>
                      <td className="p-4 font-bold text-gray-800">{r.patient_name}</td>
                      <td className="p-4 font-bold" dir="ltr">{r.paid_amount || 0} ج.م</td>
                      <td className="p-4">
                        {r.paid ? (
                          <span className="flex items-center gap-1 w-fit text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" /> مدفوع</span>
                        ) : (
                          <span className="flex items-center gap-1 w-fit text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full"><Clock className="w-3.5 h-3.5" /> غير مدفوع</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-4 border-t">
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredRows.length} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      {settlements.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="font-bold text-gray-700">سجل التسديدات المستلمة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="bg-white border-b">
                    <th className="p-3 font-semibold text-gray-600">تاريخ التسديد</th>
                    <th className="p-3 font-semibold text-gray-600">الفترة</th>
                    <th className="p-3 font-semibold text-gray-600">عدد الكشوفات</th>
                    <th className="p-3 font-semibold text-gray-600">المبلغ المستلم</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map(s => (
                    <tr key={s.id} className="border-b">
                      <td className="p-3 text-gray-500">{new Date(s.settled_at).toLocaleDateString('ar-EG')}</td>
                      <td className="p-3">{s.period_start} → {s.period_end}</td>
                      <td className="p-3">{s.checkups_count}</td>
                      <td className="p-3 font-bold text-emerald-600" dir="ltr">{s.doctor_share_amount} ج.م {s.share_percent !== null && `(${s.share_percent}%)`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
