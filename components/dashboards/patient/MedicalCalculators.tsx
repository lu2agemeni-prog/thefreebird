'use client';
import { useState } from 'react';
import { GeneralMetrics } from './GeneralMetrics';
import { WomensHealth } from './WomensHealth';
import { CardioCalc } from './CardioCalc';
import { NutritionGuides } from './NutritionGuides';
import { Pediatrics } from './Pediatrics';
import { MentalHealth } from './MentalHealth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Scale, Baby, HeartPulse, Brain, Apple, Stethoscope } from 'lucide-react';

const calculatorCategories = [
  { id: 'general', name: 'القياسات العامة', desc: 'مؤشر كتلة الجسم (BMI) والوزن المثالي', icon: Scale, color: 'bg-blue-100 text-blue-600', border: 'border-blue-100 hover:border-blue-300' },
  { id: 'womens', name: 'صحة المرأة', desc: 'حساب مواعيد الحمل والتبويض المتوقع', icon: Baby, color: 'bg-pink-100 text-pink-600', border: 'border-pink-100 hover:border-pink-300' },
  { id: 'pediatrics', name: 'طب الأطفال', desc: 'حساب الأوزان الطبيعية وجرعات الأدوية', icon: Stethoscope, color: 'bg-orange-100 text-orange-600', border: 'border-orange-100 hover:border-orange-300' },
  { id: 'cardio', name: 'صحة القلب', desc: 'تقييم مخاطر القلب والأوعية الدموية', icon: HeartPulse, color: 'bg-red-100 text-red-600', border: 'border-red-100 hover:border-red-300' },
  { id: 'mental', name: 'الصحة النفسية', desc: 'مقاييس دقيقة لتقييم القلق والاكتئاب', icon: Brain, color: 'bg-purple-100 text-purple-600', border: 'border-purple-100 hover:border-purple-300' },
  { id: 'nutrition', name: 'الأنظمة الغذائية', desc: 'الأدلة التغذوية وحساب السعرات اليومية', icon: Apple, color: 'bg-emerald-100 text-emerald-600', border: 'border-emerald-100 hover:border-emerald-300' },
];

export function MedicalCalculators() {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {!activeTab ? (
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0">
            <CardTitle className="text-2xl md:text-3xl text-gray-800">الحاسبات والأدلة الطبية</CardTitle>
            <p className="text-gray-500 text-lg">اختر نوع الحاسبة أو الدليل الطبي. جميع البيانات مبنية على أحدث الأدلة العلمية.</p>
          </CardHeader>
          <CardContent className="px-0 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {calculatorCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveTab(category.id)}
                    className={`flex flex-col items-center text-center p-8 rounded-3xl border-2 bg-white ${category.border} hover:shadow-lg transition-all duration-300 group`}
                  >
                    <div className={`p-5 rounded-full ${category.color} mb-5 group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300`}>
                      <Icon className="w-10 h-10" />
                    </div>
                    <h3 className="font-bold text-xl text-gray-900 mb-3">{category.name}</h3>
                    <p className="text-gray-500 leading-relaxed text-sm">{category.desc}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <button 
            onClick={() => setActiveTab(null)}
            className="flex items-center gap-2 text-emerald-700 font-bold hover:text-emerald-800 hover:bg-emerald-50 px-4 py-2.5 rounded-xl transition-colors w-fit border border-transparent hover:border-emerald-200"
          >
            <ArrowRight className="w-5 h-5" />
            العودة لقائمة الحاسبات الرئيسية
          </button>
          
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'general' && <GeneralMetrics />}
            {activeTab === 'womens' && <WomensHealth />}
            {activeTab === 'pediatrics' && <Pediatrics />}
            {activeTab === 'cardio' && <CardioCalc />}
            {activeTab === 'mental' && <MentalHealth />}
            {activeTab === 'nutrition' && <NutritionGuides />}
          </div>
        </div>
      )}
    </div>
  );
}

