'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Loader2, Calendar } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { getFinancialMonthBounds, getPreviousFinancialMonthBounds } from '@/lib/financialMonth';

type PeriodMode = 'currentFin' | 'prevFin' | 'all';

export function AccountantOverview() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState({ income: 0, expense: 0, net: 0, count: 0 });
  const [periodMode, setPeriodMode] = useState<PeriodMode>('currentFin');

  const currentFin = getFinancialMonthBounds();
  const prevFin = getPreviousFinancialMonthBounds();

  const getActivePeriodBounds = () => {
    if (periodMode === 'currentFin') return currentFin;
    if (periodMode === 'prevFin') return prevFin;
    return null;
  };

  useEffect(() => {
    const t = setTimeout(fetchStats, 0);
    return () => clearTimeout(t);
  }, [periodMode]);

  async function fetchStats() {
    setLoadError(null);
    setLoading(true);

    let query = supabase.from('transactions').select('amount, type, created_at');
    const bounds = getActivePeriodBounds();
    if (bounds) {
      query = query.gte('created_at', `${bounds.startStr}T00:00:00`).lte('created_at', `${bounds.endStr}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل الملخص المالي.'));
      setStats({ income: 0, expense: 0, net: 0, count: 0 });
    } else if (data) {
      let income = 0;
      let expense = 0;
      data.forEach(t => {
        if (t.type === 'income') income += Number(t.amount || 0);
        else expense += Number(t.amount || 0); // includes 'expense' and 'salary'
      });

      setStats({
        income,
        expense,
        net: income - expense,
        count: data.length,
      });
    }
    setLoading(false);
  }

  const activeBounds = getActivePeriodBounds();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Calculator className="w-8 h-8 text-emerald-600" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">الملخص المالي</h2>
            <p className="text-xs text-gray-500 mt-0.5">الشهر المالي للعيادات يبدأ من يوم 21 وينتهي في 20 من الشهر التالي</p>
          </div>
        </div>

        {/* أزرار اختيار الفترة المالية */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-xl border shadow-sm">
          <button
            onClick={() => setPeriodMode('currentFin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              periodMode === 'currentFin'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            الشهر المالي الحالي (21 - 20)
          </button>
          <button
            onClick={() => setPeriodMode('prevFin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              periodMode === 'prevFin'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            الشهر المالي السابق (21 - 20)
          </button>
          <button
            onClick={() => setPeriodMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              periodMode === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            كل الفترات
          </button>
        </div>
      </div>

      {activeBounds && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-bold">
          <Calendar className="w-4 h-4 shrink-0" />
          <span>الفترة المحتسبة: من {activeBounds.startStr} وحتى {activeBounds.endStr} (إجمالي القيود: {stats.count})</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={fetchStats} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-t-4 border-t-emerald-500 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-bold text-gray-500 mb-2">إجمالي الإيرادات</p>
              <p className="text-4xl font-black text-emerald-600" dir="ltr">+{stats.income.toLocaleString('ar-EG')} <span className="text-lg">ج.م</span></p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-red-500 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-bold text-gray-500 mb-2">إجمالي المصروفات والأجور</p>
              <p className="text-4xl font-black text-red-600" dir="ltr">-{stats.expense.toLocaleString('ar-EG')} <span className="text-lg">ج.م</span></p>
            </CardContent>
          </Card>

          <Card className={`border-t-4 shadow-sm ${stats.net >= 0 ? 'border-t-blue-500' : 'border-t-orange-500'}`}>
            <CardContent className="p-6">
              <p className="text-sm font-bold text-gray-500 mb-2">صافي الفائض / العجز</p>
              <p className={`text-4xl font-black ${stats.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`} dir="ltr">
                {stats.net.toLocaleString('ar-EG')} <span className="text-lg">ج.م</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ملاحظة مهمة</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 leading-relaxed text-sm">
            هذه الأرقام تمثل الحركات المالية المسجلة على النظام خلال الفترة المحددة وفق الشهر المالي للعيادات (من 21 إلى 20).
            الإيرادات تشمل كافة متحصلات الكشوفات والخدمات والتحاليل، بينما المصروفات تشمل النفقات التشغيلية بالإضافة لرواتب ومستحقات وسلف الأطباء والموظفين.
            للاطلاع على السجل التفصيلي أو تسجيل مصروف جديد، يرجى الانتقال إلى تبويب &quot;المصروفات والمستهلكات&quot;.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
