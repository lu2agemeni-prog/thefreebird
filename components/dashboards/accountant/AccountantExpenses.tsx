'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Plus, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

export function AccountantExpenses() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setTransactions(data);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;
    
    setAdding(true);
    const { error } = await supabase.from('transactions').insert([{
      amount: Number(amount),
      type,
      category,
      description,
      // Since it's a general clinic expense/income, we might not attach a user_id unless it's a doctor's salary
    }]);

    setAdding(false);
    if (!error) {
      setAmount('');
      setCategory('');
      setDescription('');
      fetchTransactions();
      alert('تم تسجيل المعاملة بنجاح.');
    } else {
      alert("حدث خطأ أثناء تسجيل المعاملة.");
    }
  };

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
                  onChange={(e) => setType(e.target.value)} 
                  className="w-full border rounded-lg p-3 bg-white"
                >
                  <option value="income">إيراد (+)</option>
                  <option value="expense">مصروف (-)</option>
                  <option value="salary">راتب طبيب (-)</option>
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
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-700">سجل المعاملات الأخيرة</h3>
          </div>
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">لا توجد معاملات مسجلة بعد.</div>
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
                  {transactions.slice(0, 50).map(t => (
                    <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600" dir="ltr">
                        {new Date(t.created_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="p-4">
                        {t.type === 'income' ? (
                          <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded w-fit">
                            <ArrowUpCircle className="w-4 h-4" /> إيراد
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-700 font-bold bg-red-50 px-2 py-1 rounded w-fit">
                            <ArrowDownCircle className="w-4 h-4" /> {t.type === 'salary' ? 'راتب' : 'مصروف'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-gray-800">{t.category}</td>
                      <td className="p-4 text-gray-600">{t.description || '---'}</td>
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
