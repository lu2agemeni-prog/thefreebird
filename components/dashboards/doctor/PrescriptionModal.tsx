'use client';

// ============================================================================
// components/dashboards/doctor/PrescriptionModal.tsx
// نافذة إصدار روشتة لمريض محدد: أدوية، تحاليل، أشعة، ملاحظات، وميعاد
// الاستشارة القادمة. عند الحفظ يترسل إشعار تلقائي للمريض (عبر trigger).
// ============================================================================

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { X, Loader2, Plus, Trash2, Pill, FlaskConical, ScanLine, FileText } from 'lucide-react';
import { InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';

interface PrescriptionModalProps {
  patient: { id: string; name: string };
  existing?: any; // لو موجودة، النافذة بتشتغل في وضع "تعديل" بدل "إنشاء"
  onClose: () => void;
  onSaved: () => void;
}

interface MedItem { name: string; dosage: string; instructions: string; }
interface SimpleItem { name: string; }

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PrescriptionModal({ patient, existing, onClose, onSaved }: PrescriptionModalProps) {
  const { user } = useAuth();
  const isEditing = !!existing;
  const [medications, setMedications] = useState<MedItem[]>(existing?.medications || []);
  const [labTests, setLabTests] = useState<SimpleItem[]>(existing?.lab_tests || []);
  const [radiology, setRadiology] = useState<SimpleItem[]>(existing?.radiology || []);
  const [notes, setNotes] = useState(existing?.notes || '');
  const [followUpDate, setFollowUpDate] = useState(toLocalDatetimeInput(existing?.follow_up_date || null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMedication = () => setMedications(m => [...m, { name: '', dosage: '', instructions: '' }]);
  const updateMedication = (i: number, field: keyof MedItem, value: string) =>
    setMedications(m => m.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  const removeMedication = (i: number) => setMedications(m => m.filter((_, idx) => idx !== i));

  const addSimpleItem = (setter: React.Dispatch<React.SetStateAction<SimpleItem[]>>) =>
    setter(list => [...list, { name: '' }]);
  const updateSimpleItem = (setter: React.Dispatch<React.SetStateAction<SimpleItem[]>>, i: number, value: string) =>
    setter(list => list.map((item, idx) => idx === i ? { name: value } : item));
  const removeSimpleItem = (setter: React.Dispatch<React.SetStateAction<SimpleItem[]>>, i: number) =>
    setter(list => list.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const cleanMeds = medications.filter(m => m.name.trim());
    const cleanLabs = labTests.filter(l => l.name.trim());
    const cleanRadiology = radiology.filter(r => r.name.trim());

    const payload = {
      medications: cleanMeds,
      lab_tests: cleanLabs,
      radiology: cleanRadiology,
      notes: notes.trim() || null,
      follow_up_date: followUpDate ? new Date(followUpDate).toISOString() : null,
    };

    const { error: saveError } = isEditing
      ? await supabase.from('prescriptions').update(payload).eq('id', existing.id)
      : await supabase.from('prescriptions').insert([{ ...payload, patient_id: patient.id, doctor_id: user?.id }]);

    setSubmitting(false);

    if (saveError) {
      setError(getFriendlyErrorMessage(saveError, 'تعذر حفظ الروشتة.'));
      return;
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{isEditing ? 'تعديل الروشتة' : 'روشتة جديدة'}</h3>
            <p className="text-sm text-gray-500">المريض: {patient.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          {/* الأدوية */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-700 flex items-center gap-2">
                <Pill className="w-4 h-4 text-emerald-600" /> الأدوية
              </h4>
              <button type="button" onClick={addMedication} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:underline">
                <Plus className="w-4 h-4" /> إضافة دواء
              </button>
            </div>
            <div className="space-y-2">
              {medications.map((med, i) => (
                <div key={i} className="flex gap-2 items-start bg-gray-50 p-3 rounded-lg">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      placeholder="اسم الدواء"
                      value={med.name}
                      onChange={(e) => updateMedication(i, 'name', e.target.value)}
                      className="border rounded-lg p-2 text-sm"
                    />
                    <input
                      placeholder="الجرعة (مثال: 500mg مرتين يوميًا)"
                      value={med.dosage}
                      onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
                      className="border rounded-lg p-2 text-sm"
                    />
                    <input
                      placeholder="تعليمات إضافية"
                      value={med.instructions}
                      onChange={(e) => updateMedication(i, 'instructions', e.target.value)}
                      className="border rounded-lg p-2 text-sm"
                    />
                  </div>
                  <button type="button" onClick={() => removeMedication(i)} className="text-red-400 hover:text-red-600 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {medications.length === 0 && <p className="text-sm text-gray-400 py-2">لا توجد أدوية مضافة</p>}
            </div>
          </section>

          {/* التحاليل */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-700 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-blue-600" /> التحاليل المطلوبة
              </h4>
              <button type="button" onClick={() => addSimpleItem(setLabTests)} className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline">
                <Plus className="w-4 h-4" /> إضافة تحليل
              </button>
            </div>
            <div className="space-y-2">
              {labTests.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    placeholder="اسم التحليل"
                    value={item.name}
                    onChange={(e) => updateSimpleItem(setLabTests, i, e.target.value)}
                    className="flex-1 border rounded-lg p-2 text-sm"
                  />
                  <button type="button" onClick={() => removeSimpleItem(setLabTests, i)} className="text-red-400 hover:text-red-600 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {labTests.length === 0 && <p className="text-sm text-gray-400 py-2">لا توجد تحاليل مضافة</p>}
            </div>
          </section>

          {/* الأشعة */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-700 flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-purple-600" /> الأشعة المطلوبة
              </h4>
              <button type="button" onClick={() => addSimpleItem(setRadiology)} className="text-purple-600 text-sm font-bold flex items-center gap-1 hover:underline">
                <Plus className="w-4 h-4" /> إضافة أشعة
              </button>
            </div>
            <div className="space-y-2">
              {radiology.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    placeholder="نوع الأشعة"
                    value={item.name}
                    onChange={(e) => updateSimpleItem(setRadiology, i, e.target.value)}
                    className="flex-1 border rounded-lg p-2 text-sm"
                  />
                  <button type="button" onClick={() => removeSimpleItem(setRadiology, i)} className="text-red-400 hover:text-red-600 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {radiology.length === 0 && <p className="text-sm text-gray-400 py-2">لا توجد أشعة مضافة</p>}
            </div>
          </section>

          {/* ملاحظات */}
          <section>
            <h4 className="font-bold text-gray-700 flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-600" /> ملاحظات إضافية
            </h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border rounded-lg p-3 text-sm"
              placeholder="أي توجيهات أو ملاحظات للمريض..."
            />
          </section>

          {/* ميعاد الاستشارة */}
          <section>
            <label className="font-bold text-gray-700 mb-2 block">تحديد ميعاد الاستشارة القادمة</label>
            <input
              type="datetime-local"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm"
            />
          </section>

          {error && <InlineError message={error} />}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
            {isEditing ? 'حفظ التعديلات' : 'حفظ الروشتة وإرسال إشعار للمريض'}
          </button>
        </form>
      </div>
    </div>
  );
}