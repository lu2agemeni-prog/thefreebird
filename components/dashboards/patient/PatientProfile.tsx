'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { User, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';

export function PatientProfile() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // إصلاح خلل سابق: كان الـ useEffect فارغًا فلا تُحمَّل البيانات الحالية في النموذج،
  // وبالتالي كان الحفظ يمسح الاسم من قاعدة البيانات. الآن نجلب الملف الشخصي الحقيقي.
  useEffect(() => {
    if (!user) return;
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('id', user?.id)
      .single();

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل بياناتك الشخصية.'));
    } else if (data) {
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setPhone(data.phone || '');
    }
    setLoading(false);
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

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
      })
      .eq('id', user?.id);

    setSaving(false);
    if (!error) {
      setSuccessMsg('تم تحديث البيانات الشخصية بنجاح. قد تحتاج لإعادة تسجيل الدخول لتحديثها في الشريط العلوي.');
    } else {
      setSaveError(getFriendlyErrorMessage(error, 'حدث خطأ أثناء حفظ البيانات.'));
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchProfile} />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الملف الشخصي</h2>
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
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">رقم الهاتف (للتواصل وتأكيد الحجز)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded-lg p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="01xxxxxxxxx"
                dir="ltr"
              />
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
