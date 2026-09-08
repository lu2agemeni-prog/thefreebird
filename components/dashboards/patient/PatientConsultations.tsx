'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Plus, CheckCircle2, Clock, Send, Loader2, AlertTriangle } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { toConsultationStatus, CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS } from '@/lib/types';

export function PatientConsultations() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);

  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchConsultations();
      fetchDoctors();
    }
  }, [user]);

  const fetchConsultations = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('consultations')
      .select('*, doctor:doctor_id(profiles(first_name, last_name))')
      .eq('patient_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل استشارتك السابقة.'));
    } else if (data) {
      setConsultations(data);
    }
    setLoading(false);
  };

  const fetchDoctors = async () => {
    setDoctorsError(null);
    const { data, error } = await supabase
      .from('doctors')
      .select('profile_id, profiles(first_name, last_name)');
    if (error) {
      setDoctorsError('تعذر تحميل قائمة الأطباء — برجاء إعادة تحميل الصفحة أو المحاولة لاحقًا.');
    } else if (data) {
      setDoctors(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedDoctor) {
      setSubmitError('يرجى كتابة رسالة الاستشارة واختيار الطبيب.');
      return;
    }

    setSending(true);
    setSubmitError(null);
    setSuccessMsg(null);
    const { error } = await supabase.from('consultations').insert([{
      patient_id: user?.id,
      doctor_id: selectedDoctor,
      message: message.trim(),
      status: 'pending'
    }]);

    setSending(false);
    if (!error) {
      setSuccessMsg('تم إرسال استشارتك للطبيب بنجاح وسيتم الرد عليك قريبًا.');
      setIsNew(false);
      setMessage('');
      setSelectedDoctor('');
      fetchConsultations();
    } else {
      setSubmitError(getFriendlyErrorMessage(error, 'حدث خطأ أثناء الإرسال. برجاء المحاولة مرة أخرى.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-emerald-600" />
          استشارتي الطبية
        </h2>
        <button
          onClick={() => setIsNew(!isNew)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {isNew ? 'إلغاء' : 'استشارة جديدة'}
        </button>
      </div>

      {isNew && (
        <Card className="border-emerald-100 shadow-md animate-in slide-in-from-top-4">
          <CardHeader className="bg-emerald-50 rounded-t-xl border-b border-emerald-100">
            <CardTitle className="text-emerald-800 text-lg">طلب استشارة طبية</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">اختر الطبيب الموجه له الاستشارة</label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full border rounded-lg p-3 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                >
                  <option value="">-- اختر الطبيب --</option>
                  {doctors.map(d => (
                    <option key={d.profile_id} value={d.profile_id}>
                      د. {d.profiles?.first_name} {d.profiles?.last_name}
                    </option>
                  ))}
                </select>
                {doctorsError && (
                  <div className="flex items-start gap-1.5 mt-2 text-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{doctorsError}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">تفاصيل الاستشارة</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full border rounded-lg p-3 h-32 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  placeholder="اكتب سؤالك أو استفسارك الطبي هنا بوضوح..."
                  required
                />
              </div>
              {submitError && <InlineError message={submitError} />}
              {successMsg && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  إرسال الاستشارة
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={fetchConsultations} />
        ) : consultations.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center flex flex-col items-center border border-gray-100">
            <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-xl text-gray-500 font-bold mb-2">ليس لديك أي استشارات سابقة</p>
            <p className="text-gray-400">ابدأ بطلب استشارة جديدة إذا كان لديك أي استفسار طبي.</p>
          </div>
        ) : (
          consultations.map(c => {
            const cStatus = toConsultationStatus(c.status);
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                  <div className="font-bold text-gray-800">
                    إلى: د. {c.doctor?.profiles?.first_name} {c.doctor?.profiles?.last_name}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500" dir="ltr">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${CONSULTATION_STATUS_COLORS[cStatus]}`}>
                      {cStatus === 'pending' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      {CONSULTATION_STATUS_LABELS[cStatus]}
                    </span>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-500 mb-2">سؤالك:</h4>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100">
                      {c.message}
                    </p>
                  </div>
                  {c.reply && (
                    <div>
                      <h4 className="text-sm font-bold text-emerald-700 mb-2">رد الطبيب:</h4>
                      <p className="text-emerald-900 leading-relaxed whitespace-pre-wrap bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        {c.reply}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
