'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Loader2 } from 'lucide-react';

export function AccountantOverview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ income: 0, expense: 0, net: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    const { data } = await supabase.from('transactions').select('amount, type');
    
    if (data) {
      let income = 0;
      let expense = 0;
      data.forEach(t => {
        if (t.type === 'income') income += Number(t.amount);
        else expense += Number(t.amount); // includes 'expense' and 'salary'
      });
      
      setStats({
        income,
        expense,
        net: income - expense
      });
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الملخص المالي</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-t-4 border-t-emerald-500 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm font-bold text-gray-500 mb-2">إجمالي الإيرادات</p>
            <p className="text-4xl font-black text-emerald-600" dir="ltr">+{stats.income.toLocaleString()} <span className="text-lg">EGP</span></p>
          </CardContent>
        </Card>
        
        <Card className="border-t-4 border-t-red-500 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm font-bold text-gray-500 mb-2">إجمالي المصروفات</p>
            <p className="text-4xl font-black text-red-600" dir="ltr">-{stats.expense.toLocaleString()} <span className="text-lg">EGP</span></p>
          </CardContent>
        </Card>
        
        <Card className={`border-t-4 shadow-sm ${stats.net >= 0 ? 'border-t-blue-500' : 'border-t-orange-500'}`}>
          <CardContent className="p-6">
            <p className="text-sm font-bold text-gray-500 mb-2">صافي الربح / الخسارة</p>
            <p className={`text-4xl font-black ${stats.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} dir="ltr">
              {stats.net.toLocaleString()} <span className="text-lg">EGP</span>
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>ملاحظة هامة</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 leading-relaxed">
            هذه الأرقام تمثل إجمالي الحركات المالية المسجلة على النظام (الإيرادات تمثل كل المدخولات المسجلة، بينما المصروفات تشمل النفقات التشغيلية بالإضافة لرواتب ومستحقات الأطباء والموظفين).
            للاطلاع على السجل التفصيلي أو تسجيل مصروف جديد، يرجى الانتقال إلى تبويب "المصروفات والمستهلكات".
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
