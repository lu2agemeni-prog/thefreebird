'use client';

// ============================================================================
// components/dashboards/manager/ClinicDetail.tsx
// ملف العيادة داخل لوحة المدير — يُفتح عند الضغط على كارت العيادة:
//   1) تعديل بيانات العيادة (الاسم / الوصف / التفعيل)
//   2) أطباء العيادة (من جدول doctor_clinics الجديد + العمود القديم clinic_id)
//   3) تقارير العيادة: المواعيد + نداء الاليكتروني (call_queue) + الخدمات
//      + ملخص مالي (إيرادات نداء الاليكتروني)
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS,
  CALL_QUEUE_STATUS_COLORS, CALL_QUEUE_STATUS_LABELS,
  toAppointmentStatus, toCallQueueStatus,
} from '@/lib/types';
import {
  Loader2, ArrowRight, Save, Building, Stethoscope, CalendarDays,
  Download, ClipboardList, Activity, CheckCircle2,
} from 'lucide-react';

const FETCH_CAP = 2000;
const PAGE_SIZE = 10;

type Clinic = {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
  audio_number?: number | null;
};

type ClinicDoctor = {
  profile_id: string;
  first_name?: string | null;
  last_name?: string | null;
  specialty?: string | null;
  phone?: string | null;
  source: 'junction' | 'legacy';
};

