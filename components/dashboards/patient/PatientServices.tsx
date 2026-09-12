'use client';

// ============================================================================
// components/dashboards/patient/PatientServices.tsx
// قائمة الخدمات والأسعار — بقت معروضة في تابات بالعيادات (كل عيادة تاب
// لوحده وتحته قائمة خدماتها)، بدل جدول واحد طويل فيه عمود "العيادة".
// ============================================================================
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { List, Building2, Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';

const GENERAL_KEY = '__general__';

export function PatientServices() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeClinic, setActiveClinic] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*, clinic:clinic_id(id, name)')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة الخدمات.'));
    } else if (data) {
      setServices(data);
    }
    setLoading(false);
  };

  // تجميع الخدمات حسب العيادة — خدمات من غير عيادة محددة بتتجمع تحت "خدمات عامة"
  const clinicGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; services: any[] }>();
    services.forEach(s => {
      const key = s.clinic?.id || GENERAL_KEY;
      const name = s.clinic?.name || 'خدمات عامة';
      if (!groups.has(key)) groups.set(key, { id: key, name, services: [] });
      groups.get(key)!.services.push(s);
    });
    // العيادات أولًا بالترتيب الأبجدي، و"خدمات عامة" في الآخر
    return Array.from(groups.values()).sort((a, b) => {
      if (a.id === GENERAL_KEY) return 1;
      if (b.id === GENERAL_KEY) return -1;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [services]);

  useEffect(() => {
    if (!activeClinic && clinicGroups.length > 0) {
      setActiveClinic(clinicGroups[0].id);
    }
  }, [clinicGroups, activeClinic]);

  const currentGroup = clinicGroups.find(g => g.id === activeClinic);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <List className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">قائمة الخدمات والأسعار</h2>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
      ) : loadError ? (
        <Card><CardContent className="p-6"><ErrorState message={loadError} onRetry={fetchServices} compact /></CardContent></Card>
      ) : clinicGroups.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-gray-500">لا توجد خدمات مضافة حالياً.</CardContent></Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {clinicGroups.map(group => (
              <button
                key={group.id}
                onClick={() => setActiveClinic(group.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-colors ${
                  activeClinic === group.id ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                {group.name}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeClinic === group.id ? 'bg-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {group.services.length}
                </span>
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="p-4 font-semibold text-gray-600">اسم الخدمة</th>
                      <th className="p-4 font-semibold text-gray-600 text-left">السعر المتوقع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentGroup?.services.map(service => (
                      <tr key={service.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-800">{service.name}</td>
                        <td className="p-4 text-left font-bold text-emerald-600" dir="ltr">{service.price} EGP</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
