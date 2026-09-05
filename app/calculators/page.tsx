import { ArrowRight, Calculator } from 'lucide-react';
import Link from 'next/link';
import { MedicalCalculators } from '@/components/dashboards/patient/MedicalCalculators';

export default function CalculatorsPage() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-emerald-600 text-white p-6 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-6 h-6" />
            الحاسبات والأدلة الطبية
          </h1>
          <Link href="/" className="flex items-center gap-2 text-emerald-50 hover:text-white transition-colors">
            العودة للرئيسية <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-6 mt-6">
        <MedicalCalculators />
      </main>
    </div>
  );
}
