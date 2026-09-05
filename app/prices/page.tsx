'use client';
import { useState, useEffect } from 'react';
import { ArrowRight, CreditCard, Stethoscope, Activity, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function PricesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*, clinic:clinic_id(name)')
      .order('name', { ascending: true });
    
    if (!error && data) {
      setServices(data);
    }
    setLoading(false);
  };

  // Group services by clinic
  const groupedServices = services.reduce((acc, service) => {
    const clinicName = service.clinic?.name || 'خدمات عامة';
    if (!acc[clinicName]) acc[clinicName] = [];
    acc[clinicName].push(service);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-emerald-600 text-white p-6 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            الخدمات والأسعار
          </h1>
          <Link href="/" className="flex items-center gap-2 text-emerald-50 hover:text-white transition-colors">
            العودة للرئيسية <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-6 mt-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : services.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
            <p className="text-gray-500">لا توجد خدمات مسجلة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {(Object.entries(groupedServices) as [string, any[]][]).map(([clinicName, items]) => (
              <div key={clinicName} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-800">{clinicName}</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map((item: any, itemIdx: number) => (
                    <div key={itemIdx} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                          <Stethoscope className="w-5 h-5 text-emerald-600" />
                        </div>
                        <span className="font-medium text-gray-700 text-lg">{item.name}</span>
                      </div>
                      <span className="font-bold text-emerald-600 text-xl" dir="ltr">{item.price} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

