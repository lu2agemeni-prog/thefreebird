'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Stethoscope, FileText, Banknote } from 'lucide-react';

export default function PublicPricesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('services')
      .select('*, clinic:clinic_id(name)')
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (data) {
      // Group by clinic
      const grouped = data.reduce((acc, curr) => {
        const clinicName = curr.clinic?.name || 'خدمات عامة';
        if (!acc[clinicName]) acc[clinicName] = [];
        acc[clinicName].push(curr);
        return acc;
      }, {});
      setServices(Object.entries(grouped));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <img src="/logo.png" alt="الطائر الحر" className="w-32 h-auto mx-auto mb-4" onError={(e) => e.currentTarget.style.display = 'none'} />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">لائحة أسعار الخدمات</h1>
          <p className="text-gray-500">مركز الطائر الحر الطبي</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-2xl shadow-sm border text-gray-500">
            لا توجد خدمات مسعرة حالياً
          </div>
        ) : (
          <div className="space-y-8">
            {services.map(([clinicName, clinicServices]: [string, any[]]) => (
              <div key={clinicName} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <Stethoscope className="w-6 h-6 text-emerald-600" />
                  <h2 className="text-xl font-bold text-gray-800">{clinicName}</h2>
                </div>
                <Card className="overflow-hidden shadow-sm border-emerald-100">
                  <div className="divide-y divide-gray-100">
                    {clinicServices.map((service, idx) => (
                      <div key={service.id} className="flex justify-between items-center p-4 hover:bg-emerald-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                          </div>
                          <span className="font-bold text-gray-800">{service.name}</span>
                        </div>
                        <div className="text-emerald-700 font-black text-lg bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100" dir="ltr">
                          {service.price} <span className="text-sm font-bold text-emerald-600">EGP</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
