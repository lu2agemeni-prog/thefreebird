'use client';
import { useState } from 'react';
import { Calculator, Info } from 'lucide-react';

export function WomensHealth() {
  const [lmp, setLmp] = useState('');
  const [cycleLength, setCycleLength] = useState('28');

  const [edd, setEdd] = useState<Date | null>(null);
  const [ovulation, setOvulation] = useState<Date | null>(null);

  const calculateDates = () => {
    if (!lmp) return;
    
    const lmpDate = new Date(lmp);
    
    // Naegele's rule: EDD = LMP + 7 days - 3 months + 1 year
    // Simply: LMP + 280 days (for a 28-day cycle)
    const eddDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
    setEdd(eddDate);

    // Ovulation: Typically 14 days before the END of the cycle.
    // For a 28 day cycle, it's day 14. 
    // Cycle length - 14 days from the NEXT expected period.
    const cycle = parseInt(cycleLength) || 28;
    const ovulationDate = new Date(lmpDate.getTime() + (cycle - 14) * 24 * 60 * 60 * 1000);
    setOvulation(ovulationDate);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4 p-4 border rounded-xl bg-white shadow-sm">
          <h3 className="font-bold text-lg text-pink-700 flex items-center gap-2">
            <Calculator className="w-5 h-5" /> إدخال البيانات
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">تاريخ أول يوم لآخر دورة شهرية (LMP)</label>
              <input type="date" value={lmp} onChange={(e) => setLmp(e.target.value)} className="w-full border rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">طول الدورة الشهرية (بالأيام - المتوسط 28)</label>
              <input type="number" value={cycleLength} onChange={(e) => setCycleLength(e.target.value)} className="w-full border rounded-lg p-2" />
            </div>
          </div>
          <button onClick={calculateDates} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 rounded-lg transition-colors">
            احسب التواريخ
          </button>
        </div>

        <div className="p-4 border rounded-xl bg-gray-50 shadow-sm space-y-4">
          <h3 className="font-bold text-lg text-gray-800">النتائج</h3>
          
          {edd !== null && (
            <div className="bg-white p-3 rounded-lg border">
              <span className="text-gray-500 text-sm block">موعد الولادة الطبيعية المتوقع (EDD):</span>
              <span className="font-bold text-xl text-pink-700">
                {edd.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          )}

          {ovulation !== null && (
            <div className="bg-white p-3 rounded-lg border">
              <span className="text-gray-500 text-sm block">يوم التبويض المتوقع (أعلى فرصة للحمل):</span>
              <span className="font-bold text-xl text-emerald-700">
                {ovulation.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          )}

          {edd === null && <p className="text-gray-400 text-center py-8">قم بإدخال تاريخ آخر دورة واضغط على احسب</p>}
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 flex gap-2">
        <Info className="w-5 h-5 shrink-0" />
        <div>
          <strong>المصادر الطبية:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>موعد الولادة: قاعدة Naegele (الكلية الأمريكية لأطباء النساء والتوليد ACOG).</li>
            <li>موعد التبويض: يعتمد على طرح 14 يوم من طول الدورة الشهرية المتوقعة (ACOG).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
