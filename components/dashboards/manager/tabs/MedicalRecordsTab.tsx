'use client';

// ============================================================================
// components/dashboards/manager/tabs/MedicalRecordsTab.tsx
// تبويب "الملفات الطبية" في لوحة تحكم المدير:
// - استعراض وبحث في ملفات المرضى المسجلين بترقيم حقيقي على مستوى قاعدة البيانات
// - جلب مباشر وسريع عبر Supabase مع احتياطي لـ API الخادم الموثق
// - نافذة تفصيلية متكاملة "عرض الملف الطبي": تستعرض الزيارات السابقة، الروشتات،
//   الحجوزات، والبيانات الشخصية مع دعم الطباعة
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { supabase } from '@/lib/supabase';
import { authFetchJson } from '@/lib/api-client';
import { 
  FileText, 
  Loader2, 
  Eye, 
  Phone, 
  Hash, 
  Calendar, 
  User, 
  Printer, 
  X, 
  Pill, 
  CalendarClock, 
  Clock, 
  Stethoscope, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

const PAGE_SIZE = 10;

interface PatientProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  patient_code?: string | null;
  created_at: string;
  avatar_url?: string | null;
}

export function MedicalRecordsTab() {
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // حالة فتح مودال الملف الطبي الكامل لمريض محدد
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      // 1) استعلام مباشر عبر Supabase مع ترقيم server-side
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, patient_code, created_at, avatar_url', { count: 'exact' })
        .eq('role', 'patient')
        .order('created_at', { ascending: false });

      if (search.trim()) {
        const q = search.trim();
        query = query.or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`
        );
      }

      const { data, count, error: sbError } = await query.range(from, to);

      if (!sbError && data) {
        setPatients(data as PatientProfile[]);
        setTotal(count || 0);
      } else {
        // 2) احتياطي: الاتصال عبر API الراوت الداخلي مع بارامترات الترقيم
        const params = new URLSearchParams({ 
          page: String(page), 
          pageSize: String(PAGE_SIZE), 
          role: 'patient' 
        });
        if (search.trim()) params.set('q', search.trim());

        const { data: apiData, error: apiErr } = await authFetchJson(`/api/manager/profiles?${params.toString()}`);
        if (apiErr) {
          setError(apiErr || 'تعذر تحميل الملفات الطبية للمرضى.');
        } else {
          setPatients(apiData?.rows || []);
          setTotal(apiData?.total || 0);
        }
      }
    } catch (err: any) {
      setError('حدث خطأ أثناء الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { 
    const t = setTimeout(fetchPatients, 0); 
    return () => clearTimeout(t); 
  }, [fetchPatients]);

  useEffect(() => { 
    const t = setTimeout(() => setPage(0), 0); 
    return () => clearTimeout(t); 
  }, [search]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <FileText className="w-6 h-6 text-emerald-600" />
                الملفات الطبية للمرضى
              </CardTitle>
              <CardDescription>
                بحث واستعراض السجلات الطبية الشاملة للمرضى والزيارات السابقة والروشتات
              </CardDescription>
            </div>
            <div className="w-full md:w-80">
              <SearchInput 
                value={search} 
                onValueChange={setSearch} 
                placeholder="ابحث بالاسم، رقم الهاتف، أو الكود الطبي..." 
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={fetchPatients} compact />}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="font-medium">جاري تحميل الملفات الطبية...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600">
                    <th className="p-4 font-semibold">الكود الطبي</th>
                    <th className="p-4 font-semibold">اسم المريض</th>
                    <th className="p-4 font-semibold">رقم الهاتف</th>
                    <th className="p-4 font-semibold">تاريخ التسجيل</th>
                    <th className="p-4 font-semibold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id} className="border-b hover:bg-gray-50/80 transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-sm font-mono">
                          {patient.patient_code || '---'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-gray-800 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {patient.first_name?.[0] || 'م'}
                          </div>
                          <span>{patient.first_name} {patient.last_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600">
                        <span dir="ltr" className="font-medium">
                          {patient.phone || 'غير مسجل'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 text-sm">
                        {patient.created_at ? new Date(patient.created_at).toLocaleDateString('ar-EG') : '---'}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => setSelectedPatient(patient)}
                          className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 text-sm font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-1.5 rounded-xl transition-all shadow-xs"
                        >
                          <Eye className="w-4 h-4" />
                          عرض الملف الطبي
                        </button>
                      </td>
                    </tr>
                  ))}

                  {patients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileText className="w-10 h-10 text-gray-300" />
                          <p className="font-semibold text-base">لا توجد ملفات طبية مطابقة للبحث</p>
                          <p className="text-xs text-gray-400">تأكد من كتابة الاسم أو رقم الهاتف بدقة</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && (
            <Pagination 
              page={page} 
              pageSize={PAGE_SIZE} 
              total={total} 
              onPageChange={setPage} 
              isLoading={loading} 
            />
          )}
        </CardContent>
      </Card>

      {/* مودال تفاصيل الملف الطبي الشامل */}
      {selectedPatient && (
        <PatientMedicalRecordModal 
          patient={selectedPatient} 
          onClose={() => setSelectedPatient(null)} 
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// مكون فرعي: مودال الملف الطبي الشامل
// ----------------------------------------------------------------------------
function PatientMedicalRecordModal({ 
  patient, 
  onClose 
}: { 
  patient: PatientProfile; 
  onClose: () => void; 
}) {
  const [activeTab, setActiveTab] = useState<'visits' | 'prescriptions' | 'appointments'>('visits');
  const [visits, setVisits] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPatientDetails() {
      setLoading(true);
      try {
        const [visitsRes, prescRes, apptsRes] = await Promise.all([
          // زيارات المريض
          supabase
            .from('patient_visits')
            .select('*, clinics(name), doctor:doctor_id(first_name, last_name)')
            .or(`patient_id.eq.${patient.id}${patient.phone ? `,patient_phone.eq.${patient.phone}` : ''}`)
            .order('visit_date', { ascending: false }),

          // روشتات المريض
          supabase
            .from('prescriptions')
            .select('*, doctor:doctor_id(first_name, last_name)')
            .eq('patient_id', patient.id)
            .order('created_at', { ascending: false }),

          // مواعيد وحجوزات المريض
          supabase
            .from('appointments')
            .select('*, clinic:clinic_id(name), doctor:doctor_id(first_name, last_name)')
            .eq('patient_id', patient.id)
            .order('appointment_date', { ascending: false }),
        ]);

        setVisits(visitsRes.data || []);
        setPrescriptions(prescRes.data || []);
        setAppointments(apptsRes.data || []);
      } catch (e) {
        console.warn('Error loading patient details:', e);
      } finally {
        setLoading(false);
      }
    }

    loadPatientDetails();
  }, [patient]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* رأس النافذة */}
        <div className="bg-emerald-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black">{patient.first_name} {patient.last_name}</h3>
                <span className="text-xs bg-emerald-900/60 text-emerald-200 px-2.5 py-0.5 rounded-full font-mono">
                  {patient.patient_code || 'بدون كود'}
                </span>
              </div>
              <p className="text-xs text-emerald-200 flex items-center gap-3 mt-1">
                {patient.phone && (
                  <span className="flex items-center gap-1" dir="ltr">
                    <Phone className="w-3.5 h-3.5" />
                    {patient.phone}
                  </span>
                )}
                <span>•</span>
                <span>تاريخ التسجيل: {new Date(patient.created_at).toLocaleDateString('ar-EG')}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors title='طباعة الملف'"
              title="طباعة"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-red-500 text-white rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* بطاقة ملخص وإحصائيات سريعة */}
        <div className="bg-emerald-50/50 border-b border-emerald-100 p-4 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-xs text-gray-500 font-bold">الزيارات والفحوصات</span>
            <p className="text-2xl font-black text-emerald-700">{visits.length}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-xs text-gray-500 font-bold">الروشتات الطبية</span>
            <p className="text-2xl font-black text-blue-700">{prescriptions.length}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-xs text-gray-500 font-bold">المواعيد السابقة</span>
            <p className="text-2xl font-black text-purple-700">{appointments.length}</p>
          </div>
        </div>

        {/* تبويبات الأقسام داخل المودال */}
        <div className="flex border-b border-gray-200 px-5 pt-3 gap-2 bg-gray-50/60">
          <button
            onClick={() => setActiveTab('visits')}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-sm transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'visits'
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            سجل الزيارات ({visits.length})
          </button>
          <button
            onClick={() => setActiveTab('prescriptions')}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-sm transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'prescriptions'
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Pill className="w-4 h-4" />
            الروشتات والعلاجات ({prescriptions.length})
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-4 py-2.5 rounded-t-xl font-bold text-sm transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'appointments'
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            المواعيد والحجوزات ({appointments.length})
          </button>
        </div>

        {/* محتوى التبويب النشط */}
        <div className="flex-1 p-5 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              <p className="text-sm font-medium">جاري استرجاع تفاصيل السجل الطبي...</p>
            </div>
          ) : (
            <>
              {/* قسم الزيارات */}
              {activeTab === 'visits' && (
                <div className="space-y-3">
                  {visits.map((v) => (
                    <div key={v.id} className="p-4 rounded-xl border border-gray-100 bg-white shadow-2xs hover:border-emerald-200 transition-all">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-5 h-5 text-emerald-600" />
                          <span className="font-bold text-gray-900">{v.service_name || 'كشف طبي'}</span>
                          {v.clinics?.name && (
                            <span className="text-xs bg-emerald-50 text-emerald-800 font-medium px-2 py-0.5 rounded-md">
                              عيادة {v.clinics.name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 font-mono">
                          {new Date(v.visit_date || v.created_at).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                      {v.doctor && (
                        <p className="text-xs text-gray-600 mt-2">
                          الطبيب المعالج: د. {v.doctor.first_name} {v.doctor.last_name}
                        </p>
                      )}
                      {v.paid_amount != null && (
                        <p className="text-xs font-bold text-emerald-700 mt-1">
                          المبلغ المدفوع: {v.paid_amount} ج.م
                        </p>
                      )}
                    </div>
                  ))}
                  {visits.length === 0 && (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      لا توجد زيارات سابقة مسجلة لهذا المريض بعد.
                    </div>
                  )}
                </div>
              )}

              {/* قسم الروشتات */}
              {activeTab === 'prescriptions' && (
                <div className="space-y-4">
                  {prescriptions.map((p) => (
                    <div key={p.id} className="p-4 rounded-xl border border-blue-100 bg-white shadow-2xs">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Pill className="w-5 h-5 text-blue-600" />
                          <span className="font-bold text-gray-900">
                            {p.diagnosis || 'روشتة علاجية'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 font-mono">
                          {new Date(p.created_at).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                      {p.doctor && (
                        <p className="text-xs text-gray-500 mb-2">
                          بواسطة: د. {p.doctor.first_name} {p.doctor.last_name}
                        </p>
                      )}
                      {p.medications && Array.isArray(p.medications) && (
                        <div className="space-y-1 mt-2">
                          <p className="text-xs font-bold text-gray-700">الأدوية الموصوفة:</p>
                          <ul className="list-disc list-inside text-xs text-gray-600 space-y-1 pr-2">
                            {p.medications.map((m: any, idx: number) => (
                              <li key={idx}>
                                <span className="font-bold">{m.name || m.medicine}</span>
                                {m.dosage ? ` - ${m.dosage}` : ''}
                                {m.frequency ? ` (${m.frequency})` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {p.notes && (
                        <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg">
                          ملاحظات: {p.notes}
                        </p>
                      )}
                    </div>
                  ))}
                  {prescriptions.length === 0 && (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      لا توجد روشتات مسجلة لهذا المريض.
                    </div>
                  )}
                </div>
              )}

              {/* قسم المواعيد */}
              {activeTab === 'appointments' && (
                <div className="space-y-3">
                  {appointments.map((a) => (
                    <div key={a.id} className="p-4 rounded-xl border border-gray-100 bg-white shadow-2xs flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-purple-600" />
                          <span className="font-bold text-sm text-gray-800">
                            {a.clinic?.name ? `عيادة ${a.clinic.name}` : 'حجز موعد'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            a.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                            a.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            a.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {a.status === 'confirmed' ? 'مؤكد' :
                             a.status === 'completed' ? 'مكتمل' :
                             a.status === 'cancelled' ? 'ملغي' : 'قيد الانتظار'}
                          </span>
                        </div>
                        {a.doctor && (
                          <p className="text-xs text-gray-500 mt-1">
                            الطبيب: د. {a.doctor.first_name} {a.doctor.last_name}
                          </p>
                        )}
                        {a.notes && (
                          <p className="text-xs text-gray-500 mt-1">{a.notes}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 font-mono">
                        {new Date(a.appointment_date).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                  ))}
                  {appointments.length === 0 && (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      لا توجد مواعيد سابقة مسجلة.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ذيل المودال */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl text-sm transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
