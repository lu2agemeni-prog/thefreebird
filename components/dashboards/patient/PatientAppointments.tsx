'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react';

export function PatientAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  
  // Booking Form State
  const [selectedClinic, setSelectedClinic] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');

  useEffect(() => {
    if (user) {
      fetchAppointments();
      fetchClinicsAndDoctors();
    }
  }, [user]);

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*, clinic:clinic_id(name), doctor:doctor_id(profiles(first_name, last_name))')
      .eq('patient_id', user?.id)
      .order('appointment_date', { ascending: false });
    
    if (data) setAppointments(data);
    setLoading(false);
  };

  const fetchClinicsAndDoctors = async () => {
    const { data: clinicsData } = await supabase.from('clinics').select('*');
    if (clinicsData) setClinics(clinicsData);

    const { data: doctorsData } = await supabase
      .from('doctors')
      .select('profile_id, clinic_id, profiles(first_name, last_name)');
    if (doctorsData) setDoctors(doctorsData);
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic || !appointmentDate || !appointmentTime) {
      return alert("الرجاء استكمال جميع البيانات الأساسية للحجز.");
    }

    const dateTime = new Date(`${appointmentDate}T${appointmentTime}:00`).toISOString();

    const { error } = await supabase.from('appointments').insert([{
      patient_id: user?.id,
      clinic_id: selectedClinic,
      doctor_id: selectedDoctor || null,
      appointment_date: dateTime,
      status: 'pending'
    }]);

    if (!error) {
      alert("تم تسجيل طلب الحجز بنجاح، بانتظار التأكيد من الإدارة.");
      setIsBooking(false);
      setSelectedClinic('');
      setSelectedDoctor('');
      setAppointmentDate('');
      setAppointmentTime('');
      fetchAppointments();
    } else {
      alert("حدث خطأ أثناء حجز الموعد.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-emerald-600" />
          مواعيدي
        </h2>
        <button 
          onClick={() => setIsBooking(!isBooking)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {isBooking ? 'إلغاء' : 'حجز موعد جديد'}
        </button>
      </div>

      {isBooking && (
        <Card className="border-emerald-100 shadow-md">
          <CardHeader className="bg-emerald-50 rounded-t-xl border-b border-emerald-100">
            <CardTitle className="text-emerald-800 text-lg">طلب حجز موعد جديد</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleBook} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">العيادة المطلوبة</label>
                  <select 
                    value={selectedClinic} 
                    onChange={(e) => setSelectedClinic(e.target.value)} 
                    className="w-full border rounded-lg p-3 bg-white"
                    required
                  >
                    <option value="">-- اختر العيادة --</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الطبيب (اختياري)</label>
                  <select 
                    value={selectedDoctor} 
                    onChange={(e) => setSelectedDoctor(e.target.value)} 
                    className="w-full border rounded-lg p-3 bg-white"
                  >
                    <option value="">-- أي طبيب --</option>
                    {doctors.filter(d => !selectedClinic || d.clinic_id === selectedClinic).map(d => (
                      <option key={d.profile_id} value={d.profile_id}>
                        د. {d.profiles?.first_name} {d.profiles?.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الموعد</label>
                  <input 
                    type="date" 
                    value={appointmentDate} 
                    onChange={(e) => setAppointmentDate(e.target.value)} 
                    className="w-full border rounded-lg p-3"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الوقت المفضل</label>
                  <input 
                    type="time" 
                    value={appointmentTime} 
                    onChange={(e) => setAppointmentTime(e.target.value)} 
                    className="w-full border rounded-lg p-3"
                    required
                  />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition-colors">
                  تأكيد الحجز
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">جاري تحميل المواعيد...</div>
          ) : appointments.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <Calendar className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-xl text-gray-500 font-bold mb-2">لا توجد مواعيد سابقة</p>
              <p className="text-gray-400">يمكنك حجز موعد جديد بالضغط على الزر أعلاه</p>
            </div>
          ) : (
            <div className="divide-y">
              {appointments.map(app => (
                <div key={app.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                      {app.clinic?.name || 'عيادة غير محددة'}
                      {app.doctor && ` - د. ${app.doctor.profiles?.first_name} ${app.doctor.profiles?.last_name}`}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span dir="ltr">{new Date(app.appointment_date).toLocaleDateString('ar-EG')}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span dir="ltr">{new Date(app.appointment_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {app.status === 'pending' && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"><Clock className="w-4 h-4"/> قيد الانتظار</span>}
                    {app.status === 'confirmed' && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> مؤكد</span>}
                    {app.status === 'completed' && <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> مكتمل</span>}
                    {app.status === 'cancelled' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"><XCircle className="w-4 h-4"/> ملغي</span>}
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
