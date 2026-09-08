'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { User, Save, Loader2, CheckCircle2, CalendarDays } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { WEEK_DAYS, workingDaysLabel } from '@/lib/types';

export function DoctorProfile() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [workingDays, setWorkingDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [doctorExists, setDoctorExists] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(user.phone || '');
      fetchDoctorDetails();
    }
  }, [user]);

  const fetchDoctorDetails = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase.from('doctors').select('*').eq('profile_id', user?.id).single();

    if (error) {
      // PGRST116: لا يوجد صف أطباء لهذا الحساب بعد — نموذج فارغ قابل للحفظ (إدراج لاحق)
      if (error.code === 'PGRST116') {
        setLoadError(null);
      } else {
        setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل بياناتك كطبيب.'));
      }
    } else if (data) {
      setBio(data.bio || '');
      setSpecialty(data.specialty || '');
      // working_days: jsonb array مثل [6,0,2] (نظام JS: 0=الأحد … 6=السبت)
      const days = Array.isArray(data.working_days) ? data.working_days.filter((d: unknown) => typeof d === 'number') : [];
      setWorkingDays(days);
      setDoctorExists(true);
    }
    setLoading(false);
  };

  const toggleDay = (day: number) => {
    setWorkingDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setSaveError('يرجى إدخال الاسم الأول والأخير.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSuccessMsg(null);

    // Update profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
      })
      .eq('id', user?.id);

    // Update doctors (specialty/bio/working_days)
    const doctorRow = {
      bio: bio,
      specialty: specialty.trim(),
      working_days: workingDays,
    };
    let doctorError: any = null;
    if (doctorExists) {
      const res = await supabase
        .from('doctors')
        .update(doctorRow)
        .eq('profile_id', user?.id);
      doctorError = res.error;
    } else {
      const res = await supabase
        .from('doctors')
        .insert([{ profile_id: user?.id, clinic_id: null, ...doctorRow }]);
      doctorError = res.error;
    }

    setSaving(false);
    if (!profileError && !doctorError) {
      setSuccessMsg('تم تحديث البيانات الشخصية بنجاح.');
      setDoctorExists(true);
    } else {
      const err = profileError || doctorError;
      setSaveError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء حفظ البيانات.'));
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }
  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchDoctorDetails} />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الملف الشخصي والطبي</h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الاسم الأول</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border rounded-lg p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الاسم الأخير</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border rounded-lg p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">التخصص</label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full border rounded-lg p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="مثال: طبيب أطفال، جراح عام..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">رقم الهاتف للتواصل</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border rounded-lg p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">نبذة عن الطبيب (تظهر للمرضى)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full border rounded-lg p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[100px]"
                placeholder="اكتب نبذة عن خبراتك وشهاداتك..."
              />
            </div>

            {/* أيام العمل — العمود موجود في قاعدة البيانات ولم يكن مستخدمًا في الكود إطلاقًا */}
            <div className="border rounded-xl p-4 bg-gray-50/60">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="w-5 h-5 text-emerald-600" />
                <label className="text-sm font-bold text-gray-700">أيام العمل (تُستخدم للتحقق من تعارض المواعيد)</label>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                أيام الاستقبال الحالية: {workingDaysLabel(workingDays)} — تُطبَّق فورًا عند حجز موعد جديد لطبيبك.
              </p>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map(day => {
                  const active = workingDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors border ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                      }`}
                      aria-pressed={active}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {saveError && <InlineError message={saveError} />}
            {successMsg && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                حفظ التعديلات
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
