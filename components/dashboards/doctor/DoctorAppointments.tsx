'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Save } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/search-input';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  toAppointmentStatus,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
} from '@/lib/types';

export function DoctorAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Quick Note State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAppointments();
    }
  }, [user]);

  const fetchAppointments = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patient_id(first_name, last_name, patient_code), clinic:clinic_id(name)')
      .eq('doctor_id', user?.id)
      .order('appointment_date', { ascending: true });

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل مواعيدك.'));
    } else if (data) {
      setAppointments(data);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    setActionError(null);
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setAppointments(prev => prev.map(a => (a.id === id ? { ...a, status: newStatus } : a)));
    } else {
      setActionError(getFriendlyErrorMessage(error, 'حدث خطأ أثناء تحديث حالة الموعد.'));
    }
  };

  const saveNote = async (id: string) => {
    setNoteError(null);
    const { error } = await supabase
      .from('appointments')
      .update({ notes: tempNote })
      .eq('id', id);

    if (!error) {
      setEditingNoteId(null);
      setAppointments(prev => prev.map(a => (a.id === id ? { ...a, notes: tempNote } : a)));
    } else {
      setNoteError(getFriendlyErrorMessage(error, 'حدث خطأ أثناء حفظ الملاحظات.'));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter(app => {
      const patientName = `${app.patient?.first_name ?? ''} ${app.patient?.last_name ?? ''}`.toLowerCase();
      return (
        patientName.includes(q) ||
        (app.patient?.patient_code ?? '').toLowerCase().includes(q) ||
        (app.clinic?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [appointments, search]);

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">مواعيد المرضى</h2>
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
                placeholder="بحث باسم المريض أو الكود أو العيادة..."
              />
            </div>

            {actionError && <div className="p-3"><InlineError message={actionError} /></div>}

            {filtered.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <Calendar className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-xl text-gray-500 font-bold mb-2">
                  {search ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد مواعيد محجوزة'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map(app => {
                  const status = toAppointmentStatus(app.status);
                  return (
                    <div key={app.id} className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-gray-50 transition-colors">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 mb-1">
                          المريض: {app.patient ? `${app.patient.first_name} ${app.patient.last_name}` : 'زائر (بدون حساب)'}
                          <span className="text-sm text-emerald-600 mr-2 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-full font-mono">
                            {app.patient?.patient_code || '—'}
                          </span>
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4 flex-wrap">
                          <span className="flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> العيادة: {app.clinic?.name}
                          </span>
                          <span className="flex items-center gap-1 text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-md">
                            <Calendar className="w-4 h-4" />
                            <span dir="ltr">{new Date(app.appointment_date).toLocaleDateString('ar-EG')}</span>
                            {' '}
                            <Clock className="w-4 h-4 mr-1" />
                            <span dir="ltr">{new Date(app.appointment_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        </div>

                        {/* Notes Section for Doctor */}
                        <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                          <div className="text-sm font-bold text-yellow-800 mb-1">ملاحظات الطبيب للزيارة:</div>
                          {editingNoteId === app.id ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <textarea
                                  value={tempNote}
                                  onChange={(e) => setTempNote(e.target.value)}
                                  className="w-full border rounded-lg p-2 text-sm bg-white"
                                  rows={2}
                                />
                                <button onClick={() => saveNote(app.id)} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 h-fit">
                                  <Save className="w-5 h-5" />
                                </button>
                              </div>
                              {noteError && <InlineError message={noteError} />}
                            </div>
                          ) : (
                            <div
                              className="text-sm text-gray-700 min-h-[40px] cursor-pointer hover:bg-yellow-100 p-2 rounded transition-colors"
                              onClick={() => { setEditingNoteId(app.id); setTempNote(app.notes || ''); setNoteError(null); }}
                            >
                              {app.notes ? app.notes : <span className="text-gray-400 italic">اضغط هنا لإضافة ملاحظات...</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2 md:mt-0 flex-wrap">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 ${APPOINTMENT_STATUS_COLORS[status]}`}>
                          {status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                          {status === 'cancelled' && <XCircle className="w-4 h-4" />}
                          {APPOINTMENT_STATUS_LABELS[status]}
                        </span>
                        {status === 'pending' && (
                          <>
                            <button onClick={() => updateStatus(app.id, 'confirmed')} className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-200">تأكيد الموعد</button>
                            <button onClick={() => updateStatus(app.id, 'cancelled')} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-200">إلغاء</button>
                          </>
                        )}
                        {status === 'confirmed' && (
                          <button onClick={() => updateStatus(app.id, 'completed')} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-200">إنهاء الزيارة</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
