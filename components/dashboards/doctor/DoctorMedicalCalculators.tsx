'use client';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowRight, Stethoscope, Baby, Heart, Sparkles, Ear } from 'lucide-react';
import { FamilyMedicineCalc } from './calculators/FamilyMedicineCalc';
import { DentistryCalc } from './calculators/DentistryCalc';
import { ObGynCalc } from './calculators/ObGynCalc';
import { DermatologyCalc } from './calculators/DermatologyCalc';
import { EntCalc } from './calculators/EntCalc';

const specialties = [
  { id: 'family', name: 'طب الأسرة', desc: 'BSA، تصفية الكرياتينين، CHA₂DS₂-VASc', icon: Stethoscope, color: 'bg-blue-100 text-blue-600', border: 'border-blue-100 hover:border-blue-300', Component: FamilyMedicineCalc },
  { id: 'dental', name: 'الأسنان', desc: 'جرعة التخدير الموضعي، DMFT، دواعي الوقاية بالمضاد الحيوي', icon: Sparkles, color: 'bg-cyan-100 text-cyan-600', border: 'border-cyan-100 hover:border-cyan-300', Component: DentistryCalc },
  { id: 'obgyn', name: 'النساء والولادة', desc: 'تاريخ الولادة المتوقع، مقياس بيشوب، مقياس أبجار', icon: Baby, color: 'bg-pink-100 text-pink-600', border: 'border-pink-100 hover:border-pink-300', Component: ObGynCalc },
  { id: 'derma', name: 'الجلدية', desc: 'قاعدة التسعات، تصنيف فيتزباتريك، قائمة ABCDE', icon: Heart, color: 'bg-orange-100 text-orange-600', border: 'border-orange-100 hover:border-orange-300', Component: DermatologyCalc },
  { id: 'ent', name: 'أنف وأذن وحنجرة', desc: 'STOP-BANG، تصنيف اللوزتين، تصنيف ضعف السمع', icon: Ear, color: 'bg-purple-100 text-purple-600', border: 'border-purple-100 hover:border-purple-300', Component: EntCalc },
];

export function DoctorMedicalCalculators() {
  const [active, setActive] = useState<string | null>(null);
  const activeSpecialty = specialties.find(s => s.id === active);

  return (
    <div className="space-y-6">
      {!activeSpecialty ? (
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0">
            <CardTitle className="text-2xl md:text-3xl text-gray-800">الحاسبات الطبية للأطباء</CardTitle>
            <p className="text-gray-500">أدوات مرجعية معتمدة سريريًا، مقسّمة حسب التخصص — خاصة بحساب الطبيب فقط.</p>
          </CardHeader>
          <CardContent className="px-0 mt-2">
            <div className="space-y-3">
              {specialties.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id)}
                    className={`w-full flex items-center gap-5 text-right p-5 rounded-2xl border-2 bg-white ${s.border} hover:shadow-md transition-all duration-300 group`}
                  >
                    <div className={`p-4 rounded-full ${s.color} shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{s.name}</h3>
                      <p className="text-gray-500 leading-relaxed text-sm">{s.desc}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 rotate-180 shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setActive(null)}
            className="flex items-center gap-2 text-emerald-700 font-bold hover:text-emerald-800 hover:bg-emerald-50 px-4 py-2.5 rounded-xl transition-colors w-fit border border-transparent hover:border-emerald-200"
          >
            <ArrowRight className="w-4 h-4" /> رجوع للتخصصات
          </button>
          <h2 className="text-2xl font-bold text-gray-800">{activeSpecialty.name}</h2>
          <activeSpecialty.Component />
        </div>
      )}
    </div>
  );
}
