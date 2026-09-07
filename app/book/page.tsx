'use client';
import { ArrowRight, Calendar, User, Clock, Activity, Loader2, CheckCircle2, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function BookPage() {
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const [clinics, setClinics] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchClinics = async () => {
      const { data } = await supabase.from('clinics').select('*').eq('is_active', true);
      if (data) setClinics(data);
    };
    fetchClinics();
  }, []);

  useEffect(() => {
    if (user) {
      setName(`${user.first_name || ''} ${user.last_name || ''}`.trim());
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSubmitting(true);

    const { error: insertError } = await supabase.from('appointments').insert([{
      patient_id: user.id,
      clinic_id: clinicId,
      appointment_date: new Date(date).toISOString(),
      status: 'pending',
      notes: `اسم: ${name}\nهاتف: ${phone}`,
    }]);

    setSubmitting(false);

    if (insertError) {
      setError('حدث خطأ أثناء إرسال طلب الحجز. برجاء المحاولة مرة أخرى.');
      return;
    }

    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-emerald-600 text-white p-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            الحجز السريع
          </h1>
          <Link href="/" className="flex items-center gap-2 text-emerald-50 hover:text-white transition-colors">
            العودة <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {authLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : !user ? (
            <div className="text-center py-8">
              <LogIn className="w-14 h-14 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">سجّل الدخول للحجز</h2>
              <p className="text-gray-600 mb-6">لازم تسجّل دخولك الأول عشان تقدر تحجز موعد وتتابع حالته.</p>
              <button
                onClick={loginWithGoogle}
                className="bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors"
              >
                تسجيل الدخول عبر Google
              </button>
            </div>
          ) : submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">تم استلام طلب الحجز</h2>
              <p className="text-gray-600">سيتم التواصل معك على رقم {phone} لتأكيد الموعد.</p>
              <Link href="/" className="inline-block mt-6 text-emerald-600 font-bold hover:underline">
                العودة للرئيسية
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">احجز موعدك الآن</h2>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 text-center">
                  {error}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" /> اسم المريض
                  </label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    placeholder="الاسم ثلاثي"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" /> رقم الهاتف
                  </label>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    placeholder="رقم الموبايل"
                    dir="rtl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> اختر العيادة
                  </label>
                  <select
                    required
                    value={clinicId}
                    onChange={(e) => setClinicId(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  >
                    <option value="">-- يرجى الاختيار --</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> الموعد المفضل
                  </label>
                  <input
                    required
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-emerald-700 transition-colors mt-4 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                  تأكيد الحجز المبدئي
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}