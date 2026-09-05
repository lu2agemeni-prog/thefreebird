'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowRight, Stethoscope, Calendar, Clock, Star } from 'lucide-react';
import Link from 'next/link';

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoctors = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'doctor');
      if (data) setDoctors(data);
      setLoading(false);
    };
    fetchDoctors();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-emerald-600 text-white p-6 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="w-6 h-6" />
            أطباء المركز
          </h1>
          <Link href="/" className="flex items-center gap-2 text-emerald-50 hover:text-white transition-colors">
            العودة للرئيسية <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto p-6 mt-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">نخبة من أفضل الأطباء</h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            نضم في مركز الطائر الحر مجموعة من الكفاءات الطبية المتخصصة لضمان تقديم أفضل رعاية صحية لك ولأسرتك.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center p-12 text-emerald-600">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {doctors.map((doc) => (
              <div key={doc.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div className="h-32 bg-emerald-50 relative">
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                    {doc.avatar_url ? (
                      <img src={doc.avatar_url} alt="Doctor" className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover" />
                    ) : (
                      <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-emerald-600 flex items-center justify-center text-white text-3xl font-bold">
                        {doc.first_name?.[0]}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="pt-16 pb-8 px-6 text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">د. {doc.first_name} {doc.last_name}</h3>
                  <p className="text-emerald-600 font-medium mb-4">أخصائي متميز</p>
                  
                  <div className="flex items-center justify-center gap-1 text-amber-400 mb-6">
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                  
                  <div className="bg-gray-50 rounded-2xl p-4 text-right space-y-3 mb-6 border border-gray-100">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>الأيام: السبت، الإثنين، الأربعاء</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>المواعيد: 4:00 م - 9:00 م</span>
                    </div>
                  </div>
                  
                  <Link 
                    href="/book" 
                    className="block w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors"
                  >
                    حجز موعد
                  </Link>
                </div>
              </div>
            ))}
            
            {doctors.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-12 text-lg">
                لا يوجد أطباء متاحين للعرض حالياً.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
