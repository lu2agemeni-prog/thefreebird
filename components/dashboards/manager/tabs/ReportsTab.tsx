'use client';

// ============================================================================
// components/dashboards/manager/tabs/ReportsTab.tsx
// تبويب "التقارير الشاملة" — كل التقارير في مكان واحد:
//
//   • نظرة عامة (Overview): ملخصات أرقام للفترة المختارة (مواعيد، كشوفات،
//     إيرادات، مصروفات، صافي ربح، شكاوى، استشارات).
//   • العيادات والكشوفات: جدول المواعيد مع فلاتر (تاريخ + عيادة + طبيب + حالة).
//   • الحسابات والماليات: جدول transactions مع فلاتر (تاريخ + عيادة + نوع)
//     + ملخص (إيرادات/مصروفات/صافي).
//   • الشكاوى والمقترحات: فلاتر (تاريخ + نوع + حالة).
//   • الاستشارات الطبية: فلاتر (تاريخ + طبيب).
//   • تقارير الأطباء: DoctorReportsPanel (نظامه الخاص باليومية/الأسبوعية/الشهرية).
//
// ملاحظات هامة:
//   1. كل الفلاتر بتتطبق في السيرفر (.gte/.lte/.eq) عشان الأداء مع البيانات الكبيرة.
//   2. فلتر التاريخ مشترك بين كل التبويبات — اللي تختاره فوق بيأثر على الكل.
//   3. الفلاتر بتفضل محفوظة لما تتبادل بين التبويبات (عشان مفيش إعادة ضبط كل مرة).
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Download, Send, MessageSquare, X, Loader2, Calendar,
  Building, Stethoscope, Filter, Wallet, BarChart3, ClipboardList, MessageCircle,
  TrendingUp, TrendingDown, Activity, Users,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { getFinancialMonthBounds, getPreviousFinancialMonthBounds } from '@/lib/financialMonth';
import { SearchInput } from '@/components/ui/search-input';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  APPOINTMENT_STATUSES, COMPLAINT_STATUSES, COMPLAINT_TYPES, TRANSACTION_TYPES,
  APPOINTMENT_STATUS_LABELS, COMPLAINT_STATUS_LABELS, COMPLAINT_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
  toAppointmentStatus, toComplaintStatus, toComplaintType, toTransactionType,
  APPOINTMENT_STATUS_COLORS, COMPLAINT_STATUS_COLORS, TRANSACTION_TYPE_COLORS,
} from '@/lib/types';
import { DoctorReportsPanel } from './DoctorReportsPanel';

const PAGE_SIZE = 10;

// نفس تصنيفات "الحسابات الإضافية" (AdditionalAccountsTab) — عشان فلتر
// التصنيف في تقرير "الحسابات والماليات" يطابق نفس الأقسام اللي المدير
// بيسجل بيها القيود.
const EXPENSE_GROUP_LABELS: Record<string, string> = {
  rent_utilities: 'المصروفات',
  consumables: 'المستهلكات',
  wages: 'الأجور',
  equipment_maintenance: 'الأجهزة والصيانة والانتقالات',
  misc: 'نثريات أخرى',
};

// ---------- Helpers ----------

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'all' | 'custom';

function presetToRange(preset: DateRangePreset): { from: string; to: string } {
  const today = new Date();
  const fmt = toDateInputValue;
  if (preset === 'today') return { from: fmt(today), to: fmt(today) };
  if (preset === 'yesterday') {
    const y = new Date(today); y.setDate(today.getDate() - 1);
    return { from: fmt(y), to: fmt(y) };
  }
  if (preset === 'last7') {
    const s = new Date(today); s.setDate(today.getDate() - 6);
    return { from: fmt(s), to: fmt(today) };
  }
  if (preset === 'last30') {
    const s = new Date(today); s.setDate(today.getDate() - 29);
    return { from: fmt(s), to: fmt(today) };
  }
  if (preset === 'thisMonth') {
    // الشهر المالي الحالي: يبدأ من 21 في الشهر وينتهي في 20 من الشهر التالي
    const fin = getFinancialMonthBounds(today);
    return { from: fin.startStr, to: fin.endStr };
  }
  if (preset === 'lastMonth') {
    // الشهر المالي السابق: يبدأ من 21 وينتهي في 20
    const fin = getPreviousFinancialMonthBounds(today);
    return { from: fin.startStr, to: fin.endStr };
  }
  return { from: '2000-01-01', to: fmt(today) };
}

// ---------- CSV export ----------

