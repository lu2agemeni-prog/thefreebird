'use client';
import { useState } from 'react';
import { Apple, Info, Utensils, Heart, Activity } from 'lucide-react';

export function NutritionGuides() {
  const [activeDiet, setActiveDiet] = useState('egyptian');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => setActiveDiet('egyptian')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeDiet === 'egyptian' ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
        >
          <span className="flex items-center gap-2"><Utensils className="w-4 h-4"/> السعرات في الأكل المصري</span>
        </button>
        <button 
          onClick={() => setActiveDiet('dm')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeDiet === 'dm' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
        >
          <span className="flex items-center gap-2"><Activity className="w-4 h-4"/> تغذية مرضى السكر</span>
        </button>
        <button 
          onClick={() => setActiveDiet('htn')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeDiet === 'htn' ? 'bg-red-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
        >
          <span className="flex items-center gap-2"><Heart className="w-4 h-4"/> تغذية الضغط (DASH)</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden p-6">
        {activeDiet === 'egyptian' && (
          <div className="space-y-4">
            <h3 className="font-bold text-2xl text-emerald-800">الأطعمة المصرية الشهيرة وسعراتها</h3>
            <p className="text-gray-600">تقديرات السعرات الحرارية لأشهر الأطباق (الكميات تقريبية وتعتمد على طريقة الطهي).</p>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse mt-4">
                <thead>
                  <tr className="border-b bg-emerald-50">
                    <th className="p-3 font-semibold text-emerald-900">الصنف</th>
                    <th className="p-3 font-semibold text-emerald-900">الكمية</th>
                    <th className="p-3 font-semibold text-emerald-900">السعرات التقريبية</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b"><td className="p-3 font-medium">كشري (بدون دقة/شطة إضافية)</td><td className="p-3">طبق متوسط (300 جم)</td><td className="p-3 font-bold text-emerald-700">400 - 500 سعرة</td></tr>
                  <tr className="border-b"><td className="p-3 font-medium">محشي كرنب / ورق عنب</td><td className="p-3">10 أصابع متوسطة</td><td className="p-3 font-bold text-emerald-700">250 - 300 سعرة</td></tr>
                  <tr className="border-b"><td className="p-3 font-medium">فول مدمس (بالزيت والليمون)</td><td className="p-3">نصف كوب (100 جم)</td><td className="p-3 font-bold text-emerald-700">150 سعرة</td></tr>
                  <tr className="border-b"><td className="p-3 font-medium">طعمية (فلافل) مقلية</td><td className="p-3">قرص واحد متوسط</td><td className="p-3 font-bold text-emerald-700">60 - 80 سعرة</td></tr>
                  <tr className="border-b"><td className="p-3 font-medium">ملوخية (بدون طشة سمن كثيرة)</td><td className="p-3">طبق صغير (150 جم)</td><td className="p-3 font-bold text-emerald-700">70 - 100 سعرة</td></tr>
                  <tr className="border-b"><td className="p-3 font-medium">عيش بلدي (رغيف)</td><td className="p-3">رغيف متوسط (100 جم)</td><td className="p-3 font-bold text-emerald-700">250 - 300 سعرة</td></tr>
                  <tr className="border-b"><td className="p-3 font-medium">بسبوسة بالمكسرات</td><td className="p-3">قطعة صغيرة (50 جم)</td><td className="p-3 font-bold text-emerald-700">220 سعرة</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">المصدر: المعهد القومي للتغذية (مصر) والجداول العالمية للقيم الغذائية.</p>
          </div>
        )}

        {activeDiet === 'dm' && (
          <div className="space-y-4">
            <h3 className="font-bold text-2xl text-blue-800">التعليمات الغذائية لمرضى السكري</h3>
            <ul className="list-disc list-inside space-y-3 text-gray-700 leading-relaxed">
              <li><strong>النشويات المعقدة:</strong> استبدل الخبز الأبيض والمكرونة بالحبوب الكاملة (الخبز البلدي الأسمر، الشوفان) لأنها لا ترفع السكر بسرعة (مؤشر جلايسيمي منخفض).</li>
              <li><strong>الخضروات غير النشوية:</strong> يجب أن تشكل نصف طبقك (الخيار، الجرجير، السبانخ، الكوسة، البامية).</li>
              <li><strong>البروتين الصافي:</strong> ربع الطبق من البروتين قليل الدسم (دجاج بدون جلد، سمك، بيض، عدس).</li>
              <li><strong>تقسيم الوجبات:</strong> تناول 3 وجبات رئيسية ووجبتين خفيفتين لتجنب تذبذب مستويات السكر بالدم.</li>
              <li><strong>الفاكهة:</strong> ثمرة أو ثمرتين يومياً (يفضل التفاح، البرتقال، الفراولة) والابتعاد عن العصائر تماماً لأنها تفقد الألياف.</li>
            </ul>
            <p className="text-sm bg-blue-50 p-3 rounded text-blue-900 border border-blue-100">
              المصدر: الجمعية الأمريكية لمرض السكري (ADA - American Diabetes Association).
            </p>
          </div>
        )}

        {activeDiet === 'htn' && (
          <div className="space-y-4">
            <h3 className="font-bold text-2xl text-red-800">حمية داش (DASH Diet) للضغط والقلب</h3>
            <p className="text-gray-600">حمية (Dietary Approaches to Stop Hypertension) أثبتت فعاليتها في خفض ضغط الدم وتحسين صحة القلب.</p>
            <ul className="list-disc list-inside space-y-3 text-gray-700 leading-relaxed mt-4">
              <li><strong>تقليل الصوديوم (الملح):</strong> الحد الأقصى 2300 ملجم يومياً (حوالي ملعقة صغيرة من الملح)، والأفضل 1500 ملجم. تجنب المخللات، اللحوم المصنعة (اللانشون، البسطرمة)، والمعلبات.</li>
              <li><strong>زيادة البوتاسيوم:</strong> يساعد على توازن الصوديوم. متوفر في: الموز، البطاطا الحلوة، السبانخ، الزبادي، والطماطم.</li>
              <li><strong>الألياف والحبوب الكاملة:</strong> تناول 6-8 حصص من الحبوب الكاملة يومياً (الشوفان، القمح الكامل).</li>
              <li><strong>الدهون الصحية:</strong> استخدم زيت الزيتون بدلاً من السمن الصناعي أو الزبدة. وتناول المكسرات النيئة (اللوز، الجوز).</li>
              <li><strong>اللحوم الحمراء:</strong> تقليل تناول اللحوم الحمراء إلى مرة أو مرتين أسبوعياً، والاعتماد الأكبر على الأسماك (مرتين أسبوعياً على الأقل).</li>
            </ul>
            <p className="text-sm bg-red-50 p-3 rounded text-red-900 border border-red-100">
              المصدر: جمعية القلب الأمريكية (AHA) والمعهد الوطني للقلب والرئة والدم (NHLBI).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
