'use client';

// ============================================================================
// components/dashboards/doctor/DoctorFinancials.tsx
// تبويب "الحسابات والمستحقات" في حساب الطبيب:
// 1. بيان تفصيلي بجميع الزيارات والكشوفات والخدمات المربوطة بالطبيب أو عيادته
//    (من patient_visits و call_queue معاً لضمان عدم ضياع أي كشف سابق أو حالي).
// 2. حساب نسبة الطبيب التعاقدية (default_share_percent من ملف الطبيب) بدقة.
// 3. عرض السلف والمسحوبات المسجلة للطبيب من transactions لخصمها من صافي المستحقات.
// 4. عرض سجل التسديدات الرسمية (doctor_settlements) الصادرة من الإدارة.
// 5. فلاتر سريعة (اليوم / الأسبوع / الشهر / 30 يوم / الكل) وبحث وترقيم وطباعة.
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import {
  Calculator,
  Wallet,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Printer,
  Building2,
  TrendingUp,
  CreditCard,
  RotateCcw,
} from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { getFinancialMonthBounds, getPreviousFinancialMonthBounds } from '@/lib/financialMonth';

const PAGE_SIZE = 10;

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

interface DoctorRowItem {
  id: string;
  source: 'patient_visits' | 'call_queue';
  patient_name: string;
  service_name: string;
  clinic_name?: string;
  paid_amount: number;
  visit_date: string;
  created_at: string;
  doctor_id: string | null;
  clinic_id: string | null;
  paid: boolean;
}

