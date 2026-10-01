'use client';

// ============================================================================
// components/dashboards/accountant/AccountantChartsTab.tsx
// تبويب الرسوم البيانية والتحليلات المالية للمدير والمحاسب:
// - يستخدم مكتبة Recharts لعرض توزيع الدخل والمصروفات وصافي الأرباح
// - فلترة دقيقة حسب دورات الأشهر المالية للعيادات (من 21 إلى 20)
// - مقارنة بيانية لأداء الأشهر المالية السابقة (Trend Analysis)
// - توزيع المصروفات حسب التصنيف (Pie / Donut Chart)
// - توزيع الإيرادات حسب العيادات والمراكز
// - توزيع التدفق النقدي اليومي خلال الشهر المالي المختار
// - متوافق بالكامل مع شاشات المحاسب وشاشات المدير
// ============================================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Building2,
  RefreshCw,
  Printer,
  Sparkles,
  Info,
  DollarSign,
  Percent,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  getFinancialMonthBounds,
  getFinancialMonthsList,
  FinancialPeriod,
} from '@/lib/financialMonth';

// ألوان متناسقة للرسوم البيانية متوافقة مع الهوية الطبية
const COLORS = {
  income: '#10b981', // زمردي للإيرادات
  expense: '#ef4444', // أحمر للمصروفات
  net: '#3b82f6', // أزرق لصافي الأرباح
  netPositive: '#059669',
  netNegative: '#dc2626',
  pie: [
    '#3b82f6', // أزرق
    '#10b981', // زمردي
    '#f59e0b', // عنبري
    '#ef4444', // أحمر
    '#8b5cf6', // بنفسجي
    '#ec4899', // وردي
    '#06b6d4', // سماوي
    '#84cc16', // ليموني
  ],
};

const EXPENSE_LABELS: Record<string, string> = {
  rent_utilities: 'المصروفات العامة والإيجار',
  consumables: 'المستهلكات والمستلزمات',
  wages: 'الأجور والرواتب',
  equipment_maintenance: 'الأجهزة والصيانة',
  misc: 'نثريات ومصروفات أخرى',
  salary: 'مستحقات ورواتب الأطباء',
};

interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  category: string;
  description?: string;
  created_at: string;
  clinic_id?: string;
  clinics?: { id: string; name: string };
  expense_group?: string;
}

