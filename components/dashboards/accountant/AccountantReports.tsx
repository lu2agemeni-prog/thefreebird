'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Search, Loader2 } from 'lucide-react';

export function AccountantReports() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*, user:user_id(profiles(first_name, last_name))')
      .order('created_at', { ascending: false });
    
    if (data) setTransactions(data);
    setLoading(false);
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesSearch = 
      (t.category && t.category.toLowerCase().includes(search.toLowerCase())) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
      (t.user?.profiles?.first_name && (t.user.profiles.first_name + ' ' + t.user.profiles.last_name).includes(search));
    
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <BarChart className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">التقارير التحليلية</h2>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
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
                        {t.user?.profiles ? `${t.user.profiles.first_name} ${t.user.profiles.last_name}` : 'المركز'}
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
