'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Save, Loader2, Info } from 'lucide-react';

export function PatientMedicalRecords() {
  const { user } = useAuth();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  useEffect(() => {
    if (user) fetchRecord();
  }, [user]);

  const fetchRecord = async () => {
    const { data, error } = await supabase
      .from('patient_records')
      .select('*')
      .eq('profile_id', user?.id)
      .single();
    
    if (data) {
      setRecord(data);
      setBloodGroup(data.blood_group || '');
      setAllergies(data.allergies || '');
      setChronicDiseases(data.chronic_diseases || '');
      setWeight(data.weight ? data.weight.toString() : '');
      setHeight(data.height ? data.height.toString() : '');
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const recordData = {
      profile_id: user?.id,
      blood_group: bloodGroup,
      allergies: allergies,
      chronic_diseases: chronicDiseases,
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null
    };

    let error;
    if (record) {
      const res = await supabase.from('patient_records').update(recordData).eq('profile_id', user?.id);
      error = res.error;
    } else {
      const res = await supabase.from('patient_records').insert([recordData]);
      error = res.error;
    }

    setSaving(false);
    if (!error) {
      alert('تم تحديث بياناتك الطبية بنجاح');
      fetchRecord();
    } else {
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">بياناتي الطبية</h2>
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800">
        <Info className="w-6 h-6 flex-shrink-0" />
        <p className="text-sm">
          تساعد هذه البيانات أطباء المركز في معرفة حالتك الصحية بدقة لتقديم أفضل رعاية وتجنب أي تعارضات دوائية. يرجى تعبئتها بدقة.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">فصيلة الدم</label>
                <select 
                  value={bloodGroup} 
                  onChange={(e) => setBloodGroup(e.target.value)} 
                  className="w-full border rounded-lg p-3 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                >
                  <option value="">-- غير محدد --</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الوزن (كجم)</label>
                  <input 
                    type="number" 
                    value={weight} 
                    onChange={(e) => setWeight(e.target.value)} 
                    className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="مثال: 75"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الطول (سم)</label>
                  <input 
                    type="number" 
                    value={height} 
                    onChange={(e) => setHeight(e.target.value)} 
                    className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="مثال: 170"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">الأمراض المزمنة (إن وجدت)</label>
                <textarea 
                  value={chronicDiseases} 
                  onChange={(e) => setChronicDiseases(e.target.value)} 
                  className="w-full border rounded-lg p-3 h-24 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="مثال: الضغط، السكري، الربو... أو اتركها فارغة"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">الحساسية للأدوية أو الأطعمة</label>
                <textarea 
                  value={allergies} 
                  onChange={(e) => setAllergies(e.target.value)} 
                  className="w-full border rounded-lg p-3 h-24 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="مثال: حساسية البنسلين، الفراولة... أو اتركها فارغة"
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <button 
                type="submit" 
                disabled={saving}
                className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                حفظ وتحديث البيانات
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
