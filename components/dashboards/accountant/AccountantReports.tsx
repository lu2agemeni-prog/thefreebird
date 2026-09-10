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
import { BarChart as BarChartIcon, Search, Loader2, Printer, Calendar } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function AccountantReports() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // فلتر نطاق زمني — افتراضيًا آخر 30 يوم
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toDateInputValue(d);
  });
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));

  useEffect(() => {
    fetchTransactions();

    // تحديث Realtime — كانت التقارير المالية بتتحدث يدويًا فقط رغم إن
    // التطبيق بيستخدم Realtime في 5 ملفات تانية لطابور النداء
    const channel = supabase
      .channel('accountant_reports_transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    // ملحوظة: كان الاستعلام القديم user:user_id(profiles(first_name, last_name))
    // خطأ — transactions.user_id بيشاور مباشرة على profiles.id، مفيش جدول
    // وسيط اسمه profiles تاني جوه العلاقة، فكانت t.user.profiles دايمًا
    // undefined وكل الحركات بتتعرض باسم "المركز" حتى لو ليها مستخدم فعلي.
    const { data } = await supabase
      .from('transactions')
      .select('*, user:user_id(first_name, last_name)')
      .order('created_at', { ascending: false });

    if (data) setTransactions(data);
    setLoading(false);
  };

  const filteredTransactions = useMemo(() => {
    const fromTime = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null;
    const toTime = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;

    return transactions.filter(t => {
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesSearch =
        (t.category && t.category.toLowerCase().includes(search.toLowerCase())) ||
        (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
        (t.user && `${t.user.first_name || ''} ${t.user.last_name || ''}`.toLowerCase().includes(search.toLowerCase()));

      const created = new Date(t.created_at).getTime();
      const matchesDate = (!fromTime || created >= fromTime) && (!toTime || created <= toTime);

      return matchesType && (search ? matchesSearch : true) && matchesDate;
    });
  }, [transactions, typeFilter, search, dateFrom, dateTo]);

  // تجميع الإيرادات/المصروفات يوميًا للرسم البياني ضمن النطاق الزمني المختار
  const chartData = useMemo(() => {
    const byDay = new Map<string, { date: string; income: number; expense: number }>();
    filteredTransactions.forEach(t => {
      const day = new Date(t.created_at).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { date: day, income: 0, expense: 0 });
      const row = byDay.get(day)!;
      if (t.type === 'income') row.income += Number(t.amount || 0);
      else row.expense += Number(t.amount || 0); // expense + salary
    });
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions]);

  const totals = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = filteredTransactions.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <BarChartIcon className="w-8 h-8 text-emerald-600" />
          <h2 className="text-3xl font-bold text-gray-800">التقارير التحليلية</h2>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 font-bold px-4 py-2.5 rounded-xl hover:bg-gray-50 shadow-sm"
        >
          <Printer className="w-5 h-5" />
          تصدير PDF (طباعة)
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-2 print:hidden">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="بحث في التصنيف، البيان، أو اسم المستفيد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-10 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full md:w-1/4 border rounded-xl p-3 bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">جميع الحركات</option>
          <option value="income">إيرادات فقط</option>
          <option value="expense">مصروفات فقط</option>
          <option value="salary">رواتب ومستحقات أطباء</option>
        </select>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6 bg-white border rounded-xl p-3 shadow-sm print:hidden">
        <div className="flex items-center gap-2 text-gray-500 text-sm font-bold">
          <Calendar className="w-4 h-4" /> النطاق الزمني
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="text-gray-400 text-sm">إلى</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-t-4 border-t-emerald-500 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-bold text-gray-500 mb-1">إجمالي الإيرادات (النطاق المحدد)</p>
            <p className="text-2xl font-black text-emerald-600" dir="ltr">+{totals.income.toLocaleString()} EGP</p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-red-500 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-bold text-gray-500 mb-1">إجمالي المصروفات (النطاق المحدد)</p>
            <p className="text-2xl font-black text-red-600" dir="ltr">-{totals.expense.toLocaleString()} EGP</p>
          </CardContent>
        </Card>
        <Card className={`border-t-4 shadow-sm ${totals.net >= 0 ? 'border-t-blue-500' : 'border-t-orange-500'}`}>
          <CardContent className="p-5">
            <p className="text-xs font-bold text-gray-500 mb-1">صافي الربح / الخسارة</p>
            <p className={`text-2xl font-black ${totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} dir="ltr">
              {totals.net.toLocaleString()} EGP
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-gray-700 mb-4">الإيرادات والمصروفات اليومية</h3>
          {chartData.length === 0 ? (
            <p className="text-center text-gray-400 py-10">لا توجد بيانات كافية لرسم بياني ضمن النطاق المحدد</p>
          ) : (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => `${Number(value ?? 0).toLocaleString()} EGP`} />
                  <Legend formatter={(value) => (value === 'income' ? 'إيرادات' : 'مصروفات')} />
                  <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-bold">لا توجد حركات مالية مطابقة للبحث</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                    <th className="p-4 font-semibold text-gray-600">النوع</th>
                    <th className="p-4 font-semibold text-gray-600">التصنيف</th>
                    <th className="p-4 font-semibold text-gray-600">البيان</th>
                    <th className="p-4 font-semibold text-gray-600">المستفيد</th>
                    <th className="p-4 font-semibold text-gray-600 text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(t => (
                    <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600 text-sm" dir="ltr">
                        {new Date(t.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4">
                        {t.type === 'income' && <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold">إيراد</span>}
                        {t.type === 'expense' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">مصروف</span>}
                        {t.type === 'salary' && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">راتب طبيب</span>}
                      </td>
                      <td className="p-4 font-bold text-gray-800">{t.category}</td>
                      <td className="p-4 text-gray-600">{t.description || '---'}</td>
                      <td className="p-4 text-gray-600 font-medium">
                        {t.user ? `${t.user.first_name} ${t.user.last_name}` : 'المركز'}
                      </td>
                      <td className={`p-4 text-left font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`} dir="ltr">
                        {t.type === 'income' ? '+' : '-'}{t.amount} EGP
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