export function DoctorFinancials() {
  const { user } = useAuth();

  // بيانات الطبيب والعيادات
  const [doctorInfo, setDoctorInfo] = useState<{
    default_share_percent: number;
    clinic_ids: string[];
    clinic_names: Record<string, string>;
  }>({
    default_share_percent: 50,
    clinic_ids: [],
    clinic_names: {},
  });

  const [items, setItems] = useState<DoctorRowItem[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // الفلاتر — تبدأ افتراضياً من أول الشهر المالي الحالي (21 في الشهر إلى 20 في الشهر التالي)
  const [dateFrom, setDateFrom] = useState(() => getFinancialMonthBounds().startStr);
  const [dateTo, setDateTo] = useState(() => getFinancialMonthBounds().endStr);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);

  // إعدادات النطاق السريع (وفق الشهر المالي 21 إلى 20)
  const setQuickRange = (type: 'today' | 'week' | 'month' | 'prevMonth' | '30days' | 'all') => {
    const now = new Date();
    if (type === 'today') {
      const s = toDateInputValue(now);
      setDateFrom(s);
      setDateTo(s);
    } else if (type === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diffToSaturday = (day + 1) % 7;
      d.setDate(d.getDate() - diffToSaturday);
      setDateFrom(toDateInputValue(d));
      setDateTo(toDateInputValue(now));
    } else if (type === 'month') {
      // الشهر المالي الحالي: من 21 إلى 20
      const currentFin = getFinancialMonthBounds(now);
      setDateFrom(currentFin.startStr);
      setDateTo(currentFin.endStr);
    } else if (type === 'prevMonth') {
      // الشهر المالي السابق: من 21 إلى 20
      const prevFin = getPreviousFinancialMonthBounds(now);
      setDateFrom(prevFin.startStr);
      setDateTo(prevFin.endStr);
    } else if (type === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setDateFrom(toDateInputValue(d));
      setDateTo(toDateInputValue(now));
    } else if (type === 'all') {
      setDateFrom('2024-01-01');
      setDateTo(toDateInputValue(now));
    }
  };

  // 1) جلب معلومات الطبيب والعيادات التابع لها
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function fetchDoctorMeta() {
      try {
        const [docRes, dcRes, clinicsRes] = await Promise.all([
          supabase.from('doctors').select('clinic_id, default_share_percent').eq('profile_id', user!.id).maybeSingle(),
          supabase.from('doctor_clinics').select('clinic_id').eq('doctor_id', user!.id),
          supabase.from('clinics').select('id, name'),
        ]);

        if (cancelled) return;

        const clinicNamesMap: Record<string, string> = {};
        (clinicsRes.data || []).forEach((c: any) => {
          clinicNamesMap[c.id] = c.name;
        });

        const clinicIdsSet = new Set<string>();
        if (docRes.data?.clinic_id) clinicIdsSet.add(docRes.data.clinic_id);
        (dcRes.data || []).forEach((r: any) => {
          if (r.clinic_id) clinicIdsSet.add(r.clinic_id);
        });

        const sharePercent = docRes.data?.default_share_percent !== null && docRes.data?.default_share_percent !== undefined
          ? Number(docRes.data.default_share_percent)
          : 50;

        setDoctorInfo({
          default_share_percent: sharePercent,
          clinic_ids: Array.from(clinicIdsSet),
          clinic_names: clinicNamesMap,
        });
      } catch (err) {
        console.warn('Error loading doctor metadata:', err);
      }
    }

    fetchDoctorMeta();
    return () => { cancelled = true; };
  }, [user]);

  // 2) جلب الكشوفات والزيارات والتسديدات والسلف
  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoadError(null);
    setLoading(true);

    try {
      const clinicIds = doctorInfo.clinic_ids;

      // الاستعلام عن التسديدات الخاصة بالطبيب
      const settlementsPromise = supabase
        .from('doctor_settlements')
        .select('*')
        .eq('doctor_id', user.id)
        .order('settled_at', { ascending: false });

      // الاستعلام عن السلف والمدفوعات من transactions
      const advancesPromise = supabase
        .from('transactions')
        .select('id, category, amount, created_at, description')
        .or(`beneficiary_id.eq.${user.id},user_id.eq.${user.id}`)
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      // المصدر 1: patient_visits (المستودع الرئيسي والدائم لكل الزيارات)
      // نبحث بالكشوفات المربوطة بالطبيب إما عبر doctor_id صراحة أو عبر عياداته
      let visitsPromise = supabase
        .from('patient_visits')
        .select('id, patient_name, service_name, paid_amount, visit_date, created_at, doctor_id, clinic_id, visit_group_id')
        .gte('visit_date', dateFrom)
        .lte('visit_date', dateTo)
        .order('visit_date', { ascending: false });

      if (clinicIds.length > 0) {
        // الطبيب محدد كـ doctor_id أو الزيارة تمت في إحدى عياداته
        visitsPromise = visitsPromise.or(`doctor_id.eq.${user.id},and(doctor_id.is.null,clinic_id.in.(${clinicIds.join(',')}))`);
      } else {
        visitsPromise = visitsPromise.eq('doctor_id', user.id);
      }

      // المصدر 2: call_queue (طابور اليوم)
      let queuePromise = supabase
        .from('call_queue')
        .select('id, patient_name, service_custom_name, paid_amount, status, created_at, doctor_id, clinic_id, visit_group_id')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      if (clinicIds.length > 0) {
        queuePromise = queuePromise.or(`doctor_id.eq.${user.id},and(doctor_id.is.null,clinic_id.in.(${clinicIds.join(',')}))`);
      } else {
        queuePromise = queuePromise.eq('doctor_id', user.id);
      }

      const [settlementsRes, advancesRes, visitsRes, queueRes] = await Promise.all([
        settlementsPromise,
        advancesPromise,
        visitsPromise,
        queuePromise,
      ]);

      const loadedSettlements = settlementsRes.data || [];
      setSettlements(loadedSettlements);
      setAdvances(advancesRes.data || []);

      // دالة التحقق من أن الكشف مدفوع ضمن تسديد رسمي
      const isSettledCheck = (dateStr: string) => {
        return loadedSettlements.some((s: any) => dateStr >= s.period_start && dateStr <= s.period_end);
      };

      // دمج وتوحيد الصفوف بدون تكرار
      const unifiedRows: DoctorRowItem[] = [];
      const seenKeys = new Set<string>();

      // إضافة من patient_visits
      (visitsRes.data || []).forEach((v: any) => {
        const vDate = v.visit_date || toDateInputValue(new Date(v.created_at || Date.now()));
        const key = v.id || `visit-${v.visit_group_id}-${v.patient_name}-${vDate}`;
        seenKeys.add(key);
        if (v.visit_group_id) seenKeys.add(v.visit_group_id);

        unifiedRows.push({
          id: v.id,
          source: 'patient_visits',
          patient_name: v.patient_name || 'مريض بدون اسم',
          service_name: v.service_name || 'كشف عيادة',
          clinic_name: v.clinic_id ? doctorInfo.clinic_names[v.clinic_id] : undefined,
          paid_amount: Number(v.paid_amount || 0),
          visit_date: vDate,
          created_at: v.created_at || `${vDate}T00:00:00`,
          doctor_id: v.doctor_id,
          clinic_id: v.clinic_id,
          paid: isSettledCheck(vDate),
        });
      });

      // إضافة من call_queue (للصفوف التي لم يتم إدراجها بعد من patient_visits)
      (queueRes.data || []).forEach((q: any) => {
        if (q.visit_group_id && seenKeys.has(q.visit_group_id)) return;
        if (seenKeys.has(q.id)) return;

        const qDate = toDateInputValue(new Date(q.created_at || Date.now()));
        unifiedRows.push({
          id: q.id,
          source: 'call_queue',
          patient_name: q.patient_name || 'مريض بالدور',
          service_name: q.service_custom_name || 'كشف بالعيادة (طابور)',
          clinic_name: q.clinic_id ? doctorInfo.clinic_names[q.clinic_id] : undefined,
          paid_amount: Number(q.paid_amount || 0),
          visit_date: qDate,
          created_at: q.created_at,
          doctor_id: q.doctor_id,
          clinic_id: q.clinic_id,
          paid: isSettledCheck(qDate),
        });
      });

      // ترتيب الصفوف تنازلياً حسب التاريخ
      unifiedRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(unifiedRows);
    } catch (err: any) {
      setLoadError(getFriendlyErrorMessage(err, 'تعذر تحميل بيان الحسابات.'));
    } finally {
      setLoading(false);
    }
  }, [user, doctorInfo, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(fetchData, 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, searchQuery, dateFrom, dateTo]);

  // التصفية بحالة الدفع وبحث الاسم أو الخدمة
  const filteredRows = useMemo(() => {
    return items.filter((row) => {
      if (statusFilter === 'paid' && !row.paid) return false;
      if (statusFilter === 'unpaid' && row.paid) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = row.patient_name.toLowerCase().includes(q);
        const matchService = (row.service_name || '').toLowerCase().includes(q);
        if (!matchName && !matchService) return false;
      }
      return true;
    });
  }, [items, statusFilter, searchQuery]);

  // الإحصائيات والمجاميع المالية
  const sharePercent = doctorInfo.default_share_percent;

  const totals = useMemo(() => {
    const totalCollected = items.reduce((s, r) => s + r.paid_amount, 0);
    const paidCheckupsAmount = items.filter((r) => r.paid).reduce((s, r) => s + r.paid_amount, 0);
    const unpaidCheckupsAmount = totalCollected - paidCheckupsAmount;

    // استحقاق الطبيب التقديري حسب نسبته التعاقدية
    const grossDoctorShare = Math.round((totalCollected * sharePercent) / 100);
    const settledDoctorShare = Math.round((paidCheckupsAmount * sharePercent) / 100);

    // إجمالي السلف والمدفوعات
    const totalAdvances = advances.reduce((s, a) => s + Number(a.amount || 0), 0);

    // الصافي المتبقي للطبيب غير المسدد بعد احتساب النسبة
    const pendingDoctorShare = Math.max(0, Math.round(((unpaidCheckupsAmount * sharePercent) / 100) - totalAdvances));

    // إجمالي ما استلمه الطبيب عبر سجل التسديدات الرسمي
    const totalSettledFromHistory = settlements.reduce((s, r) => s + Number(r.doctor_share_amount || 0), 0);

    return {
      count: items.length,
      totalCollected,
      paidCheckupsAmount,
      unpaidCheckupsAmount,
      grossDoctorShare,
      settledDoctorShare,
      totalAdvances,
      pendingDoctorShare,
      totalSettledFromHistory,
    };
  }, [items, advances, settlements, sharePercent]);

  // ترقيم الصفحات
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filteredRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // طباعة كشف الحساب
  const handlePrint = () => {
    window.print();
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        <p className="text-gray-500 font-medium">جاري احتساب وتحميل بيانات الحسابات والمستحقات...</p>
      </div>
    );
  }

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      {/* رأس الصفحة مع معلومات الطبيب ونسبته وزر الطباعة */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <Calculator className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900">الحسابات والمستحقات المالية</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1 font-bold text-gray-700">
                  <TrendingUp className="w-4 h-4 text-emerald-600" /> نسبة الطبيب التعاقدية: {sharePercent}%
                </span>
                {doctorInfo.clinic_ids.length > 0 && (
                  <span className="flex items-center gap-1 text-gray-600">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    العيادة:{' '}
                    {doctorInfo.clinic_ids
                      .map((cid) => doctorInfo.clinic_names[cid] || 'عيادة تخصصية')
                      .join('، ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            title="تحديث البيانات"
          >
            <RotateCcw className="w-4 h-4" />
            تحديث
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs md:text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            طباعة كشف الحساب
          </button>
        </div>
      </div>

      {/* كروت المؤشرات المالية السريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
        {/* 1. إجمالي المحصّل من المرضى */}
        <Card className="border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">إجمالي المحصّل (الفترة)</p>
            <p className="text-xl md:text-2xl font-black text-gray-900" dir="ltr">
              {totals.totalCollected.toLocaleString()} <span className="text-xs font-medium text-gray-500">ج.م</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">{totals.count} كشف وعملية</p>
          </CardContent>
        </Card>

        {/* 2. مستحقات الطبيب الإجمالية */}
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-800 font-bold mb-1">استحقاق الطبيب ({sharePercent}%)</p>
            <p className="text-xl md:text-2xl font-black text-emerald-700" dir="ltr">
              {totals.grossDoctorShare.toLocaleString()} <span className="text-xs font-medium text-emerald-600">ج.م</span>
            </p>
            <p className="text-[11px] text-emerald-600/80 mt-1">حسب النسبة المقررة</p>
          </CardContent>
        </Card>

        {/* 3. السلف والمدفوعات المخصومة */}
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4">
            <p className="text-xs text-amber-800 font-bold mb-1">السلف المخصومة (الفترة)</p>
            <p className="text-xl md:text-2xl font-black text-amber-700" dir="ltr">
              {totals.totalAdvances.toLocaleString()} <span className="text-xs font-medium text-amber-600">ج.م</span>
            </p>
            <p className="text-[11px] text-amber-600/80 mt-1">{advances.length} حركة مسحوبات</p>
          </CardContent>
        </Card>

        {/* 4. الصافي المعلّق المستحق للصرف */}
        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="p-4">
            <p className="text-xs text-orange-800 font-bold mb-1">الصافي المعلّق (مستحق)</p>
            <p className="text-xl md:text-2xl font-black text-orange-700" dir="ltr">
              {totals.pendingDoctorShare.toLocaleString()} <span className="text-xs font-medium text-orange-600">ج.م</span>
            </p>
            <p className="text-[11px] text-orange-600/80 mt-1">بانتظار تسديد الإدارة</p>
          </CardContent>
        </Card>

        {/* 5. إجمالي ما تم استلامه من تسديدات رسمية */}
        <Card className="col-span-2 md:col-span-4 lg:col-span-1 bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-0">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-100 mb-1 flex items-center gap-1 font-medium">
              <Wallet className="w-3.5 h-3.5" />
              المستلم الفعلي (رسمي)
            </p>
            <p className="text-xl md:text-2xl font-black" dir="ltr">
              {totals.totalSettledFromHistory.toLocaleString()} <span className="text-xs font-normal text-emerald-200">ج.م</span>
            </p>
            <p className="text-[11px] text-emerald-200/90 mt-1">كل التسديدات المعتمدة</p>
          </CardContent>
        </Card>
      </div>

      {/* شريط الفلاتر والبحث */}
      <Card className="print:hidden">
        <CardContent className="p-4 space-y-3">
          {/* أزرار الفترات السريعة */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-500 ml-2">فترات سريعة:</span>
            <button
              onClick={() => setQuickRange('today')}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600"
            >
              اليوم
            </button>
            <button
              onClick={() => setQuickRange('week')}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600"
            >
              هذا الأسبوع
            </button>
            <button
              onClick={() => setQuickRange('month')}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
              title="يبدأ من 21 في الشهر إلى 20 في الشهر التالي"
            >
              الشهر المالي الحالي (21 - 20)
            </button>
            <button
              onClick={() => setQuickRange('prevMonth')}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600"
              title="الشهر المالي السابق من 21 إلى 20"
            >
              الشهر المالي السابق
            </button>
            <button
              onClick={() => setQuickRange('30days')}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600"
            >
              آخر 30 يوم
            </button>
            <button
              onClick={() => setQuickRange('all')}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600"
            >
              كل الأوقات
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* نطاق التاريخ */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-gray-600 text-xs font-bold shrink-0">
                <Calendar className="w-4 h-4 text-emerald-600" />
                من:
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-gray-400 text-xs shrink-0">إلى:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-300 rounded-lg p-2 text-xs bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* فلتر حالة الدفع */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-gray-300 rounded-lg p-2 text-xs bg-white font-medium"
            >
              <option value="all">كل الحالات (المسدد والمعلّق)</option>
              <option value="paid">مسدد ضمن تسديد رسمي فقط</option>
              <option value="unpaid">معلّق قيد التحصيل فقط</option>
            </select>

            {/* بحث باسم المريض أو الخدمة */}
            <div className="relative flex-1 md:max-w-xs md:mr-auto">
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم المريض أو الكشف..."
                className="w-full pr-9 pl-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* بيان الكشوفات والزيارات التفصيلي */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 bg-gray-50 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-gray-900 text-sm md:text-base">بيان الكشوفات والخدمات المنفذة</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                تظهر هنا جميع الزيارات المسجلة باسمك أو بعيادتك من السكرتارية ونداء الانتظار
              </p>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-white border px-3 py-1 rounded-full w-fit">
              عدد النتائج: {filteredRows.length} كشف
            </span>
          </div>

          {filteredRows.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                <Calculator className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-gray-700">لا توجد كشوفات أو زيارات مسجلة لحسابك</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                لم يتم العثور على زيارات مسجلة باسمك أو بعيادتك خلال النطاق الزمني المحدد ({dateFrom} إلى {dateTo}).
                تأكد من تسجيل الزيارات لدى السكرتارية وتحديد الطبيب أو عيادته.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setQuickRange('all')}
                  className="px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  عرض سجل كل الأوقات
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-white border-b text-gray-600">
                    <th className="p-3.5 font-bold">#</th>
                    <th className="p-3.5 font-bold">التاريخ</th>
                    <th className="p-3.5 font-bold">المريض</th>
                    <th className="p-3.5 font-bold">الخدمة / الكشف</th>
                    <th className="p-3.5 font-bold">المبلغ المحصّل</th>
                    <th className="p-3.5 font-bold">نصيبك ({sharePercent}%)</th>
                    <th className="p-3.5 font-bold">حالة الدفع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageItems.map((r, idx) => {
                    const rowDoctorShare = Math.round((r.paid_amount * sharePercent) / 100);
                    return (
                      <tr key={r.id || idx} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3.5 text-gray-400 font-mono">{safePage * PAGE_SIZE + idx + 1}</td>
                        <td className="p-3.5 text-gray-700 font-medium">
                          <div>{r.visit_date}</div>
                          <div className="text-[10px] text-gray-400" dir="ltr">
                            {new Date(r.created_at).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                        <td className="p-3.5 font-bold text-gray-900">{r.patient_name}</td>
                        <td className="p-3.5 text-gray-600">
                          <div>{r.service_name}</div>
                          {r.clinic_name && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {r.clinic_name}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-bold text-gray-900" dir="ltr">
                          {r.paid_amount.toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5 font-bold text-emerald-700" dir="ltr">
                          {rowDoctorShare.toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5">
                          {r.paid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5" /> مدفوع ضمن تسديد
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full">
                              <Clock className="w-3.5 h-3.5" /> معلّق (قيد التحصيل)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredRows.length > PAGE_SIZE && (
            <div className="p-4 border-t print:hidden">
              <Pagination page={safePage} pageSize={PAGE_SIZE} total={filteredRows.length} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* سجل التسديدات الرسمية المعتمدة */}
      {settlements.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm md:text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  سجل التسديدات المعتمدة من الإدارة
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  الدفعات والمستحقات الرسمية التي تم تسويتها وصرفها لك
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                إجمالي المسدد: {totals.totalSettledFromHistory.toLocaleString()} ج.م
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-white border-b text-gray-600">
                    <th className="p-3 font-bold">تاريخ التسديد</th>
                    <th className="p-3 font-bold">الفترة المغطاة</th>
                    <th className="p-3 font-bold">نوع التسديد</th>
                    <th className="p-3 font-bold">عدد الكشوفات</th>
                    <th className="p-3 font-bold">إجمالي المحصّل</th>
                    <th className="p-3 font-bold">النسبة المطبقة</th>
                    <th className="p-3 font-bold text-emerald-700">المبلغ المستلم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-700 font-medium">
                        {new Date(s.settled_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="p-3 font-mono text-gray-600" dir="ltr">
                        {s.period_start} → {s.period_end}
                      </td>
                      <td className="p-3 text-gray-600">
                        {s.period_type === 'daily' ? 'يومي' : s.period_type === 'weekly' ? 'أسبوعي' : 'شهري'}
                      </td>
                      <td className="p-3 font-bold text-gray-800">{s.checkups_count}</td>
                      <td className="p-3 text-gray-700" dir="ltr">
                        {Number(s.total_amount || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3 text-gray-700 font-bold">
                        {s.share_percent !== null && s.share_percent !== undefined ? `${s.share_percent}%` : 'مبلغ مقطوع'}
                      </td>
                      <td className="p-3 font-black text-emerald-600 text-sm" dir="ltr">
                        {Number(s.doctor_share_amount || 0).toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* سجل السلف والمسحوبات المسجلة إن وجدت */}
      {advances.length > 0 && (
        <Card className="border-amber-200">
          <CardContent className="p-0">
            <div className="p-4 bg-amber-50/50 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-amber-900 text-sm md:text-base">سجل السلف والمسحوبات المسجلة</h3>
                <p className="text-xs text-amber-700/80 mt-0.5">
                  المبالغ المصروفة كسلف نقدية أو أجور مسبقة يتم خصمها تلقائياً من إجمالي استحقاقاتك
                </p>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                إجمالي السلف: {totals.totalAdvances.toLocaleString()} ج.م
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-white border-b text-gray-600">
                    <th className="p-3 font-bold">التاريخ</th>
                    <th className="p-3 font-bold">البيان / الوصف</th>
                    <th className="p-3 font-bold">التصنيف</th>
                    <th className="p-3 font-bold text-amber-700">المبلغ المخصوم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {advances.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-600 font-medium">
                        {new Date(a.created_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="p-3 text-gray-800 font-medium">{a.description || 'سلفة / مسحوبات طبيب'}</td>
                      <td className="p-3 text-gray-500">{a.category === 'advances' ? 'سلفة' : 'أجور ومستحقات'}</td>
                      <td className="p-3 font-black text-amber-700" dir="ltr">
                        - {Number(a.amount || 0).toLocaleString()} ج.م
                      </td>
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
