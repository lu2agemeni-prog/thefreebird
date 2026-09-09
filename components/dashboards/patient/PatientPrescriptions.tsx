'use client';

// ============================================================================
// components/dashboards/patient/PatientPrescriptions.tsx
// المريض بيشوف روشتاته، يفتح تفاصيل كل واحدة، يحمّلها (طباعة/PDF)،
// ويقيّم الخدمة (نجوم + تعليق) لو لسه ما قيّمهاش.
// ============================================================================

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  FileText, Loader2, Pill, FlaskConical, ScanLine, Calendar,
  Star, Printer, ChevronDown, ChevronUp,
} from 'lucide-react';

export function PatientPrescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchPrescriptions();
  }, [user]);

  const fetchPrescriptions = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*, doctor:doctor_id(first_name, last_name)')
      .eq('patient_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل الروشتات.'));
    } else if (data) {
      setPrescriptions(data);
    }
    setLoading(false);
  };

  const submitRating = async (id: string, rating: number, comment: string) => {
    const { error } = await supabase.from('prescriptions').update({ rating, rating_comment: comment || null }).eq('id', id);
    if (!error) fetchPrescriptions();
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchPrescriptions} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">الروشتات</h2>
      </div>

      {prescriptions.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-gray-400">لا توجد روشتات مسجّلة بعد</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {prescriptions.map(p => (
            <PrescriptionCard
              key={p.id}
              prescription={p}
              expanded={expandedId === p.id}
              onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              onRate={(rating, comment) => submitRating(p.id, rating, comment)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PrescriptionCard({ prescription: p, expanded, onToggle, onRate }: {
  prescription: any; expanded: boolean; onToggle: () => void; onRate: (rating: number, comment: string) => void;
}) {
  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState('');

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const doctorName = `${p.doctor?.first_name || ''} ${p.doctor?.last_name || ''}`.trim();
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>روشتة طبية</title>
        <style>
          body { font-family: 'Tahoma', sans-serif; padding: 40px; color: #1f2937; }
          h1 { color: #059669; border-bottom: 2px solid #059669; padding-bottom: 10px; }
          h3 { margin-top: 24px; color: #374151; }
          .meta { color: #6b7280; margin-bottom: 20px; }
          ul { padding-right: 20px; }
          li { margin-bottom: 6px; }
          .notes { background: #f9fafb; padding: 12px; border-radius: 8px; margin-top: 8px; }
        </style>
      </head>
      <body>
        <h1>الطائر الحر — روشتة طبية</h1>
        <div class="meta">
          التاريخ: ${new Date(p.created_at).toLocaleDateString('ar-EG')}<br/>
          الطبيب: ${doctorName || 'غير محدد'}
        </div>
        ${p.medications?.length ? `<h3>الأدوية</h3><ul>${p.medications.map((m: any) =>
          `<li><strong>${m.name}</strong>${m.dosage ? ' — ' + m.dosage : ''}${m.instructions ? ' (' + m.instructions + ')' : ''}</li>`
        ).join('')}</ul>` : ''}
        ${p.lab_tests?.length ? `<h3>التحاليل المطلوبة</h3><ul>${p.lab_tests.map((l: any) => `<li>${l.name}</li>`).join('')}</ul>` : ''}
        ${p.radiology?.length ? `<h3>الأشعة المطلوبة</h3><ul>${p.radiology.map((r: any) => `<li>${r.name}</li>`).join('')}</ul>` : ''}
        ${p.notes ? `<h3>ملاحظات</h3><div class="notes">${p.notes}</div>` : ''}
        ${p.follow_up_date ? `<h3>ميعاد الاستشارة القادمة</h3><p>${new Date(p.follow_up_date).toLocaleString('ar-EG')}</p>` : ''}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Card>
      <CardContent className="p-5">
        <button onClick={onToggle} className="w-full flex items-center justify-between text-right">
          <div>
            <div className="font-bold text-gray-800">
              روشتة بتاريخ {new Date(p.created_at).toLocaleDateString('ar-EG')}
            </div>
            <div className="text-sm text-gray-500">
              د. {p.doctor?.first_name} {p.doctor?.last_name}
            </div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {p.medications?.length > 0 && (
              <div>
                <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2 mb-2">
                  <Pill className="w-4 h-4 text-emerald-600" /> الأدوية
                </h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {p.medications.map((m: any, i: number) => (
                    <li key={i} className="bg-gray-50 rounded-lg p-2">
                      <span className="font-bold">{m.name}</span>
                      {m.dosage && <span> — {m.dosage}</span>}
                      {m.instructions && <div className="text-xs text-gray-400 mt-1">{m.instructions}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {p.lab_tests?.length > 0 && (
              <div>
                <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2 mb-2">
                  <FlaskConical className="w-4 h-4 text-blue-600" /> التحاليل المطلوبة
                </h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {p.lab_tests.map((l: any, i: number) => <li key={i}>• {l.name}</li>)}
                </ul>
              </div>
            )}

            {p.radiology?.length > 0 && (
              <div>
                <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2 mb-2">
                  <ScanLine className="w-4 h-4 text-purple-600" /> الأشعة المطلوبة
                </h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {p.radiology.map((r: any, i: number) => <li key={i}>• {r.name}</li>)}
                </ul>
              </div>
            )}

            {p.notes && (
              <div>
                <h4 className="font-bold text-sm text-gray-700 mb-2">ملاحظات</h4>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{p.notes}</p>
              </div>
            )}

            {p.follow_up_date && (
              <div>
                <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-orange-600" /> ميعاد الاستشارة القادمة
                </h4>
                <p className="text-sm text-gray-600">{new Date(p.follow_up_date).toLocaleString('ar-EG')}</p>
              </div>
            )}

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:underline"
            >
              <Printer className="w-4 h-4" /> تحميل الروشتة (طباعة / PDF)
            </button>

            <div className="pt-4 border-t">
              {p.rating ? (
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} className={`w-5 h-5 ${n <= p.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">شكرًا لتقييمك</span>
                  {p.rating_comment && <span className="text-sm text-gray-400">— {p.rating_comment}</span>}
                </div>
              ) : (
                <div>
                  <h4 className="font-bold text-sm text-gray-700 mb-2">قيّم الخدمة</h4>
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setRatingValue(n)}>
                        <Star className={`w-6 h-6 ${n <= ratingValue ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="تعليق اختياري..."
                    rows={2}
                    className="w-full border rounded-lg p-2 text-sm mb-2"
                  />
                  <button
                    onClick={() => onRate(ratingValue, comment)}
                    disabled={ratingValue === 0}
                    className="bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    إرسال التقييم
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
