'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { List, Loader2 } from 'lucide-react';

export function PatientServices() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('*, clinic:clinic_id(name)')
      .order('name', { ascending: true });
    
    if (data) setServices(data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <List className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">قائمة الخدمات والأسعار</h2>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 font-semibold text-gray-600">اسم الخدمة</th>
                    <th className="p-4 font-semibold text-gray-600">العيادة</th>
                    <th className="p-4 font-semibold text-gray-600 text-left">السعر المتوقع</th>
                  </tr>
                </thead>
                <tbody>
                  {services.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-500">
                        لا توجد خدمات مضافة حالياً.
                      </td>
                    </tr>
                  ) : (
                    services.map(service => (
                      <tr key={service.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-800">{service.name}</td>
                        <td className="p-4 text-emerald-600 font-medium">
                          {service.clinic?.name || 'خدمة عامة'}
                        </td>
                        <td className="p-4 text-left font-bold text-gray-900" dir="ltr">
                          {service.price} EGP
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