export function ClinicDetail({ clinic, onBack, onChanged }: {
  clinic: Clinic;
  onBack: () => void;
  onChanged: () => void;
}) {
  // ===== 1) تعديل بيانات العيادة =====
  const [name, setName] = useState(clinic.name || '');
  const [description, setDescription] = useState(clinic.description || '');
  const [isActive, setIsActive] = useState(clinic.is_active !== false);
  const [savingClinic, setSavingClinic] = useState(false);
  const [clinicError, setClinicError] = useState<string | null>(null);
  const [clinicOk, setClinicOk] = useState<string | null>(null);

  // ===== 2) أطباء العيادة =====
  const [doctors, setDoctors] = useState<ClinicDoctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);

  // ===== 3) تقارير العيادة =====
  const [appointments, setAppointments] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportSearch, setReportSearch] = useState('');
  const [reportPage, setReportPage] = useState(0);
  useEffect(() => { setReportPage(0); }, [reportSearch]);

  // ---- تحميل أطباء العيادة (الجدول الجديد + fallback للعمود القديم) ----
  const fetchDoctors = async () => {
    setDoctorsLoading(true);
    setDoctorsError(null);
    const map = new Map<string, ClinicDoctor>();
    try {
      // المصدر 1: الجدول الجديد doctor_clinics (doctor_id يشير إلى doctors → منها للـ profile)
      // ملحوظة: لازم نحدد اسم قيد الـ FK صراحةً (!doctors_profile_id_fkey)
      // لأن عمود doctors.profile_id مُستهدَف بأكتر من علاقة (appointments،
      // consultations، doctor_clinics كلها بتشاور عليه) — فلو استخدمنا
      // الهنت "profile_id" العادي، PostgREST بيرمي خطأ "more than one
      // relationship was found for 'doctors' and 'profile_id'".
      const { data: junction, error: jErr } = await supabase
        .from('doctor_clinics')
        .select('doctor_id, doctor:doctor_id(specialty, profile:profiles!doctors_profile_id_fkey(first_name, last_name, phone))')
        .eq('clinic_id', clinic.id)
        .limit(200);
      if (jErr) {
        // الجدول غير موجود بعد (لم تُنفَّذ الهجرة) → تجاهل بصمت ونكمل بالعمود القديم
        if (jErr.code !== 'PGRST106' && jErr.code !== '42P01') throw jErr;
      } else if (junction) {
        junction.forEach((row: any) => {
          if (row.doctor_id && !map.has(row.doctor_id)) {
            map.set(row.doctor_id, {
              profile_id: row.doctor_id,
              first_name: row.doctor?.profile?.first_name,
              last_name: row.doctor?.profile?.last_name,
              phone: row.doctor?.profile?.phone,
              specialty: row.doctor?.specialty,
              source: 'junction',
            });
          }
        });
      }

      // المصدر 2: العمود القديم doctors.clinic_id (توافقًا مع الإصدارات السابقة)
      const { data: legacy, error: lErr } = await supabase
        .from('doctors')
        .select('profile_id, specialty, profile:profiles!doctors_profile_id_fkey(first_name, last_name, phone)')
        .eq('clinic_id', clinic.id)
        .limit(200);
      if (lErr) throw lErr;
      if (legacy) {
        legacy.forEach((row: any) => {
          if (row.profile_id && !map.has(row.profile_id)) {
            map.set(row.profile_id, {
              profile_id: row.profile_id,
              first_name: row.profile?.first_name,
              last_name: row.profile?.last_name,
              phone: row.profile?.phone,
              specialty: row.specialty,
              source: 'legacy',
            });
          }
        });
      }

      setDoctors(Array.from(map.values()));
    } catch (err) {
      setDoctorsError(getFriendlyErrorMessage(err, 'تعذر تحميل أطباء العيادة.'));
    } finally {
      setDoctorsLoading(false);
    }
  };

  useEffect(() => { fetchDoctors(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clinic.id]);

  // ---- تحميل تقارير العيادة ----
  const fetchReports = async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const [apRes, qRes, svRes] = await Promise.all([
        supabase.from('appointments')
          .select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(profiles(first_name, last_name))')
          .eq('clinic_id', clinic.id)
          .order('created_at', { ascending: false })
          .limit(FETCH_CAP),
        supabase.from('call_queue')
          .select('*, service:service_id(name, price), doctor:doctor_id(first_name, last_name)')
          .eq('clinic_id', clinic.id)
          .order('created_at', { ascending: false })
          .limit(FETCH_CAP),
        supabase.from('services')
          .select('*')
          .eq('clinic_id', clinic.id)
          .order('name', { ascending: true })
          .limit(200),
      ]);
      if (apRes.error) throw apRes.error;
      if (qRes.error) throw qRes.error;
      if (svRes.error) throw svRes.error;
      setAppointments(apRes.data || []);
      setQueue(qRes.data || []);
      setServices(svRes.data || []);
    } catch (err) {
      setReportsError(getFriendlyErrorMessage(err, 'تعذر تحميل تقارير العيادة.'));
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => { fetchReports(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clinic.id]);

  // ---- حفظ تعديل بيانات العيادة ----
  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setClinicError(null);
    setClinicOk(null);
    if (!name.trim()) {
      setClinicError('يرجى إدخال اسم العيادة.');
      return;
    }
    setSavingClinic(true);
    const { error } = await supabase
      .from('clinics')
      .update({ name: name.trim(), description: description.trim() || null, is_active: isActive })
      .eq('id', clinic.id);
    setSavingClinic(false);
    if (error) {
      setClinicError(getFriendlyErrorMessage(error, 'تعذر حفظ بيانات العيادة.'));
    } else {
      setClinicOk('تم حفظ بيانات العيادة بنجاح.');
      onChanged();
    }
  };

  // ---- إحصائيات ----
  const completedAppointments = useMemo(
    () => appointments.filter((a) => a.status === 'completed').length, [appointments]
  );
  const queuePaidTotal = useMemo(
    () => queue.reduce((s, q) => s + Number(q.paid_amount || 0), 0), [queue]
  );
  const queueRemainingTotal = useMemo(
    () => queue.reduce((s, q) => s + Number(q.remaining_amount || 0), 0), [queue]
  );
  const servedPatients = useMemo(
    () => queue.filter((q) => q.status === 'completed').length, [queue]
  );

  // ---- تصفية التقارير ----
  const q = reportSearch.trim().toLowerCase();
  const filteredAppointments = useMemo(() => {
    if (!q) return appointments;
    return appointments.filter((a) => {
      const patient = a.patient ? `${a.patient.first_name} ${a.patient.last_name}`.toLowerCase() : '';
      const doctor = a.doctor?.profiles ? `د. ${a.doctor.profiles.first_name} ${a.doctor.profiles.last_name}`.toLowerCase() : '';
      return patient.includes(q) || doctor.includes(q) || (a.status || '').toLowerCase().includes(q);
    });
  }, [appointments, q]);

  const filteredQueue = useMemo(() => {
    if (!q) return queue;
    return queue.filter((item: any) =>
      (item.patient_name || '').toLowerCase().includes(q)
      || (item.service?.name || item.service_custom_name || '').toLowerCase().includes(q)
      || String(item.token_number || '').includes(q)
    );
  }, [queue, q]);

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

  return (
    <div className="space-y-6">
      {/* رأس الملف مع زر العودة */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-sm bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg transition-colors">
          <ArrowRight className="w-4 h-4" />
          رجوع للعيادات
        </button>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
          <Building className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{clinic.name}</h3>
          <p className="text-sm text-gray-500">
            {clinic.description || 'بدون وصف'}
            <span className={`mr-2 px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {isActive ? 'نشطة' : 'غير نشطة'}
            </span>
          </p>
        </div>
      </div>

      {/* ====== تعديل بيانات العيادة ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-600" />
            تعديل بيانات العيادة
          </CardTitle>
          <CardDescription>الاسم والوصف وحالة التفعيل — تظهر للمرضى عند الحجز</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveClinic} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">اسم العيادة</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg p-3 text-sm outline-none focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الوصف (اختياري)</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-lg p-3 text-sm outline-none focus:border-emerald-500" placeholder="وصف مختصر للعيادة..." />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-5 h-5 accent-emerald-600" />
              العيادة نشطة ومتاحة للحجز
            </label>
            {clinicError && <InlineError message={clinicError} />}
            {clinicOk && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {clinicOk}
              </p>
            )}
            <button type="submit" disabled={savingClinic} className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50">
              {savingClinic ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              حفظ التعديلات
            </button>
          </form>
        </CardContent>
      </Card>

      {/* ====== أطباء العيادة ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-emerald-600" />
            أطباء العيادة ({doctors.length})
          </CardTitle>
          <CardDescription>الأطباء المرتبطون بهذه العيادة — لإضافة أو إزالة طبيب استخدم ملف الطبيب من تبويب الأطباء</CardDescription>
        </CardHeader>
        <CardContent>
          {doctorsError && <ErrorState message={doctorsError} onRetry={fetchDoctors} compact />}
          {doctorsLoading ? (
            <p className="text-gray-500 py-4">جاري تحميل أطباء العيادة...</p>
          ) : doctors.length === 0 ? (
            <p className="text-gray-500 py-4">لا يوجد أطباء مرتبطون بهذه العيادة. يمكنك ربط طبيب من ملف الطبيب في تبويب الأطباء.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doc) => (
                <div key={doc.profile_id} className="border p-4 rounded-xl flex items-center gap-3 bg-white shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-lg font-bold shrink-0">
                    {doc.first_name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-900 truncate">د. {doc.first_name} {doc.last_name}</h4>
                    <p className="text-xs text-gray-500 truncate">{doc.specialty || 'بدون تخصص محدد'}</p>
                    {doc.phone && <p className="text-xs text-gray-400" dir="ltr">{doc.phone}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== تقارير العيادة ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            تقارير العيادة
          </CardTitle>
          <CardDescription>مواعيد العيادة وحركات نداء الاليكتروني (call_queue) والخدمات المتاحة</CardDescription>
          <div className="mt-3 max-w-md">
            <SearchInput value={reportSearch} onValueChange={setReportSearch} placeholder="ابحث داخل تقارير العيادة..." />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {reportsError && <ErrorState message={reportsError} onRetry={fetchReports} compact />}
          {reportsLoading ? (
            <p className="text-gray-500 py-4">جاري تحميل تقارير العيادة...</p>
          ) : (
            <>
              {/* ملخص إحصائي */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{appointments.length}</p>
                  <p className="text-xs text-blue-600 font-bold mt-1">إجمالي المواعيد</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{completedAppointments}</p>
                  <p className="text-xs text-emerald-600 font-bold mt-1">كشوفات مكتملة</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-orange-700">{queuePaidTotal} ج.م</p>
                  <p className="text-xs text-orange-600 font-bold mt-1">محصل من نداء الاليكتروني</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{queueRemainingTotal} ج.م</p>
                  <p className="text-xs text-red-600 font-bold mt-1">مبالغ متبقية</p>
                </div>
              </div>

              {/* جدول المواعيد */}
              <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    مواعيد العيادة ({appointments.length})
                  </h4>
                  <button onClick={() => exportToCSV(filteredAppointments, `تقارير_عيادة_${clinic.name}_المواعيد`)} className="flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200">
                    <Download className="w-3.5 h-3.5" /> تصدير CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="p-3 font-semibold text-gray-600 text-sm">التاريخ</th>
                        <th className="p-3 font-semibold text-gray-600 text-sm">المريض</th>
                        <th className="p-3 font-semibold text-gray-600 text-sm">الطبيب</th>
                        <th className="p-3 font-semibold text-gray-600 text-sm">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.length === 0 ? (
                        <tr><td colSpan={4} className="text-center p-4 text-gray-500 text-sm">لا توجد مواعيد في هذه العيادة</td></tr>
                      ) : filteredAppointments.slice(apSafePage * PAGE_SIZE, apSafePage * PAGE_SIZE + PAGE_SIZE).map((a) => (
                        <tr key={a.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm text-gray-500">{new Date(a.appointment_date).toLocaleString('ar-EG')}</td>
                          <td className="p-3 text-sm font-medium">{a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : 'غير محدد'}</td>
                          <td className="p-3 text-sm text-gray-600">{a.doctor?.profiles ? `د. ${a.doctor.profiles.first_name} ${a.doctor.profiles.last_name}` : 'غير محدد'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${APPOINTMENT_STATUS_COLORS[toAppointmentStatus(a.status)]}`}>
                              {APPOINTMENT_STATUS_LABELS[toAppointmentStatus(a.status)]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={apSafePage} pageSize={PAGE_SIZE} total={filteredAppointments.length} onPageChange={setReportPage} isLoading={reportsLoading} />
              </div>

              {/* حركات نداء الاليكتروني */}
              <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    نداء الاليكتروني (call_queue) ({queue.length}) — تم خدمة {servedPatients}
                  </h4>
                  <button onClick={() => exportToCSV(filteredQueue, `تقارير_عيادة_${clinic.name}_النداء`)} className="flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200">
                    <Download className="w-3.5 h-3.5" /> تصدير CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="p-3 font-semibold text-gray-600 text-sm">التاريخ</th>
                        <th className="p-3 font-semibold text-gray-600 text-sm">الاسم</th>
                        <th className="p-3 font-semibold text-gray-600 text-sm">الدور</th>
                        <th className="p-3 font-semibold text-gray-600 text-sm">الخدمة</th>
                        <th className="p-3 font-semibold text-gray-600 text-sm">مدفوع</th>
                        <th className="p-3 font-semibold text-gray-600 text-sm">متبقي</th>
                        <th className="p-3 font-semibold text-gray-600 text-sm">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueue.length === 0 ? (
                        <tr><td colSpan={7} className="text-center p-4 text-gray-500 text-sm">لا توجد حركات نداء في هذه العيادة</td></tr>
                      ) : filteredQueue.slice(qSafePage * PAGE_SIZE, qSafePage * PAGE_SIZE + PAGE_SIZE).map((item: any) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm text-gray-500">{new Date(item.created_at).toLocaleString('ar-EG')}</td>
                          <td className="p-3 text-sm font-medium">{item.patient_name}</td>
                          <td className="p-3 text-sm font-bold text-emerald-600" dir="ltr">#{item.token_number}</td>
                          <td className="p-3 text-sm text-gray-600">{item.service?.name || item.service_custom_name || 'غير محدد'}</td>
                          <td className="p-3 text-sm font-bold text-emerald-700" dir="ltr">{item.paid_amount || 0}</td>
                          <td className="p-3 text-sm font-bold text-red-600" dir="ltr">{item.remaining_amount || 0}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${CALL_QUEUE_STATUS_COLORS[toCallQueueStatus(item.status)]}`}>
                              {CALL_QUEUE_STATUS_LABELS[toCallQueueStatus(item.status)]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={qSafePage} pageSize={PAGE_SIZE} total={filteredQueue.length} onPageChange={setReportPage} isLoading={reportsLoading} />
              </div>

              {/* خدمات العيادة */}
              <div>
                <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                  <ClipboardList className="w-4 h-4 text-blue-600" />
                  خدمات هذه العيادة ({services.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {services.length === 0 ? (
                    <p className="text-gray-500 text-sm">لا توجد خدمات خاصة بهذه العيادة.</p>
                  ) : services.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between border rounded-lg px-4 py-2.5 bg-white">
                      <span className="font-bold text-sm text-gray-800">{s.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-emerald-600 text-sm" dir="ltr">{s.price} ج.م</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {s.is_active ? 'مفعلة' : 'معطلة'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
