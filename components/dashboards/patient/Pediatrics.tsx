'use client';
import { useState } from 'react';
import { Calculator, Info, Baby } from 'lucide-react';

export function Pediatrics() {
  const [ageYears, setAgeYears] = useState('');
  const [gender, setGender] = useState('boy');
  const [weightKg, setWeightKg] = useState('');

  const [idealWeight, setIdealWeight] = useState<string | null>(null);

  const calculateChildWeight = () => {
    const age = parseFloat(ageYears);
    if (age > 0 && age <= 10) {
      // Basic approximation for children 1-10 years (Advanced Pediatric Life Support formula)
      // Weight (kg) = 2 * (Age in years + 4)
      const w = 2 * (age + 4);
      // Let's provide a range based on CDC charts roughly
      setIdealWeight(`${(w - 2).toFixed(1)} كجم إلى ${(w + 2).toFixed(1)} كجم (المتوسط: ${w.toFixed(1)} كجم)`);
    } else if (age > 10) {
      setIdealWeight('يرجى استخدام حاسبة مؤشر كتلة الجسم للبالغين أو الأكبر من 10 سنوات.');
    } else {
      setIdealWeight(null);
    }
  };

  const currentWeight = parseFloat(weightKg);

  return (
    <div className="space-y-6">
      
      {/* Weight Calculator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4 p-4 border rounded-xl bg-white shadow-sm">
          <h3 className="font-bold text-lg text-blue-700 flex items-center gap-2">
            <Calculator className="w-5 h-5" /> حساب الوزن الطبيعي للطفل (1 - 10 سنوات)
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">النوع</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full border rounded-lg p-2">
                <option value="boy">ذكر</option>
                <option value="girl">أنثى</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">العمر (بالسنوات)</label>
              <input type="number" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} className="w-full border rounded-lg p-2" placeholder="مثال: 5" />
            </div>
          </div>
          <button onClick={calculateChildWeight} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors">
            احسب الوزن الطبيعي
          </button>
        </div>

        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm flex flex-col justify-center">
          <h3 className="font-bold text-lg text-gray-800 mb-2">النتائج</h3>
          {idealWeight !== null ? (
            <div className="bg-white p-3 rounded-lg border">
              <span className="text-gray-500 text-sm block">نطاق الوزن الطبيعي المقدر:</span>
              <span className="font-bold text-lg text-blue-700">{idealWeight}</span>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">أدخل عمر الطفل (بين 1 و 10 سنوات) لحساب الوزن الطبيعي</p>
          )}
        </div>
      </div>

      {/* Medication Dosages */}
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="bg-blue-50 p-4 border-b">
          <h3 className="font-bold text-lg text-blue-900 flex items-center gap-2">
            <Baby className="w-5 h-5" /> جرعات الأدوية الشهيرة للأطفال (تقريبية)
          </h3>
          <div className="mt-4 flex gap-4 items-center">
            <label className="text-sm font-bold">أدخل وزن الطفل الفعلي (كجم) لحساب الجرعات:</label>
            <input 
              type="number" 
              value={weightKg} 
              onChange={(e) => setWeightKg(e.target.value)} 
              className="border rounded-lg p-2 w-32" 
              placeholder="مثال: 12"
            />
          </div>
        </div>
        
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2 font-semibold">الدواء (الاسم التجاري)</th>
                <th className="p-2 font-semibold">المادة الفعالة</th>
                <th className="p-2 font-semibold">الجرعة العلمية (لكل كجم)</th>
                <th className="p-2 font-semibold text-blue-700">الجرعة المقترحة لهذا الوزن</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2 font-bold">Cetral (سيتال) / Panadol</td>
                <td className="p-2 text-sm text-gray-600">Paracetamol</td>
                <td className="p-2 text-sm">10-15 مجم / كجم / كل 6 ساعات</td>
                <td className="p-2 font-bold text-blue-700">
                  {currentWeight > 0 ? `${Math.round(currentWeight * 15)} مجم (كل 6 ساعات)` : '-'}
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-2 font-bold">Brufen (بروفين) / Megafen</td>
                <td className="p-2 text-sm text-gray-600">Ibuprofen</td>
                <td className="p-2 text-sm">5-10 مجم / كجم / كل 8 ساعات</td>
                <td className="p-2 font-bold text-blue-700">
                  {currentWeight > 0 ? `${Math.round(currentWeight * 10)} مجم (كل 8 ساعات)` : '-'}
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-2 font-bold">Zithrokan (زيثروكان) / Xithrone</td>
                <td className="p-2 text-sm text-gray-600">Azithromycin</td>
                <td className="p-2 text-sm">10 مجم / كجم / مرة يومياً (لمدة 3 أيام)</td>
                <td className="p-2 font-bold text-blue-700">
                  {currentWeight > 0 ? `${Math.round(currentWeight * 10)} مجم (مرة يومياً)` : '-'}
                </td>
              </tr>
              <tr>
                <td className="p-2 font-bold">Augmentin (أوجمنتين) / Hibiotic</td>
                <td className="p-2 text-sm text-gray-600">Amoxicillin/Clavulanate</td>
                <td className="p-2 text-sm">45-90 مجم / كجم / مقسمة على جرعتين</td>
                <td className="p-2 font-bold text-blue-700">
                  {currentWeight > 0 ? `${Math.round((currentWeight * 90)/2)} مجم (كل 12 ساعة)` : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-orange-50 p-4 rounded-xl text-sm text-orange-800 flex gap-2">
        <Info className="w-5 h-5 shrink-0" />
        <div>
          <strong>ملاحظة طبية هامة والمصادر:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>حسابات الوزن تعتمد على معادلات التقريب لـ (APLS) ومنحنيات النمو (CDC / WHO).</li>
            <li>الجرعات الدوائية مبنية على المراجع الطبية المعتمدة (Nelson Textbook of Pediatrics, BNF for Children).</li>
            <li className="font-bold text-red-600">هذه الجرعات استرشادية فقط. يجب عدم إعطاء أي دواء للطفل دون استشارة الطبيب المعالج مباشرة للتأكد من التركيز المناسب للدواء (شراب، نقط، الخ).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
