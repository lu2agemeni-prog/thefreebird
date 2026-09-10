'use client';

// ============================================================================
// components/dashboards/manager/DoctorDetail.tsx
// ملف الطبيب داخل لوحة المدير — يفتح عند الضغط على كارت الطبيب:
//   1) تعديل بيانات الطبيب (اسم/هاتف/تخصص/نبذة/سعر الكشف/أيام العمل)
//   2) تخصيص عيادة أو أكثر من عيادة للطبيب (جدول doctor_clinics الجديد)
//   3) التقارير: المالية الخاصة بالطبيب + تقارير عياداته (مواعيد/نداء/إيرادات)
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS,
  CALL_QUEUE_STATUS_COLORS, CALL_QUEUE_STATUS_LABELS,
  TRANSACTION_TYPE_COLORS, TRANSACTION_TYPE_LABELS,
  toAppointmentStatus, toCallQueueStatus, toTransactionType,
  WEEK_DAYS, workingDaysLabel,
} from '@/lib/types';
import {
  Loader2, ArrowRight, Save, Building, CalendarDays, Wallet, Stethoscope,
  CheckCircle2, Download, ClipboardList, ChevronDown, Activity,
} from 'lucide-react';

const FETCH_CAP = 2000;
const PAGE_SIZE = 10;

type DoctorRecord = {
  profile_id: string;
  clinic_id?: string | null;
  specialty?: string | null;
  working_days?: number[] | null;
  consultation_fee?: number | null;
  bio?: string | null;
};

type DoctorWithProfile = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  role?: string | null;
  doctor?: DoctorRecord | null;
};

type ClinicRecord = { id: string; name: string; description?: string | null; is_active?: boolean };

