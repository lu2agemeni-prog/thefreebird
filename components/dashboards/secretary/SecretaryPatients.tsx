'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Search, Loader2 } from 'lucide-react';

export function SecretaryPatients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'patient')
      .order('created_at', { ascending: false });
    
    if (data) setPatients(data);
    setLoading(false);
  };

  const filteredPatients = patients.filter(p => 
    (p.first_name + ' ' + p.last_name).toLowerCase().includes(search.toLowerCase()) ||
    (p.patient_code && p.patient_code.toLowerCase().includes(search.toLowerCase())) ||
    (p.phone && p.phone.includes(search))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">دليل المرضى المسجلين</h2>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
        <input 
          type="text" 
          placeholder="بحث بالاسم، الكود، أو رقم الهاتف..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-3 pr-10 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-bold">لا توجد نتائج مطابقة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 font-semibold text-gray-600">كود المريض</th>
                    <th className="p-4 font-semibold text-gray-600">الاسم</th>
                    <th className="p-4 font-semibold text-gray-600">رقم الهاتف</th>
                    <th className="p-4 font-semibold text-gray-600">تاريخ التسجيل</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(p => (
                    <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-bold text-sm">
                          {p.patient_code || 'غير محدد'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-gray-800">
                        {p.first_name} {p.last_name}
                      </td>
                      <td className="p-4 text-gray-600" dir="ltr">
                        {p.phone || '---'}
                      </td>
                      <td className="p-4 text-gray-500 text-sm" dir="ltr">
                        {new Date(p.created_at).toLocaleDateString('ar-EG')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
