'use client';

// ============================================================================
// components/dashboards/manager/tabs/ProfitReportPanel.tsx
// تقرير أرباح مفصّل داخل "الماليات والأرباح" — ربح المركز ككل، وربح كل
// عيادة على حدة بعد خصم مصروفاتها، ومجموع المدفوع لكل طبيب، لنطاق زمني
// محدد. كل الأرقام محسوبة من نفس جدول transactions (بما فيه قيود الأجور
// التلقائية الناتجة عن تسديد حسابات الأطباء).
// ============================================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Printer, Building2, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';

const FETCH_CAP = 5000;
const UNASSIGNED_KEY = '__unassigned__';

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ProfitReportPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toDateInputValue(d);
  });
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('transactions')
      .select('*, clinics(name), profiles(first_name, last_name)')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل بيانات التقرير.'));
    else setRows(data || []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { const t = setTimeout(fetchData, 0); return () => clearTimeout(t); }, [fetchData]);

  const center = useMemo(() => {
    const income = rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = rows.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [rows]);

  const clinicBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; income: number; expense: number }>();
    rows.forEach(t => {
      const key = t.clinic_id || UNASSIGNED_KEY;
      const name = t.clinics?.name || 'غير مخصص لعيادة معينة';
      if (!map.has(key)) map.set(key, { name, income: 0, expense: 0 });
      const row = map.get(key)!;
      if (t.type === 'income') row.income += Number(t.amount || 0);
      else row.expense += Number(t.amount || 0);
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v, net: v.income - v.expense }))
      .sort((a, b) => (a.key === UNASSIGNED_KEY ? 1 : b.key === UNASSIGNED_KEY ? -1 : b.net - a.net));
  }, [rows]);

  const doctorBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; count: number }>();
    rows.filter(t => t.type === 'salary' && t.user_id).forEach(t => {
      const key = t.user_id;
      const name = t.profiles ? `د. ${t.profiles.first_name} ${t.profiles.last_name}` : 'غير معروف';
      if (!map.has(key)) map.set(key, { name, amount: 0, count: 0 });
      const row = map.get(key)!;
      row.amount += Number(t.amount || 0);
      row.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [rows]);

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-bold">
            <Calendar className="w-4 h-4" /> من
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded-lg p-2 text-sm" />
          <span className="text-gray-400 text-sm">إلى</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded-lg p-2 text-sm" />
          <button onClick={() => window.print()} className="md:mr-auto flex items-center gap-2 bg-white border text-gray-700 font-bold px-4 py-2.5 rounded-xl hover:bg-gray-50 text-sm">
            <Printer className="w-4 h-4" /> طباعة
          </button>
        </CardContent>
      </Card>

      {error && <ErrorState message={error} onRetry={fetchData} />}

      {loading ? (
        <p className="text-gray-500 py-6 text-center">جاري تحميل التقرير...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-t-4 border-t-emerald-500">
              <CardContent className="p-5">
                <p className="text-xs font-bold text-gray-500 mb-1">إجمالي الإيرادات (كل العيادات)</p>
                <p className="text-2xl font-black text-emerald-600" dir="ltr">+{center.income.toLocaleString()} ج.م</p>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-red-500">
              <CardContent className="p-5">
                <p className="text-xs font-bold text-gray-500 mb-1">إجمالي المصروفات (مصروفات + مستهلكات + أجور + أخرى)</p>
                <p className="text-2xl font-black text-red-600" dir="ltr">-{center.expense.toLocaleString()} ج.م</p>
              </CardContent>
            </Card>
            <Card className={`border-t-4 ${center.net >= 0 ? 'border-t-blue-500' : 'border-t-orange-500'}`}>
              <CardContent className="p-5">
                <p className="text-xs font-bold text-gray-500 mb-1">صافي ربح المركز ككل</p>
                <p className={`text-2xl font-black ${center.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} dir="ltr">{center.net.toLocaleString()} ج.م</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-5">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-emerald-600" /> ربح كل عيادة على حدة</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="p-3 font-semibold text-gray-600">العيادة</th>
                      <th className="p-3 font-semibold text-gray-600">الإيرادات</th>
                      <th className="p-3 font-semibold text-gray-600">المصروفات</th>
                      <th className="p-3 font-semibold text-gray-600">صافي الربح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinicBreakdown.map(c => (
                      <tr key={c.key} className={`border-b ${c.key === UNASSIGNED_KEY ? 'bg-gray-50 text-gray-500 italic' : ''}`}>
                        <td className="p-3 font-bold">{c.name}</td>
                        <td className="p-3 text-emerald-600" dir="ltr">+{c.income.toLocaleString()}</td>
                        <td className="p-3 text-red-600" dir="ltr">-{c.expense.toLocaleString()}</td>
                        <td className={`p-3 font-bold ${c.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} dir="ltr">{c.net.toLocaleString()}</td>
                      </tr>
                    ))}
                    {clinicBreakdown.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-gray-500">لا توجد حركات مالية ضمن النطاق المحدد</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                &quot;غير مخصص لعيادة معينة&quot;: مصروفات عامة للمركز (إيجار، رواتب غير مرتبطة بعيادة محددة...) بتدخل في ربح المركز ككل لكن مش موزّعة على عيادة بعينها.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><User className="w-5 h-5 text-emerald-600" /> إجمالي المدفوع لكل طبيب (أجور ومستحقات)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="p-3 font-semibold text-gray-600">الطبيب</th>
                      <th className="p-3 font-semibold text-gray-600">عدد الدفعات</th>
                      <th className="p-3 font-semibold text-gray-600">الإجمالي المدفوع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorBreakdown.map(d => (
                      <tr key={d.name} className="border-b">
                        <td className="p-3 font-bold">{d.name}</td>
                        <td className="p-3">{d.count}</td>
                        <td className="p-3 font-bold text-red-600" dir="ltr">{d.amount.toLocaleString()} ج.م</td>
                      </tr>
                    ))}
                    {doctorBreakdown.length === 0 && (
                      <tr><td colSpan={3} className="p-6 text-center text-gray-500">لا توجد مدفوعات لأطباء ضمن النطاق المحدد</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