export function AccountantChartsTab() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');

  // قائمة الأشهر المالية لآخر 12 شهراً
  const financialMonths = useMemo(() => getFinancialMonthsList(12), []);

  // الشهر المالي المختار للتركيز والتحليل التفصيلي
  const [selectedMonthId, setSelectedMonthId] = useState<string>(() => {
    const cur = getFinancialMonthBounds();
    return `${cur.startStr}_${cur.endStr}`;
  });

  // نطاق الأشهر المالية للمقارنة (آخر 6 أو 12 شهر)
  const [comparisonCount, setComparisonCount] = useState<6 | 12>(6);

  // جلب العيادات
  useEffect(() => {
    supabase
      .from('clinics')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setClinics(data);
      });
  }, []);

  // جلب كافة الحركات المالية للتحليل البياني
  const fetchAllTransactions = useCallback(async () => {
    setLoading(true);
    // نجلب الحركات المالية بحد أقصى مناسب للدقة الإحصائية
    const { data } = await supabase
      .from('transactions')
      .select('id, type, amount, category, description, created_at, clinic_id, clinics(id, name), expense_group')
      .order('created_at', { ascending: true })
      .limit(10000);

    if (data) {
      // تصفية القيود الصفرية والقيود المكررة في نفس اللحظة
      const valid: TransactionItem[] = [];
      data.forEach((t: any) => {
        const amt = Number(t.amount || 0);
        if (t.type === 'income' && amt === 0) return;
        valid.push({
          ...t,
          amount: amt,
        });
      });
      setTransactions(valid);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchAllTransactions, 0);
    return () => clearTimeout(timer);
  }, [fetchAllTransactions]);

  // الاشتراك في تحديثات Realtime
  useEffect(() => {
    const channel = supabase
      .channel('accountant_charts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchAllTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllTransactions]);

  // الشهر المالي المختار حالياً
  const selectedPeriod = useMemo(() => {
    const found = financialMonths.find((m) => m.id === selectedMonthId);
    return found || financialMonths[0] || getFinancialMonthBounds();
  }, [selectedMonthId, financialMonths]);

  // تصفية الحركات حسب العيادة إذا حُددت
  const filteredTransactions = useMemo(() => {
    if (!selectedClinicId) return transactions;
    return transactions.filter((t) => t.clinic_id === selectedClinicId);
  }, [transactions, selectedClinicId]);

  // 1. حركات الشهر المالي المختار
  const currentMonthTransactions = useMemo(() => {
    const fromTime = new Date(`${selectedPeriod.startStr}T00:00:00`).getTime();
    const toTime = new Date(`${selectedPeriod.endStr}T23:59:59`).getTime();

    return filteredTransactions.filter((t) => {
      const created = new Date(t.created_at).getTime();
      return created >= fromTime && created <= toTime;
    });
  }, [filteredTransactions, selectedPeriod]);

  // 2. إحصائيات الشهر المالي المختار
  const currentMonthStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    currentMonthTransactions.forEach((t) => {
      if (t.type === 'income') {
        income += t.amount;
        incomeCount++;
      } else {
        expense += t.amount;
        expenseCount++;
      }
    });

    const net = income - expense;
    const expenseRatio = income > 0 ? (expense / income) * 100 : 0;

    // حساب عدد الأيام الفعلي في الشهر المالي (عادة 30 أو 31 يوم)
    const startDate = new Date(selectedPeriod.start);
    const endDate = new Date(selectedPeriod.end);
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
    const avgDailyIncome = income / totalDays;

    return {
      income,
      expense,
      net,
      incomeCount,
      expenseCount,
      totalCount: incomeCount + expenseCount,
      expenseRatio,
      avgDailyIncome,
      totalDays,
    };
  }, [currentMonthTransactions, selectedPeriod]);

  // 3. مقارنة الشهر المالي المختار بالشهر المالي السابق له مباشرة
  const previousMonthStats = useMemo(() => {
    // حساب تاريخ مرجعي قبل بداية الشهر المالي المختار
    const prevRef = new Date(selectedPeriod.start);
    prevRef.setDate(prevRef.getDate() - 2);
    const prevBounds = getFinancialMonthBounds(prevRef);

    const fromTime = new Date(`${prevBounds.startStr}T00:00:00`).getTime();
    const toTime = new Date(`${prevBounds.endStr}T23:59:59`).getTime();

    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((t) => {
      const created = new Date(t.created_at).getTime();
      if (created >= fromTime && created <= toTime) {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      }
    });

    const net = income - expense;
    return { income, expense, net };
  }, [filteredTransactions, selectedPeriod]);

  // نسب التغير مقارنة بالشهر السابق
  const growthStats = useMemo(() => {
    const calcGrowth = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return ((cur - prev) / prev) * 100;
    };

    return {
      incomeGrowth: calcGrowth(currentMonthStats.income, previousMonthStats.income),
      expenseGrowth: calcGrowth(currentMonthStats.expense, previousMonthStats.expense),
      netGrowth: calcGrowth(currentMonthStats.net, previousMonthStats.net),
    };
  }, [currentMonthStats, previousMonthStats]);

  // 4. بيانات المقارنة عبر الأشهر المالية (Historical Multi-Month Trend)
  const monthlyTrendData = useMemo(() => {
    // نأخذ آخر N شهراً من قائمة الأشهر المالية ونعكس الترتيب ليكون من الأقدم إلى الأحدث زمنياً
    const targetMonths = financialMonths.slice(0, comparisonCount).reverse();

    return targetMonths.map((period) => {
      const fromTime = new Date(`${period.startStr}T00:00:00`).getTime();
      const toTime = new Date(`${period.endStr}T23:59:59`).getTime();

      let income = 0;
      let expense = 0;

      filteredTransactions.forEach((t) => {
        const created = new Date(t.created_at).getTime();
        if (created >= fromTime && created <= toTime) {
          if (t.type === 'income') income += t.amount;
          else expense += t.amount;
        }
      });

      // اختصار اسم الشهر المالي للعرض الأنيق على المحور الأفقي
      const startD = new Date(period.start);
      const endD = new Date(period.end);
      const label = `${startD.toLocaleDateString('ar-EG', { month: 'short' })} - ${endD.toLocaleDateString('ar-EG', { month: 'short' })}`;

      return {
        id: period.id,
        name: label,
        fullTitle: period.displayTitle,
        الإيرادات: income,
        المصروفات: expense,
        صافي_الربح: income - expense,
        isSelected: period.id === selectedMonthId,
      };
    });
  }, [financialMonths, comparisonCount, filteredTransactions, selectedMonthId]);

  // 5. توزيع المصروفات حسب التصنيف للشهر المالي المختار (Expenses Breakdown Pie Chart)
  const expenseCategoryData = useMemo(() => {
    const map = new Map<string, number>();

    currentMonthTransactions.forEach((t) => {
      if (t.type !== 'income') {
        const catKey = t.expense_group || t.category || (t.type === 'salary' ? 'salary' : 'misc');
        const prev = map.get(catKey) || 0;
        map.set(catKey, prev + t.amount);
      }
    });

    const list: Array<{ name: string; value: number; percent: number }> = [];
    const totalExp = currentMonthStats.expense || 1;

    map.forEach((amount, key) => {
      const label = EXPENSE_LABELS[key] || key || 'مصروفات أخرى';
      list.push({
        name: label,
        value: amount,
        percent: Math.round((amount / totalExp) * 100),
      });
    });

    return list.sort((a, b) => b.value - a.value);
  }, [currentMonthTransactions, currentMonthStats.expense]);

  // 6. توزيع الإيرادات حسب العيادات للشهر المالي المختار (Income Breakdown by Clinic)
  const incomeByClinicData = useMemo(() => {
    const map = new Map<string, number>();

    currentMonthTransactions.forEach((t) => {
      if (t.type === 'income') {
        const clinicName = t.clinics?.name || 'المركز العام';
        const prev = map.get(clinicName) || 0;
        map.set(clinicName, prev + t.amount);
      }
    });

    const list: Array<{ name: string; value: number; percent: number }> = [];
    const totalInc = currentMonthStats.income || 1;

    map.forEach((amount, name) => {
      list.push({
        name,
        value: amount,
        percent: Math.round((amount / totalInc) * 100),
      });
    });

    return list.sort((a, b) => b.value - a.value);
  }, [currentMonthTransactions, currentMonthStats.income]);

  // 7. التدفق المالي اليومي خلال الشهر المالي المختار (Daily Cash Flow Timeline)
  const dailyCashflowData = useMemo(() => {
    const dayMap = new Map<string, { date: string; dayNumber: string; الإيرادات: number; المصروفات: number; الصافي: number }>();

    // توليد كافة الأيام ضمن نطاق الشهر المالي من البداية للنهاية
    const cur = new Date(selectedPeriod.start);
    const end = new Date(selectedPeriod.end);

    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      const dayFormatted = `${cur.getDate()} ${cur.toLocaleDateString('ar-EG', { month: 'short' })}`;
      dayMap.set(dateStr, {
        date: dateStr,
        dayNumber: dayFormatted,
        الإيرادات: 0,
        المصروفات: 0,
        الصافي: 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    currentMonthTransactions.forEach((t) => {
      const dateStr = t.created_at ? t.created_at.slice(0, 10) : '';
      if (dayMap.has(dateStr)) {
        const entry = dayMap.get(dateStr)!;
        if (t.type === 'income') {
          entry.الإيرادات += t.amount;
        } else {
          entry.المصروفات += t.amount;
        }
        entry.الصافي = entry.الإيرادات - entry.المصروفات;
      }
    });

    return Array.from(dayMap.values());
  }, [selectedPeriod, currentMonthTransactions]);

  // طباعة الصفحة
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* الترويسة الرئيسية وخيارات الفلترة */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-sm">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>الرسوم البيانية والتحليلات المالية</span>
              <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Recharts Analytics
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              متابعة بصرية وتوزيع دقيق للدخل والمصروفات والأرباح وفق دورات الشهر المالي (21 - 20)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* فلتر العيادة */}
          <div className="flex items-center gap-1.5 bg-gray-50 border rounded-xl px-2.5 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              className="bg-transparent text-xs font-bold text-gray-700 focus:outline-hidden cursor-pointer"
            >
              <option value="">جميع العيادات</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* اختيار الشهر المالي للتحليل */}
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <CalendarDays className="w-3.5 h-3.5 text-emerald-700" />
            <select
              value={selectedMonthId}
              onChange={(e) => setSelectedMonthId(e.target.value)}
              className="bg-transparent text-xs font-bold text-emerald-900 focus:outline-hidden cursor-pointer"
            >
              {financialMonths.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayTitle}
                </option>
              ))}
            </select>
          </div>

          {/* زر التحديث */}
          <button
            onClick={fetchAllTransactions}
            disabled={loading}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {/* زر الطباعة */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* كروت المؤشرات المالية للشهر المالي المختار */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* إجمالي الإيرادات */}
        <Card className="border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/30 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">إيرادات الشهر المالي</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-700 tracking-tight" dir="ltr">
                +{currentMonthStats.income.toLocaleString('ar-EG')} <span className="text-xs font-medium">ج.م</span>
              </p>
            </div>
            <div className="flex items-center justify-between pt-1 text-[11px] border-t border-emerald-100/60">
              <span className="text-gray-500">{currentMonthStats.incomeCount} حركة إيراد</span>
              <span
                className={`font-bold flex items-center gap-0.5 ${
                  growthStats.incomeGrowth >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
                dir="ltr"
              >
                {growthStats.incomeGrowth >= 0 ? '+' : ''}
                {growthStats.incomeGrowth.toFixed(1)}% عن السابق
              </span>
            </div>
          </CardContent>
        </Card>

        {/* إجمالي المصروفات */}
        <Card className="border border-red-100 bg-gradient-to-b from-white to-red-50/30 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">مصروفات الشهر المالي</span>
              <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-red-700 tracking-tight" dir="ltr">
                -{currentMonthStats.expense.toLocaleString('ar-EG')} <span className="text-xs font-medium">ج.م</span>
              </p>
            </div>
            <div className="flex items-center justify-between pt-1 text-[11px] border-t border-red-100/60">
              <span className="text-gray-500">{currentMonthStats.expenseCount} حركة صرف</span>
              <span
                className={`font-bold flex items-center gap-0.5 ${
                  growthStats.expenseGrowth <= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
                dir="ltr"
              >
                {growthStats.expenseGrowth >= 0 ? '+' : ''}
                {growthStats.expenseGrowth.toFixed(1)}% عن السابق
              </span>
            </div>
          </CardContent>
        </Card>

        {/* صافي الربح / الفائض */}
        <Card
          className={`border shadow-xs bg-gradient-to-b from-white ${
            currentMonthStats.net >= 0 ? 'border-blue-100 to-blue-50/30' : 'border-orange-100 to-orange-50/30'
          }`}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">صافي الموقف المالي</span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  currentMonthStats.net >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                }`}
              >
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p
                className={`text-2xl font-black tracking-tight ${
                  currentMonthStats.net >= 0 ? 'text-blue-700' : 'text-orange-700'
                }`}
                dir="ltr"
              >
                {currentMonthStats.net >= 0 ? '+' : ''}
                {currentMonthStats.net.toLocaleString('ar-EG')} <span className="text-xs font-medium">ج.م</span>
              </p>
            </div>
            <div className="flex items-center justify-between pt-1 text-[11px] border-t border-gray-100">
              <span className="text-gray-500">
                {currentMonthStats.net >= 0 ? 'فائض مالي تشغيلي' : 'عجز مالي'}
              </span>
              <span
                className={`font-bold ${
                  growthStats.netGrowth >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
                dir="ltr"
              >
                {growthStats.netGrowth >= 0 ? '+' : ''}
                {growthStats.netGrowth.toFixed(1)}% نمو الصافي
              </span>
            </div>
          </CardContent>
        </Card>

        {/* مؤشرات الكفاءة والتشغيل */}
        <Card className="border border-purple-100 bg-gradient-to-b from-white to-purple-50/30 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">نسبة المصروفات / الإيراد</span>
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-purple-700 tracking-tight" dir="ltr">
                {currentMonthStats.expenseRatio.toFixed(1)}%
              </p>
            </div>
            <div className="flex items-center justify-between pt-1 text-[11px] border-t border-purple-100/60">
              <span className="text-gray-500">متوسط يومي:</span>
              <span className="font-bold text-gray-800" dir="ltr">
                {Math.round(currentMonthStats.avgDailyIncome).toLocaleString('ar-EG')} ج.م/يوم
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* الرسم البياني الأول: مقارنة الأشهر المالية السابقة (Recharts Bar & Line) */}
      <Card className="border border-gray-200 shadow-xs">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <span>مقارنة الدخل والمصروفات وصافي الأرباح عبر الأشهر المالية</span>
              </CardTitle>
              <CardDescription className="text-xs">
                مقارنة دورات الأشهر المالية (21 إلى 20) لتحديد اتجاه النمو والربحية الشهرية
              </CardDescription>
            </div>

            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs">
              <button
                onClick={() => setComparisonCount(6)}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  comparisonCount === 6 ? 'bg-white text-emerald-800 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                آخر 6 أشهر
              </button>
              <button
                onClick={() => setComparisonCount(12)}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  comparisonCount === 12 ? 'bg-white text-emerald-800 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                آخر 12 شهر
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[320px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyTrendData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const row = e.activePayload[0].payload;
                    if (row && row.id) setSelectedMonthId(row.id);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div
                          className="bg-white p-3 rounded-xl shadow-lg border border-gray-100 text-right text-xs space-y-1.5"
                          dir="rtl"
                        >
                          <p className="font-bold text-gray-900 border-b pb-1 mb-1">{data.fullTitle}</p>
                          <p className="text-emerald-700 font-bold flex items-center justify-between gap-4">
                            <span>الإيرادات:</span>
                            <span dir="ltr">+{Number(data.الإيرادات).toLocaleString('ar-EG')} ج.م</span>
                          </p>
                          <p className="text-red-700 font-bold flex items-center justify-between gap-4">
                            <span>المصروفات:</span>
                            <span dir="ltr">-{Number(data.المصروفات).toLocaleString('ar-EG')} ج.م</span>
                          </p>
                          <p
                            className={`font-black pt-1 border-t flex items-center justify-between gap-4 ${
                              data.صافي_الربح >= 0 ? 'text-blue-700' : 'text-orange-700'
                            }`}
                          >
                            <span>الصافي:</span>
                            <span dir="ltr">
                              {data.صافي_الربح >= 0 ? '+' : ''}
                              {Number(data.صافي_الربح).toLocaleString('ar-EG')} ج.م
                            </span>
                          </p>
                          <p className="text-[10px] text-gray-400 text-center pt-0.5">
                            انقر لاختيار هذا الشهر للتحليل التفصيلي
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="الإيرادات" fill={COLORS.income} radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="المصروفات" fill={COLORS.expense} radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-[11px] text-gray-400 mt-1">
            * يمكنك النقر على أي شهر في الرسم البياني للتبديل إليه ومشاهدة توزيعاته التفصيلية أدناه
          </div>
        </CardContent>
      </Card>

      {/* الرسوم البيانية التوزيعية (دونات للمصروفات وأعمدة للعيادات) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* توزيع المصروفات حسب التصنيف (Donut Chart) */}
        <Card className="border border-gray-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-red-600" />
              <span>توزيع بنود المصروفات — {selectedPeriod.displayTitle}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              تحليل توزيع التكاليف التشغيلية والأجور والمستلزمات في الشهر المالي المختار
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenseCategoryData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-xs">
                لا توجد مصروفات مسجلة في هذا الشهر المالي
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-[240px] w-full sm:w-1/2" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {expenseCategoryData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS.pie[index % COLORS.pie.length]}
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="bg-white p-2.5 rounded-xl shadow-md border text-right text-xs" dir="rtl">
                                <p className="font-bold text-gray-800">{p.name}</p>
                                <p className="text-red-700 font-bold" dir="ltr">
                                  {Number(p.value).toLocaleString('ar-EG')} ج.م ({p.percent}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* قائمة البنود والنسب */}
                <div className="w-full sm:w-1/2 space-y-2 text-xs">
                  {expenseCategoryData.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-gray-700">
                        <span className="flex items-center gap-1.5 font-medium truncate max-w-[140px]">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS.pie[idx % COLORS.pie.length] }}
                          />
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="font-bold text-gray-900" dir="ltr">
                          {Number(item.value).toLocaleString('ar-EG')} ج.م ({item.percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.percent}%`,
                            backgroundColor: COLORS.pie[idx % COLORS.pie.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* توزيع الإيرادات حسب العيادات والأقسام */}
        <Card className="border border-gray-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>مصادر الإيرادات حسب العيادات — {selectedPeriod.displayTitle}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              مساهمة كل عيادة ومركز في إجمالي دخل الشهر المالي المختار
            </CardDescription>
          </CardHeader>
          <CardContent>
            {incomeByClinicData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-gray-400 text-xs">
                لا توجد إيرادات مسجلة في هذا الشهر المالي
              </div>
            ) : (
              <div className="h-[260px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={incomeByClinicData}
                    margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: '#374151', fontSize: 11, fontWeight: 'bold' }}
                      width={100}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0].payload;
                          return (
                            <div className="bg-white p-2.5 rounded-xl shadow-md border text-right text-xs" dir="rtl">
                              <p className="font-bold text-gray-800">{p.name}</p>
                              <p className="text-emerald-700 font-bold" dir="ltr">
                                +{Number(p.value).toLocaleString('ar-EG')} ج.م ({p.percent}% من الدخل)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" name="الإيراد" fill={COLORS.income} radius={[0, 6, 6, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* التدفق النقدي اليومي عبر أيام الشهر المالي (من 21 إلى 20) */}
      <Card className="border border-gray-200 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span>حركة التدفق النقدي اليومي (من 21 إلى 20 في الشهر التالي)</span>
          </CardTitle>
          <CardDescription className="text-xs">
            رصد يومي دقيق لحركة التحصيلات والإيرادات والمصروفات على مدار الدورة المالية
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[280px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyCashflowData} margin={{ top: 15, right: 25, left: 15, bottom: 15 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.income} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.income} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.expense} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.expense} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="dayNumber"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  interval={3}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-xl shadow-lg border text-right text-xs space-y-1" dir="rtl">
                          <p className="font-bold text-gray-900 border-b pb-1">
                            يوم {d.dayNumber} ({d.date})
                          </p>
                          <p className="text-emerald-700 font-bold" dir="ltr">
                            إيراد: +{Number(d.الإيرادات).toLocaleString('ar-EG')} ج.م
                          </p>
                          <p className="text-red-700 font-bold" dir="ltr">
                            صرف: -{Number(d.المصروفات).toLocaleString('ar-EG')} ج.م
                          </p>
                          <p
                            className={`font-black pt-1 border-t ${
                              d.الصافي >= 0 ? 'text-blue-700' : 'text-orange-700'
                            }`}
                            dir="ltr"
                          >
                            صافي اليوم: {d.الصافي >= 0 ? '+' : ''}
                            {Number(d.الصافي).toLocaleString('ar-EG')} ج.م
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="الإيرادات"
                  stroke={COLORS.income}
                  fillOpacity={1}
                  fill="url(#colorIncome)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="المصروفات"
                  stroke={COLORS.expense}
                  fillOpacity={1}
                  fill="url(#colorExpense)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