function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert('لا توجد بيانات لتصديرها');
    return;
  }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row).map(val => {
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers + '\n' + rows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename + '.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------- Shared filter bar ----------

function DateRangeFilter({
  preset, setPreset, dateFrom, setDateFrom, dateTo, setDateTo,
}: {
  preset: DateRangePreset;
  setPreset: (p: DateRangePreset) => void;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
}) {
  const presetLabels: { id: DateRangePreset; label: string }[] = [
    { id: 'today', label: 'اليوم' },
    { id: 'yesterday', label: 'أمس' },
    { id: 'last7', label: 'آخر 7 أيام' },
    { id: 'thisMonth', label: 'الشهر المالي الحالي (21 - 20)' },
    { id: 'lastMonth', label: 'الشهر المالي السابق (21 - 20)' },
    { id: 'last30', label: 'آخر 30 يوم' },
    { id: 'all', label: 'الكل' },
    { id: 'custom', label: 'مخصص' },
  ];
  return (
    <Card className="print:hidden">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
          <Calendar className="w-4 h-4" />
          الفترة الزمنية
        </div>
        <div className="flex flex-wrap gap-1">
          {presetLabels.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setPreset(p.id);
                if (p.id !== 'custom') {
                  const r = presetToRange(p.id);
                  setDateFrom(r.from);
                  setDateTo(r.to);
                }
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                preset === p.id ? 'bg-emerald-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">من</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPreset('custom'); }}
            className="border rounded-lg p-2 text-sm bg-white"
          />
          <span className="text-sm text-gray-500">إلى</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPreset('custom'); }}
            className="border rounded-lg p-2 text-sm bg-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ReportsTab() {
  // ─── فلاتر مشتركة (الفترة: افتراضياً الشهر المالي الحالي 21 إلى 20) ───
  const [preset, setPreset] = useState<DateRangePreset>('thisMonth');
  const [dateFrom, setDateFrom] = useState(() => presetToRange('thisMonth').from);
  const [dateTo, setDateTo] = useState(() => presetToRange('thisMonth').to);

  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);

  // فلاتر فرعية (لكل تبويب)
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // ─── تبويبات فرعية ───
  const [reportTab, setReportTab] = useState<'overview' | 'clinics' | 'financials' | 'complaints' | 'consultations' | 'doctors'>('overview');

  // فلاتر خاصة بكل تبويب
  const [clinicFilter, setClinicFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [expenseGroupFilter, setExpenseGroupFilter] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState('');
  const [complaintTypeFilter, setComplaintTypeFilter] = useState('');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('');
  const [overviewClinicFilter, setOverviewClinicFilter] = useState('');

  // ─── البيانات ───
  const [appointments, setAppointments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // المودال: الرد على شكوى
  const [replyComplaintId, setReplyComplaintId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // ─── جلب القوائم المساعدة (العيادات + الأطباء) مرة واحدة ───
  useEffect(() => {
    let cancelled = false;
    async function fetchFiltersData() {
      const [clinicsRes, docsRes] = await Promise.all([
        supabase.from('clinics').select('id, name').order('name'),
        supabase.from('profiles').select('id, first_name, last_name').eq('role', 'doctor').order('first_name'),
      ]);
      if (cancelled) return;
      if (clinicsRes.data) setClinics(clinicsRes.data);
      if (docsRes.data) {
        setDoctors(docsRes.data.map((d: any) => ({
          id: d.id,
          name: `د. ${d.first_name || ''} ${d.last_name || ''}`.trim(),
        })));
      }
    }
    fetchFiltersData();
    return () => { cancelled = true; };
  }, []);

  // ─── جلب البيانات — السيرفر يفلتر بالتاريخ + الفلاتر الإضافية ───
  const fromIso = useMemo(() => `${dateFrom}T00:00:00`, [dateFrom]);
  const toIso = useMemo(() => `${dateTo}T23:59:59`, [dateTo]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true); setError(null);
    let q = supabase.from('appointments')
      .select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(profiles(first_name, last_name)), clinics(name)')
      .gte('appointment_date', fromIso)
      .lte('appointment_date', toIso)
      .order('appointment_date', { ascending: false });
    if (clinicFilter) q = q.eq('clinic_id', clinicFilter);
    if (doctorFilter) q = q.eq('doctor_id', doctorFilter);
    if (apptStatusFilter) q = q.eq('status', apptStatusFilter);
    const { data, error } = await q.limit(2000);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل المواعيد.'));
    else setAppointments(data || []);
    setLoading(false);
  }, [fromIso, toIso, clinicFilter, doctorFilter, apptStatusFilter]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true); setError(null);
    let q = supabase.from('transactions')
      // ملحوظة: transactions فيها علاقتين بجدول profiles (user_id و
      // beneficiary_id)، فلازم نحدد المقصود بالاسم صراحةً (!fkey) وإلا
      // Postgrest بيرفض الطلب بخطأ "more than one relationship was found".
      .select('*, profiles!transactions_user_id_fkey(first_name, last_name), beneficiary:beneficiary_id(first_name, last_name), clinics(name)')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false });
    if (txTypeFilter) q = q.eq('type', txTypeFilter);
    if (clinicFilter) q = q.eq('clinic_id', clinicFilter);
    if (expenseGroupFilter) q = q.eq('expense_group', expenseGroupFilter);
    const { data, error } = await q.limit(2000);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل المعاملات المالية.'));
    else setTransactions(data || []);
    setLoading(false);
  }, [fromIso, toIso, txTypeFilter, clinicFilter, expenseGroupFilter]);

  const fetchComplaints = useCallback(async () => {
    setLoading(true); setError(null);
    let q = supabase.from('complaints')
      .select('*, profiles(first_name, last_name)')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false });
    if (complaintTypeFilter) q = q.eq('type', complaintTypeFilter);
    if (complaintStatusFilter) q = q.eq('status', complaintStatusFilter);
    const { data, error } = await q.limit(2000);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل الشكاوى.'));
    else setComplaints(data || []);
    setLoading(false);
  }, [fromIso, toIso, complaintTypeFilter, complaintStatusFilter]);

  const fetchConsultations = useCallback(async () => {
    setLoading(true); setError(null);
    let q = supabase.from('consultations')
      .select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(profiles(first_name, last_name))')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: false });
    if (doctorFilter) q = q.eq('doctor_id', doctorFilter);
    const { data, error } = await q.limit(2000);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل الاستشارات.'));
    else setConsultations(data || []);
    setLoading(false);
  }, [fromIso, toIso, doctorFilter]);

  // عند تبديل التبويب: جلب البيانات الخاصة بيه
  useEffect(() => {
    if (reportTab === 'clinics') { const t = setTimeout(fetchAppointments, 0); return () => clearTimeout(t); }
    if (reportTab === 'financials') { const t = setTimeout(fetchTransactions, 0); return () => clearTimeout(t); }
    if (reportTab === 'complaints') { const t = setTimeout(fetchComplaints, 0); return () => clearTimeout(t); }
    if (reportTab === 'consultations') { const t = setTimeout(fetchConsultations, 0); return () => clearTimeout(t); }
    if (reportTab === 'overview') {
      // النظرة العامة بتجلب الكل معًا — لازم نجيب اسم العيادة واسم الطبيب
      // هنا كمان (كانا ناقصين قبل كده فكانت كل الأسماء بتطلع "بدون اسم")
      setLoading(true); setError(null);
      let apptQuery = supabase.from('appointments')
        .select('id, status, clinic_id, doctor_id, appointment_date, doctor:doctor_id(profiles!doctors_profile_id_fkey(first_name, last_name))')
        .gte('appointment_date', fromIso).lte('appointment_date', toIso).limit(5000);
      let txQuery = supabase.from('transactions')
        .select('id, type, amount, clinic_id, clinics(name)')
        .gte('created_at', fromIso).lte('created_at', toIso).limit(5000);
      if (overviewClinicFilter) {
        apptQuery = apptQuery.eq('clinic_id', overviewClinicFilter);
        txQuery = txQuery.eq('clinic_id', overviewClinicFilter);
      }
      Promise.all([
        apptQuery,
        txQuery,
        supabase.from('complaints').select('id, status').gte('created_at', fromIso).lte('created_at', toIso).limit(2000),
        supabase.from('consultations').select('id, status').gte('created_at', fromIso).lte('created_at', toIso).limit(2000),
      ]).then(([a, t, c, con]) => {
        if (a.error || t.error) {
          setError(getFriendlyErrorMessage(a.error || t.error, 'تعذر تحميل النظرة العامة.'));
        }
        setAppointments(a.data || []);
        setTransactions(t.data || []);
        setComplaints(c.data || []);
        setConsultations(con.data || []);
        setLoading(false);
      });
    }
  }, [reportTab, fetchAppointments, fetchTransactions, fetchComplaints, fetchConsultations, fromIso, toIso, overviewClinicFilter]);

  useEffect(() => { const t = setTimeout(() => setPage(0), 0); return () => clearTimeout(t); }, [search, reportTab, clinicFilter, doctorFilter, txTypeFilter, expenseGroupFilter, apptStatusFilter, complaintTypeFilter, complaintStatusFilter, dateFrom, dateTo]);

  // ─── فلاتر محلية (بعد الفلترة في السيرفر) — البحث النصي فقط ───
  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter(a => {
      const patient = a.patient ? `${a.patient.first_name} ${a.patient.last_name}`.toLowerCase() : '';
      const doctor = a.doctor?.profiles ? `${a.doctor.profiles.first_name} ${a.doctor.profiles.last_name}`.toLowerCase() : '';
      const clinic = (a.clinics?.name || '').toLowerCase();
      return patient.includes(q) || doctor.includes(q) || clinic.includes(q) || (a.status || '').toLowerCase().includes(q);
    });
  }, [appointments, search]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t => {
      const byUser = t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}`.toLowerCase() : '';
      const byBeneficiary = t.beneficiary ? `${t.beneficiary.first_name} ${t.beneficiary.last_name}`.toLowerCase() : '';
      const clinic = (t.clinics?.name || '').toLowerCase();
      return (t.description || '').toLowerCase().includes(q)
        || (t.category || '').toLowerCase().includes(q)
        || (t.type || '').toLowerCase().includes(q)
        || byUser.includes(q)
        || byBeneficiary.includes(q)
        || clinic.includes(q);
    });
  }, [transactions, search]);

  const filteredComplaints = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return complaints;
    return complaints.filter(c => {
      const byUser = c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}`.toLowerCase() : '';
      return (c.message || '').toLowerCase().includes(q)
        || (c.status || '').toLowerCase().includes(q)
        || (c.type || '').toLowerCase().includes(q)
        || (c.admin_reply || '').toLowerCase().includes(q)
        || byUser.includes(q);
    });
  }, [complaints, search]);

  const filteredConsultations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return consultations;
    return consultations.filter(c => {
      const patient = c.patient ? `${c.patient.first_name} ${c.patient.last_name}`.toLowerCase() : '';
      const doctor = c.doctor?.profiles ? `${c.doctor.profiles.first_name} ${c.doctor.profiles.last_name}`.toLowerCase() : '';
      return (c.message || '').toLowerCase().includes(q)
        || (c.reply || '').toLowerCase().includes(q)
        || patient.includes(q) || doctor.includes(q);
    });
  }, [consultations, search]);

  // ─── حسابات النظرة العامة ───
  const overviewStats = useMemo(() => {
    const totalAppts = appointments.length;
    const completedAppts = appointments.filter(a => a.status === 'completed').length;
    const cancelledAppts = appointments.filter(a => a.status === 'cancelled').length;
    const pendingAppts = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length;
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = transactions.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const net = income - expense;
    const openComplaints = complaints.filter(c => c.status === 'open').length;
    const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
    const pendingConsults = consultations.filter(c => c.status === 'pending').length;
    const answeredConsults = consultations.filter(c => c.status === 'answered').length;

    // أفضل العيادات (إيرادات)
    const clinicMap = new Map<string, { name: string; income: number; expense: number }>();
    transactions.forEach(t => {
      if (!t.clinic_id) return;
      const name = t.clinics?.name || 'بدون اسم';
      if (!clinicMap.has(t.clinic_id)) clinicMap.set(t.clinic_id, { name, income: 0, expense: 0 });
      const row = clinicMap.get(t.clinic_id)!;
      if (t.type === 'income') row.income += Number(t.amount || 0);
      else row.expense += Number(t.amount || 0);
    });
    const topClinics = Array.from(clinicMap.values())
      .map(c => ({ ...c, net: c.income - c.expense }))
      .sort((a, b) => b.net - a.net)
      .slice(0, 5);

    // أنشط الأطباء (عدد مواعيد)
    const docMap = new Map<string, { name: string; count: number; completed: number }>();
    appointments.forEach(a => {
      if (!a.doctor_id) return;
      const name = a.doctor?.profiles ? `د. ${a.doctor.profiles.first_name} ${a.doctor.profiles.last_name}` : 'بدون اسم';
      if (!docMap.has(a.doctor_id)) docMap.set(a.doctor_id, { name, count: 0, completed: 0 });
      const row = docMap.get(a.doctor_id)!;
      row.count += 1;
      if (a.status === 'completed') row.completed += 1;
    });
    const topDoctors = Array.from(docMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalAppts, completedAppts, cancelledAppts, pendingAppts,
      income, expense, net,
      openComplaints, resolvedComplaints,
      pendingConsults, answeredConsults,
      topClinics, topDoctors,
    };
  }, [appointments, transactions, complaints, consultations]);

  // ─── pagination helpers ───
  const safePage = (total: number) =>
    Math.min(page, Math.max(0, Math.ceil(total / PAGE_SIZE) - 1));

  // ─── reply to complaint ───
  const openReplyForm = (id: string) => {
    setReplyComplaintId(id);
    setReplyText('');
    setReplyError(null);
  };
  async function submitReply() {
    if (!replyComplaintId) return;
    if (!replyText.trim() || replyText.trim().length < 5) {
      setReplyError('يرجى كتابة رد لا يقل عن 5 أحرف.');
      return;
    }
    setReplySaving(true);
    const { error } = await supabase.from('complaints').update({ admin_reply: replyText.trim(), status: 'resolved' }).eq('id', replyComplaintId);
    setReplySaving(false);
    if (error) {
      setReplyError(getFriendlyErrorMessage(error, 'تعذر حفظ الرد.'));
    } else {
      setReplyText('');
      setReplyComplaintId(null);
      // تحديث الحالة في الـ state مباشرة
      setComplaints(prev => prev.map(c => c.id === replyComplaintId ? { ...c, admin_reply: replyText.trim(), status: 'resolved' } : c));
    }
  }

  // ─── sub-tab navigation ───
  const subTabs: { id: typeof reportTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: BarChart3 },
    { id: 'clinics', label: 'العيادات والكشوفات', icon: Building },
    { id: 'financials', label: 'الحسابات والماليات', icon: Wallet },
    { id: 'complaints', label: 'الشكاوى والمقترحات', icon: MessageCircle },
    { id: 'consultations', label: 'الاستشارات الطبية', icon: ClipboardList },
    { id: 'doctors', label: 'تقارير الأطباء', icon: Stethoscope },
  ];

  return (
    <div className="space-y-6">
      {/* 1) الفلتر الموحد للتاريخ */}
      <DateRangeFilter
        preset={preset}
        setPreset={setPreset}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
      />

      {/* 2) التبويبات الفرعية */}
      <div className="flex flex-wrap gap-2 mb-2">
        {subTabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setReportTab(t.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 ${
                reportTab === t.id ? 'bg-emerald-600 text-white shadow' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {error && <ErrorState message={error} onRetry={() => {
        if (reportTab === 'clinics') fetchAppointments();
        if (reportTab === 'financials') fetchTransactions();
        if (reportTab === 'complaints') fetchComplaints();
        if (reportTab === 'consultations') fetchConsultations();
      }} />}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* نظرة عامة */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {reportTab === 'overview' && (
        <>
          <Card className="print:hidden">
            <CardContent className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                <Building className="w-4 h-4" /> فلترة حسب العيادة
              </div>
              <select value={overviewClinicFilter} onChange={(e) => setOverviewClinicFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white min-w-[180px]">
                <option value="">كل العيادات</option>
                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {overviewClinicFilter && (
                <button onClick={() => setOverviewClinicFilter('')} className="text-xs text-emerald-700 font-bold hover:underline">
                  مسح الفلتر
                </button>
              )}
            </CardContent>
          </Card>

          {loading ? (
            <p className="text-gray-500 py-6 text-center">جاري تحميل الملخص...</p>
          ) : (
            <>
              {/* كروت الملخص الرئيسية */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Activity} color="blue" label="إجمالي المواعيد" value={overviewStats.totalAppts.toLocaleString('ar-EG')} sub={`مكتمل ${overviewStats.completedAppts} · ملغي ${overviewStats.cancelledAppts}`} />
                <StatCard icon={TrendingUp} color="emerald" label="إجمالي الإيرادات" value={`${overviewStats.income.toLocaleString('ar-EG')} ج.م`} sub={`صافي ${overviewStats.net.toLocaleString('ar-EG')} ج.م`} />
                <StatCard icon={TrendingDown} color="red" label="إجمالي المصروفات" value={`${overviewStats.expense.toLocaleString('ar-EG')} ج.م`} sub={`${overviewStats.net >= 0 ? 'ربح' : 'خسارة'} ${Math.abs(overviewStats.net).toLocaleString('ar-EG')} ج.م`} />
                <StatCard icon={MessageCircle} color="purple" label="شكاوى مفتوحة" value={overviewStats.openComplaints.toLocaleString('ar-EG')} sub={`من إجمالي ${overviewStats.openComplaints + overviewStats.resolvedComplaints}`} />
              </div>

              {/* توزيع الكشوفات */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Building className="w-5 h-5 text-emerald-600" /> أداء العيادات (صافي الربح)</CardTitle>
                    <CardDescription>ترتيب العيادات حسب صافي الربح في الفترة المختارة</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {overviewStats.topClinics.length === 0 ? (
                      <p className="text-gray-500 text-sm">لا توجد حركات مالية مرتبطة بعيادات في الفترة.</p>
                    ) : (
                      <div className="space-y-2">
                        {overviewStats.topClinics.map((c, i) => (
                          <div key={c.name} className="flex items-center gap-3 border rounded-lg p-3">
                            <span className="text-sm font-bold text-gray-500 w-6 text-center" dir="ltr">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 truncate">{c.name}</p>
                              <p className="text-xs text-gray-500">إيراد {c.income.toLocaleString('ar-EG')} · مصروف {c.expense.toLocaleString('ar-EG')}</p>
                            </div>
                            <span className={`font-black text-lg ${c.net >= 0 ? 'text-emerald-700' : 'text-orange-600'}`} dir="ltr">{c.net.toLocaleString('ar-EG')} ج.م</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Stethoscope className="w-5 h-5 text-emerald-600" /> أنشط الأطباء</CardTitle>
                    <CardDescription>الأطباء حسب عدد المواعيد في الفترة</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {overviewStats.topDoctors.length === 0 ? (
                      <p className="text-gray-500 text-sm">لا توجد مواعيد مسجلة.</p>
                    ) : (
                      <div className="space-y-2">
                        {overviewStats.topDoctors.map((d, i) => (
                          <div key={d.name} className="flex items-center gap-3 border rounded-lg p-3">
                            <span className="text-sm font-bold text-gray-500 w-6 text-center" dir="ltr">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 truncate">{d.name}</p>
                              <p className="text-xs text-gray-500">مكتمل {d.completed} من {d.count}</p>
                            </div>
                            <span className="font-black text-lg text-blue-700" dir="ltr">{d.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* إحصائيات سريعة */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat label="مواعيد نشطة" value={(overviewStats.totalAppts - overviewStats.cancelledAppts).toLocaleString('ar-EG')} color="blue" />
                <MiniStat label="كشوفات مكتملة" value={overviewStats.completedAppts.toLocaleString('ar-EG')} color="emerald" />
                <MiniStat label="استشارات في الانتظار" value={overviewStats.pendingConsults.toLocaleString('ar-EG')} color="orange" />
                <MiniStat label="استشارات تم الرد" value={overviewStats.answeredConsults.toLocaleString('ar-EG')} color="purple" />
              </div>
            </>
          )}
        </>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* العيادات والكشوفات */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {reportTab === 'clinics' && (
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-row justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><Building className="w-5 h-5 text-emerald-600" /> تقارير العيادات والكشوفات الطبية</CardTitle>
                <CardDescription>إحصائيات المواعيد والكشوفات للفترة المختارة ({filteredAppointments.length} صف)</CardDescription>
              </div>
              <button onClick={() => exportToCSV(filteredAppointments, 'تقرير_الكشوفات')} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-200">
                <Download className="w-4 h-4" /> تصدير CSV
              </button>
            </div>
            {/* فلاتر إضافية */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <Building className="w-4 h-4 text-gray-500" />
                <select value={clinicFilter} onChange={(e) => setClinicFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white min-w-[160px]">
                  <option value="">كل العيادات</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Stethoscope className="w-4 h-4 text-gray-500" />
                <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white min-w-[160px]">
                  <option value="">كل الأطباء</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Filter className="w-4 h-4 text-gray-500" />
                <select value={apptStatusFilter} onChange={(e) => setApptStatusFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white min-w-[140px]">
                  <option value="">كل الحالات</option>
                  {APPOINTMENT_STATUSES.map(s => <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <SearchInput value={search} onValueChange={setSearch} placeholder="بحث نصي..." />
              </div>
            </div>
            {(clinicFilter || doctorFilter || apptStatusFilter) && (
              <div className="flex items-center gap-2 text-xs">
                <button onClick={() => { setClinicFilter(''); setDoctorFilter(''); setApptStatusFilter(''); }} className="text-emerald-700 font-bold hover:underline">
                  مسح الفلاتر الإضافية
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                      <th className="p-4 font-semibold text-gray-600">المريض</th>
                      <th className="p-4 font-semibold text-gray-600">العيادة</th>
                      <th className="p-4 font-semibold text-gray-600">الطبيب</th>
                      <th className="p-4 font-semibold text-gray-600">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.slice(safePage(filteredAppointments.length) * PAGE_SIZE, safePage(filteredAppointments.length) * PAGE_SIZE + PAGE_SIZE).map((a) => {
                      const status = toAppointmentStatus(a.status);
                      return (
                        <tr key={a.id} className="border-b hover:bg-gray-50">
                          <td className="p-4 text-sm">{new Date(a.appointment_date).toLocaleString('ar-EG')}</td>
                          <td className="p-4 font-medium">{a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : 'غير محدد'}</td>
                          <td className="p-4">{a.clinics?.name}</td>
                          <td className="p-4 text-gray-600">{a.doctor?.profiles ? `د. ${a.doctor.profiles.first_name} ${a.doctor.profiles.last_name}` : 'غير محدد'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${APPOINTMENT_STATUS_COLORS[status]}`}>
                              {APPOINTMENT_STATUS_LABELS[status]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredAppointments.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد حجوزات أو كشوفات مطابقة للفلاتر</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && <Pagination page={safePage(filteredAppointments.length)} pageSize={PAGE_SIZE} total={filteredAppointments.length} onPageChange={setPage} isLoading={loading} />}
          </CardContent>
        </Card>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* الحسابات والماليات */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {reportTab === 'financials' && (
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-row justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-emerald-600" /> تقارير الحسابات والماليات</CardTitle>
                <CardDescription>الإيرادات والمصروفات ({filteredTransactions.length} صف)</CardDescription>
              </div>
              <button onClick={() => exportToCSV(filteredTransactions, 'التقرير_المالي')} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-200">
                <Download className="w-4 h-4" /> تصدير CSV
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="w-4 h-4 text-gray-500" />
                <select value={txTypeFilter} onChange={(e) => setTxTypeFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white min-w-[160px]">
                  <option value="">كل الأنواع</option>
                  {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <ClipboardList className="w-4 h-4 text-gray-500" />
                <select value={expenseGroupFilter} onChange={(e) => setExpenseGroupFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white min-w-[160px]">
                  <option value="">كل التصنيفات</option>
                  {Object.entries(EXPENSE_GROUP_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building className="w-4 h-4 text-gray-500" />
                <select value={clinicFilter} onChange={(e) => setClinicFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white min-w-[160px]">
                  <option value="">كل العيادات (بما فيها غير المصنفة)</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <SearchInput value={search} onValueChange={setSearch} placeholder="بحث نصي..." />
              </div>
            </div>
            {(txTypeFilter || clinicFilter || expenseGroupFilter) && (
              <button onClick={() => { setTxTypeFilter(''); setClinicFilter(''); setExpenseGroupFilter(''); }} className="text-xs text-emerald-700 font-bold hover:underline w-fit">
                مسح فلاتر المعاملات
              </button>
            )}
          </CardHeader>
          <CardContent>
            {/* ملخصات سريعة */}
            {!loading && filteredTransactions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="border rounded-xl p-3 bg-emerald-50/50">
                  <p className="text-xs font-bold text-emerald-700 mb-1">إجمالي الإيرادات</p>
                  <p className="text-lg font-black text-emerald-700" dir="ltr">
                    {filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString('ar-EG')} ج.م
                  </p>
                </div>
                <div className="border rounded-xl p-3 bg-red-50/50">
                  <p className="text-xs font-bold text-red-700 mb-1">إجمالي المصروفات/الأجور</p>
                  <p className="text-lg font-black text-red-700" dir="ltr">
                    {filteredTransactions.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString('ar-EG')} ج.م
                  </p>
                </div>
                <div className="border rounded-xl p-3 bg-blue-50/50">
                  <p className="text-xs font-bold text-blue-700 mb-1">الصافي</p>
                  <p className="text-lg font-black text-blue-700" dir="ltr">
                    {(() => {
                      const inc = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
                      const exp = filteredTransactions.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
                      return (inc - exp).toLocaleString('ar-EG') + ' ج.م';
                    })()}
                  </p>
                </div>
              </div>
            )}
            {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                      <th className="p-4 font-semibold text-gray-600">النوع</th>
                      <th className="p-4 font-semibold text-gray-600">التصنيف</th>
                      <th className="p-4 font-semibold text-gray-600">العيادة</th>
                      <th className="p-4 font-semibold text-gray-600">بواسطة</th>
                      <th className="p-4 font-semibold text-gray-600">المبلغ</th>
                      <th className="p-4 font-semibold text-gray-600">البيان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.slice(safePage(filteredTransactions.length) * PAGE_SIZE, safePage(filteredTransactions.length) * PAGE_SIZE + PAGE_SIZE).map((t) => {
                      const ttype = toTransactionType(t.type);
                      return (
                        <tr key={t.id} className="border-b hover:bg-gray-50">
                          <td className="p-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${TRANSACTION_TYPE_COLORS[ttype]}`}>
                              {TRANSACTION_TYPE_LABELS[ttype]}
                            </span>
                          </td>
                          <td className="p-4 text-sm">{t.category}</td>
                          <td className="p-4 text-sm">{t.clinics?.name || <span className="text-gray-400">—</span>}</td>
                          <td className="p-4 text-sm">
                            {t.beneficiary ? (
                              <span className="text-amber-700 font-bold">{t.beneficiary.first_name} {t.beneficiary.last_name} <span className="text-xs font-normal text-gray-400">({t.category})</span></span>
                            ) : t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : 'غير محدد'}
                          </td>
                          <td className="p-4 font-bold" dir="ltr">{t.amount} ج.م</td>
                          <td className="p-4 text-sm text-gray-600">{t.description}</td>
                        </tr>
                      );
                    })}
                    {filteredTransactions.length === 0 && (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-500">لا توجد حركات مالية مطابقة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && <Pagination page={safePage(filteredTransactions.length)} pageSize={PAGE_SIZE} total={filteredTransactions.length} onPageChange={setPage} isLoading={loading} />}
          </CardContent>
        </Card>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* الشكاوى والمقترحات */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {reportTab === 'complaints' && (
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-row justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-600" /> الشكاوى والمقترحات</CardTitle>
                <CardDescription>اطلع على شكاوى ومقترحات المرضى وقم بالرد عليها ({filteredComplaints.length} في الفترة)</CardDescription>
              </div>
              <button onClick={() => exportToCSV(filteredComplaints, 'تقرير_الشكاوى')} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200">
                <Download className="w-4 h-4" /> تصدير CSV
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <Filter className="w-4 h-4 text-gray-500" />
                <select value={complaintTypeFilter} onChange={(e) => setComplaintTypeFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white">
                  <option value="">كل الأنواع</option>
                  {COMPLAINT_TYPES.map(t => <option key={t} value={t}>{COMPLAINT_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Filter className="w-4 h-4 text-gray-500" />
                <select value={complaintStatusFilter} onChange={(e) => setComplaintStatusFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white">
                  <option value="">كل الحالات</option>
                  {COMPLAINT_STATUSES.map(s => <option key={s} value={s}>{COMPLAINT_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <SearchInput value={search} onValueChange={setSearch} placeholder="بحث نصي..." />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
              <div className="grid gap-4">
                {filteredComplaints.slice(safePage(filteredComplaints.length) * PAGE_SIZE, safePage(filteredComplaints.length) * PAGE_SIZE + PAGE_SIZE).map((c) => {
                  const cstatus = toComplaintStatus(c.status);
                  const ctype = toComplaintType(c.type);
                  return (
                    <div key={c.id} className="border rounded-xl p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${ctype === 'complaint' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {COMPLAINT_TYPE_LABELS[ctype]}
                          </span>
                          <span className="font-bold text-gray-900">{c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : 'زائر غير مسجل'}</span>
                          <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${COMPLAINT_STATUS_COLORS[cstatus]}`}>
                          {COMPLAINT_STATUS_LABELS[cstatus]}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">{c.message}</p>
                      {c.admin_reply && (
                        <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                          <p className="font-bold text-emerald-700 mb-1">رد الإدارة:</p>
                          {c.admin_reply}
                        </div>
                      )}
                      {cstatus !== 'resolved' && (
                        replyComplaintId === c.id ? (
                          <div className="mt-3 space-y-2">
                            <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} className="w-full border rounded-lg p-2 text-sm bg-white" placeholder="اكتب رد الإدارة هنا..." />
                            {replyError && <InlineError message={replyError} />}
                            <div className="flex gap-2">
                              <button onClick={submitReply} disabled={replySaving} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50">
                                {replySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                حفظ الرد وإغلاق الشكوى
                              </button>
                              <button onClick={() => setReplyComplaintId(null)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                                <X className="w-4 h-4" /> إلغاء
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => openReplyForm(c.id)} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-700">
                            <MessageSquare className="w-4 h-4" /> إضافة رد وإغلاق
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
                {filteredComplaints.length === 0 && (
                  <p className="text-gray-500 text-center py-8">لا توجد شكاوى أو مقترحات مطابقة</p>
                )}
              </div>
            )}
            {!loading && <Pagination page={safePage(filteredComplaints.length)} pageSize={PAGE_SIZE} total={filteredComplaints.length} onPageChange={setPage} isLoading={loading} />}
          </CardContent>
        </Card>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* الاستشارات الطبية */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {reportTab === 'consultations' && (
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-row justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-emerald-600" /> الاستشارات الطبية</CardTitle>
                <CardDescription>الاطلاع على الاستشارات بين المرضى والأطباء ({filteredConsultations.length} في الفترة)</CardDescription>
              </div>
              <button onClick={() => exportToCSV(filteredConsultations, 'تقرير_الاستشارات')} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200">
                <Download className="w-4 h-4" /> تصدير CSV
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <Stethoscope className="w-4 h-4 text-gray-500" />
                <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white min-w-[160px]">
                  <option value="">كل الأطباء</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <SearchInput value={search} onValueChange={setSearch} placeholder="بحث نصي..." />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-gray-500 py-4">جاري تحميل البيانات...</p> : (
              <div className="grid gap-4">
                {filteredConsultations.slice(safePage(filteredConsultations.length) * PAGE_SIZE, safePage(filteredConsultations.length) * PAGE_SIZE + PAGE_SIZE).map((c) => (
                  <div key={c.id} className="border rounded-xl p-4 bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-sm flex flex-wrap gap-2">
                        <span className="font-bold text-gray-900">المريض: {c.patient ? `${c.patient.first_name} ${c.patient.last_name}` : 'غير محدد'}</span>
                        <span className="text-emerald-700 font-bold">للطبيب: {c.doctor?.profiles ? `د. ${c.doctor.profiles.first_name} ${c.doctor.profiles.last_name}` : 'غير محدد'}</span>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-700 mb-2">
                      <p className="font-bold text-xs text-gray-500 mb-1">السؤال:</p>
                      {c.message}
                    </div>
                    {c.reply ? (
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-sm text-emerald-800">
                        <p className="font-bold text-xs text-emerald-600 mb-1">الرد الطبي:</p>
                        {c.reply}
                      </div>
                    ) : (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">في انتظار الرد</span>
                    )}
                  </div>
                ))}
                {filteredConsultations.length === 0 && (
                  <p className="text-gray-500 text-center py-8">لا توجد استشارات مطابقة</p>
                )}
              </div>
            )}
            {!loading && <Pagination page={safePage(filteredConsultations.length)} pageSize={PAGE_SIZE} total={filteredConsultations.length} onPageChange={setPage} isLoading={loading} />}
          </CardContent>
        </Card>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* تقارير الأطباء */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {reportTab === 'doctors' && <DoctorReportsPanel />}
    </div>
  );
}

// ---------- مكونات مساعدة للملخصات ----------

function StatCard({ icon: Icon, color, label, value, sub }: { icon: any; color: 'blue' | 'emerald' | 'red' | 'purple'; label: string; value: string; sub?: string }) {
  const colorMap: Record<typeof color, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };
  return (
    <div className={`border rounded-xl p-4 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-6 h-6" />
        <span className="text-xs font-bold opacity-80">{label}</span>
      </div>
      <p className="text-2xl font-black" dir="ltr">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: 'blue' | 'emerald' | 'orange' | 'purple' }) {
  const c = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  }[color];
  return (
    <div className={`border rounded-xl p-3 text-center ${c}`}>
      <p className="text-xl font-black" dir="ltr">{value}</p>
      <p className="text-xs font-bold opacity-80 mt-1">{label}</p>
    </div>
  );
}