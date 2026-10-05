'use client';

// ============================================================================
// components/dashboards/manager/DoctorDetail.tsx
// ملف الطبيب داخل لوحة المدير — يفتح عند الضغط على كارت الطبيب:
//   1) تعديل بيانات الطبيب (اسم/هاتف/تخصص/نبذة/سعر الكشف/أيام العمل)
//   2) تخصيص عيادة أو أكثر من عيادة للطبيب (جدول doctor_clinics الجديد)
//   3) التقارير: المالية الخاصة بالطبيب + تقارير عياداته (مواعيد/نداء/إيرادات)
// ============================================================================

import { useEffect, useMemo, useState, useCallback } from 'react';
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
  CheckCircle2, Download, ClipboardList, ChevronDown, Activity, RefreshCw, UserCheck, UserX,
} from 'lucide-react';
import {
  parseDoctorMediaMeta,
  calculateDoctorPresence,
  toggleDoctorPresenceUnified,
  resetDoctorPresenceToScheduleUnified,
  saveDoctorUnifiedProfileAndSchedule,
  extractWorkingDaysFromSchedules,
  DoctorShift,
  DAYS_OF_WEEK,
  formatTime12h,
} from '@/lib/doctor-schedules';
import { Clock, Sparkles, Check, ToggleLeft, ToggleRight } from 'lucide-react';

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

  // تفسير الميتا والمواعيد من مصدر الحقيقة الموحد
  const initialMeta = useMemo(() => {
    return parseDoctorMediaMeta(doctor.doctor?.bio, doctor.doctor?.working_days);
  }, [doctor.doctor?.bio, doctor.doctor?.working_days]);

  const [bio, setBio] = useState(initialMeta.bio_text || '');
  const [fee, setFee] = useState(doctor.doctor?.consultation_fee ? String(doctor.doctor.consultation_fee) : '');
  const [schedules, setSchedules] = useState<DoctorShift[]>(initialMeta.schedules);
  const [workingDays, setWorkingDays] = useState<number[]>(
    Array.isArray(doctor.doctor?.working_days) && doctor.doctor!.working_days!.length > 0
      ? doctor.doctor!.working_days!.filter((d: unknown): d is number => typeof d === 'number')
      : extractWorkingDaysFromSchedules(initialMeta.schedules)
  );

  // السجل الحي لحالة تواجد الطبيب
  const [liveDoctorRecord, setLiveDoctorRecord] = useState<any>(doctor.doctor || null);
  const [presenceActionLoading, setPresenceActionLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);

  // جلب ومزامنة حالة تواجد وسجلات الطبيب الحية
  const refreshDoctorPresence = useCallback(async () => {
    const { data } = await supabase
      .from('doctors')
      .select('*')
      .eq('profile_id', doctor.id)
      .maybeSingle();

    if (data) {
      setLiveDoctorRecord(data);
    }
  }, [doctor.id]);

  useEffect(() => {
    refreshDoctorPresence();
    const ch = supabase
      .channel(`doctor_detail_presence_${doctor.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctors', filter: `profile_id=eq.${doctor.id}` },
        () => {
          refreshDoctorPresence();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [doctor.id, refreshDoctorPresence]);

  // حساب التواجد الحي من السجل الموحد
  const presence = calculateDoctorPresence(
    liveDoctorRecord || { is_present: false, bio: null, working_days: workingDays }
  );

  // تبديل حالة التواجد يدوياً للطبيب
  const handleToggleLivePresence = async () => {
    setPresenceActionLoading(true);
    setProfileError(null);
    const targetPresence = !presence.isPresent;
    const res = await toggleDoctorPresenceUnified(supabase, doctor.id, targetPresence);
    setPresenceActionLoading(false);

    if (!res.success) {
      setProfileError(res.error || 'تعذر تغيير حالة التواجد.');
    } else {
      setProfileOk(
        `تم ${targetPresence ? 'تسجيل الطبيب كمتواجد الآن' : 'تسجيل الطبيب كغير متواجد'} بنجاح وتحديث النداء الآلي وكافة الشاشات.`
      );
      refreshDoctorPresence();
      onChanged();
    }
  };

  // استعادة التواجد التلقائي وفق جدول المواعيد
  const handleResetLiveSchedule = async () => {
    setPresenceActionLoading(true);
    setProfileError(null);
    const res = await resetDoctorPresenceToScheduleUnified(supabase, doctor.id);
    setPresenceActionLoading(false);

    if (!res.success) {
      setProfileError(res.error || 'تعذر استعادة التواجد وفق الجدول.');
    } else {
      setProfileOk('تمت استعادة التواجد التلقائي وفق جدول المواعيد الرسمي بنجاح وتحديث كافة الشاشات.');
      refreshDoctorPresence();
      onChanged();
    }
  };

  // تعديل مواعيد الشيفت لليوم المحدد
  const handleToggleShift = (dayIndex: number) => {
    setSchedules((prev) => {
      const updated = prev.map((s) => (s.day === dayIndex ? { ...s, enabled: !s.enabled } : s));
      const newDays = extractWorkingDaysFromSchedules(updated);
      setWorkingDays(newDays);
      return updated;
    });
  };

  const handleUpdateShiftTime = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.day === dayIndex ? { ...s, [field]: value } : s))
    );
  };

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
  useEffect(() => { const t = setTimeout(() => setReportPage(0), 0); return () => clearTimeout(t); }, [reportSearch, reportTab]);

  const doctorName = `د. ${doctor.first_name} ${doctor.last_name}`;

  // ---- تحميل العيادات المسندة (doctor_clinics + fallback للعمود القديم) ----
  async function fetchAssignments() {
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

  useEffect(() => { setTimeout(fetchAssignments, 0);   }, [doctor.id]);

  // ---- تحميل التقارير ----
  async function fetchReports() {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const [txRes, apRes, qRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', doctor.id).order('created_at', { ascending: false }).limit(FETCH_CAP),
        supabase.from('appointments')
          .select('*, patient:patient_id(first_name, last_name), clinics(name), doctor:doctor_id(profiles(first_name, last_name))')
          .eq('doctor_id', doctor.id).order('created_at', { ascending: false }).limit(FETCH_CAP),
        // كان بيجيب كل صفوف call_queue (لحد FETCH_CAP) بعدين يفلتر على
        // المتصفح — بدّلناها بفلترة .eq() على السيرفر زي باقي الاستعلامات
        supabase.from('call_queue').select('*, clinics(name), service:service_id(name, price)')
          .eq('doctor_id', doctor.id).order('created_at', { ascending: false }).limit(FETCH_CAP),
      ]);
      if (txRes.error) throw txRes.error;
      if (apRes.error) throw apRes.error;
      if (qRes.error) throw qRes.error;
      setTransactions(txRes.data || []);
      setAppointments(apRes.data || []);
      setQueue(qRes.data || []);
    } catch (err) {
      setReportsError(getFriendlyErrorMessage(err, 'تعذر تحميل تقارير الطبيب.'));
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => { setTimeout(fetchReports, 0);   }, [doctor.id]);

  // ---- حفظ تعديلات الملف والمواعيد وجدول العمل بشكل موحد ----
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileOk(null);
    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('يرجى إدخال الاسم الأول والأخير.');
      return;
    }
    setSavingProfile(true);

    try {
      // 1. تحديث الاسم ورقم الهاتف في profiles
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
        })
        .eq('id', doctor.id);

      if (profileErr) throw profileErr;

      // 2. الحفظ الموحد للملف والمواعيد وجدول الشيفتات وحالة التواجد دون فقدان أي بيانات ميديا
      const res = await saveDoctorUnifiedProfileAndSchedule(supabase, doctor.id, {
        specialty: specialty.trim() || null,
        consultation_fee: fee && !isNaN(Number(fee)) ? Number(fee) : null,
        bioText: bio.trim() || null,
        schedules,
        workingDays,
      });

      if (!res.success) {
        throw new Error(res.error || 'تعذر حفظ بيانات ومواعيد الطبيب.');
      }

      setProfileOk('تم حفظ بيانات ومواعيد الطبيب وتحديث جدول العمل وحالة التواجد في كافة الشاشات بنجاح.');
      refreshDoctorPresence();
      onChanged();
    } catch (err: any) {
      setProfileError(getFriendlyErrorMessage(err, 'تعذر حفظ بيانات الطبيب.'));
    } finally {
      setSavingProfile(false);
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
  async function handleSaveClinics() {
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
      setTimeout(fetchAssignments, 0);
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

            {/* حالة التواجد الحية ومصدر الحقيقة الموحد */}
            <div className="border rounded-2xl p-5 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-gray-50 border-emerald-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-sm">حالة التواجد ومصدر الحقيقة الموحد</h4>
                    <p className="text-xs text-gray-500">
                      متصلة لحظياً بشاشة النداء الآلي وجدول الأطباء وقوائم الانتظار
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-xs ${
                      presence.isPresent
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        presence.isPresent ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                      }`}
                    />
                    {presence.isPresent ? 'متواجد الآن' : 'غير متواجد'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-gray-600 bg-white/80 p-2.5 rounded-xl border border-emerald-100/70">
                  <span className="font-bold text-gray-700">حالة التواجد الحالية: </span>
                  <span>{presence.reasonText}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleLivePresence}
                    disabled={presenceActionLoading}
                    className={`px-3 py-2 rounded-xl font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      presence.isPresent
                        ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {presenceActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : presence.isPresent ? (
                      <UserX className="w-4 h-4" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    <span>{presence.isPresent ? 'تسجيل غياب يدوي' : 'تسجيل حضور يدوي'}</span>
                  </button>

                  {presence.source === 'manual' && (
                    <button
                      type="button"
                      onClick={handleResetLiveSchedule}
                      disabled={presenceActionLoading}
                      title="إلغاء التعديل اليدوي والعودة لجدول المواعيد التلقائي"
                      className="px-3 py-2 rounded-xl font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>استعادة الجدول التلقائي</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* جدول مواعيد وفترات وساعات العمل الأسبوعية (مصدر الحقيقة لجدول الأطباء والنداء الآلي) */}
            <div className="border rounded-2xl p-5 bg-white shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="font-black text-gray-900 text-sm">جدول مواعيد وفترات العمل الأسبوعية (الشفتات)</h4>
                    <p className="text-xs text-gray-500">
                      حدد ساعات الحضور والانصراف لكل يوم — تُحدد حالة التواجد تلقائياً في شاشة النداء وجدول الأطباء
                    </p>
                  </div>
                </div>
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                  الأيام النشطة: {workingDaysLabel(workingDays)}
                </div>
              </div>

              <div className="space-y-2.5">
                {DAYS_OF_WEEK.map((dayObj) => {
                  const shift = schedules.find((s) => s.day === dayObj.day) || {
                    id: `shift-${dayObj.day}`,
                    day: dayObj.day,
                    dayName: dayObj.name,
                    startTime: '10:00',
                    endTime: '18:00',
                    enabled: false,
                  };

                  return (
                    <div
                      key={dayObj.day}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                        shift.enabled
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-gray-50/60 border-gray-100 opacity-75'
                      }`}
                    >
                      {/* اسم اليوم وتفعيله */}
                      <div className="flex items-center gap-3 min-w-[130px]">
                        <button
                          type="button"
                          onClick={() => handleToggleShift(dayObj.day)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                            shift.enabled
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          {shift.enabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                        <span className={`font-black text-sm ${shift.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                          يوم {dayObj.name}
                        </span>
                        {shift.enabled ? (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            مجدول
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                            إجازة
                          </span>
                        )}
                      </div>

                      {/* ساعات الحضور والانصراف */}
                      {shift.enabled ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-600">من:</span>
                            <input
                              type="time"
                              value={shift.startTime}
                              onChange={(e) => handleUpdateShiftTime(dayObj.day, 'startTime', e.target.value)}
                              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white text-gray-800 focus:border-emerald-500 outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-600">إلى:</span>
                            <input
                              type="time"
                              value={shift.endTime}
                              onChange={(e) => handleUpdateShiftTime(dayObj.day, 'endTime', e.target.value)}
                              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white text-gray-800 focus:border-emerald-500 outline-none"
                            />
                          </div>

                          <span className="text-[11px] font-bold text-emerald-700 bg-white px-2 py-1 rounded-lg border border-emerald-200/80">
                            {formatTime12h(shift.startTime)} إلى {formatTime12h(shift.endTime)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">غير محدد مواعيد عمل في هذا اليوم</span>
                      )}
                    </div>
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