export function DoctorDetail({ doctor, clinics, onBack, onChanged }: {
  doctor: DoctorWithProfile;
  clinics: ClinicRecord[];
  onBack: () => void;
  onChanged: () => void;
}) {
  // ===== 1) تعديل البيانات =====
  const [firstName, setFirstName] = useState(doctor.first_name || '');
  const [lastName, setLastName] = useState(doctor.last_name || '');
  const [phone, setPhone] = useState(doctor.phone || '');
  const [specialty, setSpecialty] = useState(doctor.doctor?.specialty || '');
  const [bio, setBio] = useState(doctor.doctor?.bio || '');
  const [fee, setFee] = useState(doctor.doctor?.consultation_fee ? String(doctor.doctor.consultation_fee) : '');
  const [workingDays, setWorkingDays] = useState<number[]>(
    Array.isArray(doctor.doctor?.working_days) ? doctor.doctor!.working_days!.filter((d: unknown): d is number => typeof d === 'number') : []
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);

  // ===== 2) العيادات المسندة =====
  const [assignedClinicIds, setAssignedClinicIds] = useState<string[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [savingClinics, setSavingClinics] = useState(false);
  const [clinicsError, setClinicsError] = useState<string | null>(null);
  const [clinicsOk, setClinicsOk] = useState<string | null>(null);

  // ===== 3) التقارير =====
  const [reportTab, setReportTab] = useState<'financial' | 'clinics'>('financial');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportSearch, setReportSearch] = useState('');
  const [reportPage, setReportPage] = useState(0);
  useEffect(() => { setReportPage(0); }, [reportSearch, reportTab]);

  const doctorName = `د. ${doctor.first_name} ${doctor.last_name}`;

  // ---- تحميل العيادات المسندة (doctor_clinics + fallback للعمود القديم) ----
  const fetchAssignments = async () => {
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    const ids = new Set<string>();
    // fallback: العمود القديم clinic_id
    if (doctor.doctor?.clinic_id) ids.add(doctor.doctor.clinic_id);
    // الجدول الجديد (إن وُجد بعد الهجرة)
    const { data, error } = await supabase
      .from('doctor_clinics')
      .select('clinic_id')
      .eq('doctor_id', doctor.id)
      .limit(200);
    if (error) {
      // الجدول غير موجود بعد (لم تُنفَّذ الهجرة) → نكتفي بالعمود القديم
      if (error.code !== 'PGRST106' && error.code !== '42P01') {
        setAssignmentsError(getFriendlyErrorMessage(error, 'تعذر تحميل عيادات الطبيب.'));
      }
    } else if (data) {
      data.forEach((row: any) => ids.add(row.clinic_id));
    }
    setAssignedClinicIds(Array.from(ids));
    setAssignmentsLoading(false);
  };

  useEffect(() => { fetchAssignments(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [doctor.id]);

  // ---- تحميل التقارير ----
  const fetchReports = async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const [txRes, apRes, qRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', doctor.id).order('created_at', { ascending: false }).limit(FETCH_CAP),
        supabase.from('appointments')
          .select('*, patient:patient_id(first_name, last_name), clinics(name), doctor:doctor_id(profiles(first_name, last_name))')
          .eq('doctor_id', doctor.id).order('created_at', { ascending: false }).limit(FETCH_CAP),
        supabase.from('call_queue').select('*, clinics(name), service:service_id(name, price)').order('created_at', { ascending: false }).limit(FETCH_CAP),
      ]);
      if (txRes.error) throw txRes.error;
      if (apRes.error) throw apRes.error;
      if (qRes.error) throw qRes.error;
      setTransactions(txRes.data || []);
      setAppointments(apRes.data || []);
      setQueue((qRes.data || []).filter((q: any) => q.doctor_id === doctor.id));
    } catch (err) {
      setReportsError(getFriendlyErrorMessage(err, 'تعذر تحميل تقارير الطبيب.'));
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => { fetchReports(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [doctor.id]);

  // ---- حفظ تعديلات الملف ----
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileOk(null);
    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('يرجى إدخال الاسم الأول والأخير.');
      return;
    }
    setSavingProfile(true);

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null })
      .eq('id', doctor.id);

    const doctorRow = {
      specialty: specialty.trim() || null,
      bio: bio.trim() || null,
      working_days: workingDays.length ? workingDays : null,
      consultation_fee: fee && !isNaN(Number(fee)) ? Number(fee) : null,
    };

    let doctorErr: any = null;
    if (doctor.doctor) {
      const res = await supabase.from('doctors').update(doctorRow).eq('profile_id', doctor.id);
      doctorErr = res.error;
    } else {
      const res = await supabase.from('doctors').insert([{ profile_id: doctor.id, clinic_id: null, ...doctorRow }]);
      doctorErr = res.error;
    }

    setSavingProfile(false);
    if (!profileErr && !doctorErr) {
      setProfileOk('تم حفظ بيانات الطبيب بنجاح.');
      onChanged();
    } else {
      setProfileError(getFriendlyErrorMessage(profileErr || doctorErr, 'تعذر حفظ بيانات الطبيب.'));
    }
  };

  // ---- تفعيل/إلغاء عيادة للطبيب ----
  const toggleClinic = (clinicId: string) => {
    setAssignedClinicIds((prev) =>
      prev.includes(clinicId) ? prev.filter((id) => id !== clinicId) : [...prev, clinicId]
    );
    setClinicsOk(null);
    setClinicsError(null);
  };

  // ---- حفظ العيادات المسندة (سحب ثم إدراج) ----
  const handleSaveClinics = async () => {
    setSavingClinics(true);
    setClinicsError(null);
    setClinicsOk(null);
    try {
      // مزامنة الجدول الجديد إن وُجد
      const { error: delErr } = await supabase.from('doctor_clinics').delete().eq('doctor_id', doctor.id);
      if (delErr && delErr.code !== 'PGRST106' && delErr.code !== '42P01') throw delErr;

      if (assignedClinicIds.length > 0) {
        const rows = assignedClinicIds.map((clinic_id, i) => ({
          doctor_id: doctor.id,
          clinic_id,
          is_primary: i === 0,
        }));
        const { error: insErr } = await supabase.from('doctor_clinics').insert(rows);
        if (insErr && insErr.code !== 'PGRST106' && insErr.code !== '42P01') throw insErr;
      }

      // العمود القديم = أول عيادة (توافقًا مع باقي التطبيق: سكرتارية/حجز/نداء)
      const primary = assignedClinicIds[0] || null;
      const { error: docErr } = await supabase.from('doctors').update({ clinic_id: primary }).eq('profile_id', doctor.id);
      if (docErr) throw docErr;

      setClinicsOk(`تم حفظ العيادات (${assignedClinicIds.length}).`);
      onChanged();
      fetchAssignments();
    } catch (err) {
      setClinicsError(getFriendlyErrorMessage(err, 'تعذر حفظ عيادات الطبيب.'));
    } finally {
      setSavingClinics(false);
    }
  };

  // ---- إحصاءات مالية ----
  const totalIncome = useMemo(
    () => transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0),
    [transactions]
  );
  const totalExpense = useMemo(
    () => transactions.filter((t) => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0),
    [transactions]
  );
  const completedAppointments = useMemo(() => appointments.filter((a) => a.status === 'completed').length, [appointments]);

  // ---- تصفية التقارير ----
  const q = reportSearch.trim().toLowerCase();
  const filteredTransactions = useMemo(() => {
    if (!q) return transactions;
    return transactions.filter((t) =>
      (t.description || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q)
    );
  }, [transactions, q]);

  const filteredAppointments = useMemo(() => {
    if (!q) return appointments;
    return appointments.filter((a) => {
      const patient = a.patient ? `${a.patient.first_name} ${a.patient.last_name}`.toLowerCase() : '';
      const clinic = (a.clinics?.name || '').toLowerCase();
      return patient.includes(q) || clinic.includes(q) || (a.status || '').toLowerCase().includes(q);
    });
  }, [appointments, q]);

  const filteredQueue = useMemo(() => {
    if (!q) return queue;
    return queue.filter((item: any) =>
      (item.patient_name || '').toLowerCase().includes(q) || (item.clinics?.name || '').toLowerCase().includes(q)
    );
  }, [queue, q]);

  const txSafePage = Math.min(reportPage, Math.max(0, Math.ceil(filteredTransactions.length / PAGE_SIZE) - 1));
  const apSafePage = Math.min(reportPage, Math.max(0, Math.ceil(filteredAppointments.length / PAGE_SIZE) - 1));
  const qSafePage = Math.min(reportPage, Math.max(0, Math.ceil(filteredQueue.length / PAGE_SIZE) - 1));

  // ---- تصدير CSV ----
  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) =>
      Object.values(row).map((val) => {
        if (val === null || val === undefined) return '""';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers + '\n' + rows.join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', filename + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const assignedClinicNames = assignedClinicIds
    .map((id) => clinics.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* رأس الملف مع زر العودة */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-sm bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg transition-colors">
            <ArrowRight className="w-4 h-4" />
            رجوع للأطباء
          </button>
          {doctor.avatar_url ? (
            <Image src={doctor.avatar_url} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover border-2 border-emerald-100" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold border-2 border-emerald-100">
              {doctor.first_name?.[0]}
            </div>
          )}
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{doctorName}</h3>
            <p className="text-sm text-gray-500">{specialty || 'بدون تخصص محدد'}{doctor.phone ? ` — ${doctor.phone}` : ''}</p>
          </div>
        </div>
      </div>

      {/* ====== تعديل البيانات ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-emerald-600" />
            تعديل بيانات الطبيب
          </CardTitle>
          <CardDescription>الاسم والهاتف والتخصص وسعر الكشف وأيام العمل — تظهر للمرضى في صفحة الأطباء</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الاسم الأول</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full border rounded-lg p-3 text-sm outline-none focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الاسم الأخير</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full border rounded-lg p-3 text-sm outline-none focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">التخصص</label>
                <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="w-full border rounded-lg p-3 text-sm outline-none focus:border-emerald-500" placeholder="مثال: أخصائي باطنة" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">رقم الهاتف</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="w-full border rounded-lg p-3 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">سعر الكشف (ج.م)</label>
                <input type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} dir="ltr" className="w-full border rounded-lg p-3 text-sm outline-none focus:border-emerald-500" placeholder="200" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">نبذة عن الطبيب</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full border rounded-lg p-3 text-sm outline-none focus:border-emerald-500" placeholder="خبرات الطبيب وشهاداته..." />
              </div>
            </div>

            {/* أيام العمل */}
            <div className="border rounded-xl p-4 bg-gray-50/60">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="w-5 h-5 text-emerald-600" />
                <label className="text-sm font-bold text-gray-700">أيام العمل</label>
              </div>
              <p className="text-xs text-gray-500 mb-3">الحالي: {workingDaysLabel(workingDays)} — تُستخدم للتحقق من تعارض المواعيد.</p>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((day) => {
                  const active = workingDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => setWorkingDays((prev) => (active ? prev.filter((d) => d !== day.value) : [...prev, day.value].sort((a, b) => a - b)))}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors border ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}
                      aria-pressed={active}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {profileError && <InlineError message={profileError} />}
            {profileOk && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {profileOk}
              </div>
            )}
            <button type="submit" disabled={savingProfile} className="bg-emerald-600 text-white font-bold py-2.5 px-8 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50">
              {savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              حفظ التعديلات
            </button>
          </form>
        </CardContent>
      </Card>

      {/* ====== تخصيص العيادات ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-600" />
            عيادات الطبيب
          </CardTitle>
          <CardDescription>
            خصّص عيادة أو أكثر من عيادات للطبيب — أول عيادة تُختار تصبح العيادة الرئيسية (تُستخدم في الحجز والنداء الآلي).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsError && <InlineError message={assignmentsError} />}
          {assignmentsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {clinics.map((c) => {
                  const active = assignedClinicIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClinic(c.id)}
                      className={`text-right border rounded-xl p-4 transition-all flex items-center justify-between gap-2 ${active ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200' : 'border-gray-200 bg-white hover:border-emerald-200'}`}
                      aria-pressed={active}
                    >
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.description || 'بدون وصف'}</p>
                        {!c.is_active && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-1 inline-block">غير نشطة</span>}
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'}`}>
                        {active && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  );
                })}
                {clinics.length === 0 && <p className="text-gray-500 text-sm">لا توجد عيادات — أضف عيادة أولًا من تبويب العيادات.</p>}
              </div>

              <div className="mt-4 text-sm text-gray-600">
                المسندة حاليًا: {assignedClinicNames.length ? assignedClinicNames.join('، ') : 'لا شيء'}
              </div>

              {clinicsError && <InlineError message={clinicsError} />}
              {clinicsOk && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold mt-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  {clinicsOk}
                </div>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button onClick={handleSaveClinics} disabled={savingClinics} className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                  {savingClinics ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  حفظ العيادات
                </button>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <ChevronDown className="w-4 h-4" />
                  {assignedClinicIds.length} مختارة
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ====== التقارير ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            تقارير الطبيب
          </CardTitle>
          <CardDescription>التقارير المالية الخاصة بالطبيب + تقارير عياداته (مواعيد ونداء وإيرادات)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* أزرار التقارير الفرعية */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setReportTab('financial')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${reportTab === 'financial' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              التقارير المالية
            </button>
            <button onClick={() => setReportTab('clinics')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${reportTab === 'clinics' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              تقارير العيادات
            </button>
          </div>

          {reportsError && <ErrorState message={reportsError} onRetry={fetchReports} compact />}
          {reportsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
          ) : reportTab === 'financial' ? (
            <>
              {/* ملخص مالي */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-xl p-4 bg-emerald-50/50">
                  <p className="text-xs text-gray-500 font-bold mb-1">إجمالي الإيرادات</p>
                  <p className="text-2xl font-bold text-emerald-700" dir="ltr">{totalIncome.toLocaleString('ar-EG')} ج.م</p>
                </div>
                <div className="border rounded-xl p-4 bg-red-50/50">
                  <p className="text-xs text-gray-500 font-bold mb-1">إجمالي المصروفات/المرتبات</p>
                  <p className="text-2xl font-bold text-red-700" dir="ltr">{totalExpense.toLocaleString('ar-EG')} ج.م</p>
                </div>
                <div className="border rounded-xl p-4 bg-blue-50/50">
                  <p className="text-xs text-gray-500 font-bold mb-1">كشوفات مكتملة</p>
                  <p className="text-2xl font-bold text-blue-700">{completedAppointments.toLocaleString('ar-EG')}</p>
                </div>
              </div>

              <div className="max-w-md">
                <SearchInput value={reportSearch} onValueChange={setReportSearch} placeholder="ابحث بالوصف أو التصنيف..." />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="p-3 font-semibold text-gray-600 text-sm">التاريخ</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">النوع</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">التصنيف</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">المبلغ</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">البيان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.slice(txSafePage * PAGE_SIZE, txSafePage * PAGE_SIZE + PAGE_SIZE).map((t) => (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${TRANSACTION_TYPE_COLORS[toTransactionType(t.type)]}`}>
                            {TRANSACTION_TYPE_LABELS[toTransactionType(t.type)]}
                          </span>
                        </td>
                        <td className="p-3 text-sm">{t.category}</td>
                        <td className="p-3 font-bold" dir="ltr">{t.amount} EGP</td>
                        <td className="p-3 text-sm text-gray-600">{t.description}</td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-gray-500 text-sm">لا توجد حركات مالية لهذا الطبيب</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={txSafePage} pageSize={PAGE_SIZE} total={filteredTransactions.length} onPageChange={setReportPage} isLoading={reportsLoading} />
              <button onClick={() => exportToCSV(transactions, `تقرير_مالي_${doctor.first_name}_${doctor.last_name}`)} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-200">
                <Download className="w-4 h-4" />
                تصدير Excel
              </button>
            </>
          ) : (
            <>
              <div className="max-w-md">
                <SearchInput value={reportSearch} onValueChange={setReportSearch} placeholder="ابحث باسم المريض أو العيادة..." />
              </div>

              {/* مواعيد عيادات الطبيب */}
              <h4 className="font-bold text-gray-800 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-emerald-600" /> مواعيد الطبيب (كل عياداته)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="p-3 font-semibold text-gray-600 text-sm">التاريخ</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">المريض</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">العيادة</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.slice(apSafePage * PAGE_SIZE, apSafePage * PAGE_SIZE + PAGE_SIZE).map((a) => (
                      <tr key={a.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm text-gray-500">{new Date(a.appointment_date).toLocaleString('ar-EG')}</td>
                        <td className="p-3 text-sm font-medium">{a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : 'غير محدد'}</td>
                        <td className="p-3 text-sm">{a.clinics?.name || 'غير محدد'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${APPOINTMENT_STATUS_COLORS[toAppointmentStatus(a.status)]}`}>
                            {APPOINTMENT_STATUS_LABELS[toAppointmentStatus(a.status)]}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredAppointments.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-gray-500 text-sm">لا توجد مواعيد لهذا الطبيب</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={apSafePage} pageSize={PAGE_SIZE} total={filteredAppointments.length} onPageChange={setReportPage} isLoading={reportsLoading} />

              {/* نداء الطبيب */}
              <h4 className="font-bold text-gray-800 flex items-center gap-2 pt-2"><ActivityIcon /> حركات نداء الطبيب</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="p-3 font-semibold text-gray-600 text-sm">التاريخ</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">اسم المريض</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">العيادة</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">الخدمة</th>
                      <th className="p-3 font-semibold text-gray-600 text-sm">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.slice(qSafePage * PAGE_SIZE, qSafePage * PAGE_SIZE + PAGE_SIZE).map((item: any) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm text-gray-500">{new Date(item.created_at).toLocaleDateString('ar-EG')}</td>
                        <td className="p-3 text-sm font-medium">{item.patient_name}</td>
                        <td className="p-3 text-sm">{item.clinics?.name || 'غير محدد'}</td>
                        <td className="p-3 text-sm">{item.service?.name || item.service_custom_name || 'غير محدد'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${CALL_QUEUE_STATUS_COLORS[toCallQueueStatus(item.status)]}`}>
                            {CALL_QUEUE_STATUS_LABELS[toCallQueueStatus(item.status)]}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredQueue.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-gray-500 text-sm">لا توجد حركات نداء لهذا الطبيب</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={qSafePage} pageSize={PAGE_SIZE} total={filteredQueue.length} onPageChange={setReportPage} isLoading={reportsLoading} />

              <button onClick={() => exportToCSV(appointments, `تقرير_مواعيد_${doctor.first_name}_${doctor.last_name}`)} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-200">
                <Download className="w-4 h-4" />
                تصدير المواعيد Excel
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityIcon() {
  return <Activity className="w-4 h-4 text-emerald-600" aria-hidden="true" />;
}
