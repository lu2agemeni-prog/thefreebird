import { ArrowRight, CreditCard, Stethoscope, FileText, Activity } from 'lucide-react';
import Link from 'next/link';

export default function PricesPage() {
  const services = [
    { category: 'الكشوفات', items: [
      { name: 'كشف باطنة', price: '300 ج.م', icon: <Stethoscope className="w-5 h-5 text-emerald-600" /> },
      { name: 'كشف أسنان', price: '250 ج.م', icon: <Stethoscope className="w-5 h-5 text-emerald-600" /> },
      { name: 'كشف أطفال', price: '200 ج.م', icon: <Stethoscope className="w-5 h-5 text-emerald-600" /> },
    ]},
    { category: 'التحاليل والأشعة', items: [
      { name: 'تحليل صورة دم كاملة (CBC)', price: '150 ج.م', icon: <Activity className="w-5 h-5 text-blue-600" /> },
      { name: 'أشعة سينية (X-Ray)', price: '400 ج.م', icon: <Activity className="w-5 h-5 text-blue-600" /> },
      { name: 'رسم قلب (ECG)', price: '250 ج.م', icon: <Activity className="w-5 h-5 text-blue-600" /> },
    ]},
    { category: 'خدمات أخرى', items: [
      { name: 'استخراج شهادة صحية', price: '100 ج.م', icon: <FileText className="w-5 h-5 text-purple-600" /> },
      { name: 'جلسة تنفس صناعي', price: '80 ج.م', icon: <FileText className="w-5 h-5 text-purple-600" /> },
    ]}
  ];

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
        <div className="space-y-8">
          {services.map((section, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">{section.category}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {section.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {item.icon}
                      </div>
                      <span className="font-medium text-gray-700 text-lg">{item.name}</span>
                    </div>
                    <span className="font-bold text-emerald-600 text-xl" dir="ltr">{item.price}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
