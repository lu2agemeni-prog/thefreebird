'use client';
import { useState } from 'react';
import { GeneralMetrics } from './GeneralMetrics';
import { WomensHealth } from './WomensHealth';
import { CardioCalc } from './CardioCalc';
import { NutritionGuides } from './NutritionGuides';
import { Pediatrics } from './Pediatrics';
import { MentalHealth } from './MentalHealth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const calculatorTabs = [
  { id: 'general', name: 'قياسات عامة (كتلة الجسم، الوزن المثالي)' },
  { id: 'womens', name: 'صحة المرأة (الحمل والتبويض)' },
  { id: 'pediatrics', name: 'طب الأطفال (الأوزان والجرعات)' },
  { id: 'cardio', name: 'مخاطر القلب والأوعية' },
  { id: 'mental', name: 'الصحة النفسية (القلق والاكتئاب)' },
  { id: 'nutrition', name: 'الأنظمة الغذائية والسعرات' },
];

export function MedicalCalculators() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>الحاسبات الطبية والأدلة المعتمدة</CardTitle>
          <p className="text-gray-500 text-sm">جميع الحسابات والبيانات هنا مبنية على أحدث الأدلة العلمية وموثقة من جهات صحية عالمية.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-6">
            {calculatorTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  activeTab === tab.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {activeTab === 'general' && <GeneralMetrics />}
            {activeTab === 'womens' && <WomensHealth />}
            {activeTab === 'pediatrics' && <Pediatrics />}
            {activeTab === 'cardio' && <CardioCalc />}
            {activeTab === 'mental' && <MentalHealth />}
            {activeTab === 'nutrition' && <NutritionGuides />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
