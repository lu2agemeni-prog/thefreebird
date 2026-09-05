'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { User, Save, Loader2 } from 'lucide-react';

export function PatientProfile() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone,
      })
      .eq('id', user?.id);

    setSaving(false);
    if (!error) {
      alert('تم تحديث البيانات الشخصية بنجاح. قد تحتاج لإعادة تسجيل الدخول لتحديثها في الشريط العلوي.');
    } else {
      alert('حدث خطأ أثناء حفظ البيانات.');
    }
  };

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
