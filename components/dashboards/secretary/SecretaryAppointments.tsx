'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, CheckCircle2, XCircle, Loader2, User, Activity } from 'lucide-react';

export function SecretaryAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patient_id(first_name, last_name, patient_code, phone), doctor:doctor_id(profiles(first_name, last_name)), clinic:clinic_id(name)')
      .order('appointment_date', { ascending: false });
    
    if (data) setAppointments(data);
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', id);
      
    if (!error) {
      fetchAppointments();
    } else {
      alert("حدث خطأ أثناء تحديث حالة الموعد.");
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">إدارة جميع المواعيد</h2>
      </div>

      <Card>
        <CardContent className="p-0">
          {appointments.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-bold">لا يوجد مواعيد مسجلة</div>
          ) : (
            <div className="divide-y">
              {appointments.map(app => (
                <div key={app.id} className="p-6 flex flex-col md:flex-row justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 mb-1 flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-400" />
                        {app.patient?.first_name} {app.patient?.last_name}
                      </h3>
                      <div className="text-sm text-gray-600 mb-2">
                        الكود: <span className="font-mono text-emerald-600 font-bold">{app.patient?.patient_code}</span> | الهاتف: {app.patient?.phone || 'غير مسجل'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-800 font-bold mb-1 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        {app.clinic?.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        الطبيب: د. {app.doctor?.profiles?.first_name} {app.doctor?.profiles?.last_name}
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
                      {app.status === 'pending' && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">قيد الانتظار</span>}
                      {app.status === 'confirmed' && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">مؤكد</span>}
                      {app.status === 'completed' && <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold">مكتمل</span>}
                      {app.status === 'cancelled' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">ملغي</span>}
                    </div>
                    
                    {app.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => updateStatus(app.id, 'confirmed')} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-700">تأكيد الحجز</button>
                        <button onClick={() => updateStatus(app.id, 'cancelled')} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-200">إلغاء</button>
                      </div>
                    )}
                    {app.status === 'confirmed' && (
                      <div className="flex gap-2">
                        <button onClick={() => updateStatus(app.id, 'completed')} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-200">إنهاء</button>
                        <button onClick={() => updateStatus(app.id, 'cancelled')} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-200">إلغاء</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
