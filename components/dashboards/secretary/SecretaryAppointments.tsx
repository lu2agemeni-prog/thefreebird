'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, User, Activity, Loader2 } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  toAppointmentStatus,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_STATUSES,
} from '@/lib/types';

const PAGE_SIZE = 10;
// سقف احتياطي عالٍ لجلب المواعيد (حجم عيادة واحد عادة أقل من ذلك بكثير)
const FETCH_CAP = 2000;

export function SecretaryAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patient_id(first_name, last_name, patient_code, phone), doctor:doctor_id(profiles(first_name, last_name)), clinic:clinic_id(name)')
      .order('appointment_date', { ascending: false })
      .limit(FETCH_CAP);

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل المواعيد.'));
    } else if (data) {
      setAppointments(data);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    if (!APPOINTMENT_STATUSES.includes(newStatus as any)) return;
    setStatusError(null);
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setAppointments(prev => prev.map(a => (a.id === id ? { ...a, status: newStatus } : a)));
    } else {
      setStatusError(getFriendlyErrorMessage(error, 'حدث خطأ أثناء تحديث حالة الموعد.'));
    }
  };

  // بحث نصي على كل الحقول المعروضة (المريض/الكود/الهاتف/العيادة/الطبيب)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter(app => {
      const patientName = `${app.patient?.first_name ?? ''} ${app.patient?.last_name ?? ''}`.toLowerCase();
      const doctorName = `د. ${app.doctor?.profiles?.first_name ?? ''} ${app.doctor?.profiles?.last_name ?? ''}`.toLowerCase();
      return (
        patientName.includes(q) ||
        (app.patient?.patient_code ?? '').toLowerCase().includes(q) ||
        (app.patient?.phone ?? '').includes(q) ||
        (app.clinic?.name ?? '').toLowerCase().includes(q) ||
        doctorName.includes(q) ||
        (APPOINTMENT_STATUS_LABELS[toAppointmentStatus(app.status)] ?? '').includes(search.trim())
      );
    });
  }, [appointments, search]);

  // إعادة الصفحة للبداية عند تغيير البحث
  useEffect(() => { setPage(0); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">إدارة جميع المواعيد</h2>
      </div>

      {loadError ? (
        <ErrorState message={loadError} onRetry={fetchAppointments} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b bg-gray-50/50">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="بحث باسم المريض أو الكود أو الهاتف أو العيادة أو الطبيب..."
              />
            </div>

            {statusError && (
              <div className="p-3"><InlineError message={statusError} /></div>
            )}

            {filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-500 font-bold">
                {search ? 'لا توجد نتائج مطابقة للبحث.' : 'لا يوجد مواعيد مسجلة'}
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {pageItems.map(app => {
                    const status = toAppointmentStatus(app.status);
                    return (
                      <div key={app.id} className="p-6 flex flex-col md:flex-row justify-between gap-4 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h3 className="font-bold text-lg text-gray-900 mb-1 flex items-center gap-2">
                              <User className="w-5 h-5 text-gray-400" />
                              {app.patient ? `${app.patient.first_name} ${app.patient.last_name}` : 'زائر (بدون حساب)'}
                            </h3>
                            <div className="text-sm text-gray-600 mb-2">
                              الكود: <span className="font-mono text-emerald-600 font-bold">{app.patient?.patient_code || '—'}</span> | الهاتف: {app.patient?.phone || 'غير مسجل'}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-800 font-bold mb-1 flex items-center gap-2">
                              <Activity className="w-4 h-4 text-emerald-600" />
                              {app.clinic?.name}
                            </div>
                            <div className="text-sm text-gray-600">
                              الطبيب: {app.doctor?.profiles ? `د. ${app.doctor.profiles.first_name} ${app.doctor.profiles.last_name}` : 'غير محدد'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-md w-fit mt-2">
                              <Calendar className="w-4 h-4" />
                              <span dir="ltr">{new Date(app.appointment_date).toLocaleDateString('ar-EG')}</span>
                              <Clock className="w-4 h-4 mr-1" />
                              <span dir="ltr">{new Date(app.appointment_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 items-end justify-center border-t md:border-t-0 md:border-r pt-4 md:pt-0 md:pr-4">
                          <div className="mb-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${APPOINTMENT_STATUS_COLORS[status]}`}>
                              {APPOINTMENT_STATUS_LABELS[status]}
                            </span>
                          </div>

                          {status === 'pending' && (
                            <div className="flex gap-2">
                              <button onClick={() => updateStatus(app.id, 'confirmed')} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-700">تأكيد الحجز</button>
                              <button onClick={() => updateStatus(app.id, 'cancelled')} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-200">إلغاء</button>
                            </div>
                          )}
                          {status === 'confirmed' && (
                            <div className="flex gap-2">
                              <button onClick={() => updateStatus(app.id, 'completed')} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-200">إنهاء</button>
                              <button onClick={() => updateStatus(app.id, 'cancelled')} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-200">إلغاء</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Pagination
                  page={safePage}
                  pageSize={PAGE_SIZE}
                  total={filtered.length}
                  onPageChange={setPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
