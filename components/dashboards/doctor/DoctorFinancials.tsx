'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Calculator, ArrowDownCircle, Loader2 } from 'lucide-react';

export function DoctorFinancials() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalIncome, setTotalIncome] = useState(0);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setTransactions(data);
      const total = data.reduce((sum, t) => sum + Number(t.amount), 0);
      setTotalIncome(total);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الحسابات والرواتب</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-emerald-600 text-white shadow-lg border-0 md:col-span-1">
          <CardContent className="p-6">
            <h3 className="text-emerald-100 font-bold mb-2">إجمالي المستحقات (هذا الشهر)</h3>
            <div className="text-4xl font-black" dir="ltr">{totalIncome.toLocaleString()} EGP</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-700">سجل المعاملات والمستحقات</h3>
          </div>
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              لا توجد معاملات مالية مسجلة بعد.
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
                  {transactions.map(t => (
                    <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600" dir="ltr">
                        {new Date(t.created_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded w-fit">
                          <ArrowDownCircle className="w-4 h-4" /> مستحق / راتب
                        </span>
                      </td>
                      <td className="p-4 text-gray-800">{t.description || t.category}</td>
                      <td className="p-4 text-left font-bold text-emerald-600" dir="ltr">
                        +{t.amount} EGP
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
