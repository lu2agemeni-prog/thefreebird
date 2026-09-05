'use client';
import { ArrowRight, Calendar, User, Clock } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function BookPage() {
  const [clinics, setClinics] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchClinics = async () => {
      const { data } = await supabase.from('clinics').select('*').eq('is_active', true);
      if (data) setClinics(data);
    };
    fetchClinics();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-emerald-600 text-white p-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            الحجز السريع
          </h1>
          <Link href="/" className="flex items-center gap-2 text-emerald-50 hover:text-white transition-colors">
            العودة <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>
      
      <main className="max-w-2xl mx-auto p-6 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">احجز موعدك الآن</h2>
          
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert('تم استلام طلب الحجز. سيتم التواصل معك لتأكيد الموعد.'); }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" /> اسم المريض
              </label>
              <input required type="text" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="الاسم ثلاثي" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" /> رقم الهاتف
              </label>
              <input required type="tel" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" placeholder="رقم الموبايل" dir="rtl" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" /> اختر العيادة
              </label>
              <select required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none">
                <option value="">-- يرجى الاختيار --</option>
                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {clinics.length === 0 && <option value="dental">عيادة الأسنان</option>}
                {clinics.length === 0 && <option value="internal">عيادة الباطنة</option>}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> الموعد المفضل
              </label>
              <input required type="date" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
            </div>
            
            <button type="submit" className="w-full bg-emerald-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-emerald-700 transition-colors mt-4">
              تأكيد الحجز المبدئي
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

// Quick fallback for icon if Activity wasn't imported properly above
import { Activity } from 'lucide-react';
