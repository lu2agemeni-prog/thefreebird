'use client';

// ============================================================================
// components/dashboards/patient/PatientOffers.tsx
// تبويب "خصومات وعروض" عند المريض — بيعرض العروض السارية فقط (اللي لسه
// في فترتها ومفعّلة)، مع عدّاد تنازلي وزرار "احجز الآن" بيودّي المريض
// لتبويب حجز المواعيد مع تعبئة العيادة تلقائيًا.
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { Percent, Clock, Calendar, Loader2, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NewsImage } from '@/components/ui/news-image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';

function formatRemaining(endsAt: string, now: number) {
  const diffMs = new Date(endsAt).getTime() - now;
  if (diffMs <= 0) return 'انتهى العرض';
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `متبقي ${days} يوم${hours % 24 ? ` و${hours % 24} س` : ''}`;
  }
  return `متبقي ${hours} س ${mins} د`;
}

export interface PatientOffer {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  discount_percent: number | null;
  clinic_id: string | null;
  ends_at: string;
  clinic?: { name: string } | null;
}

export function PatientOffers({ onBookOffer }: { onBookOffer: (offer: PatientOffer) => void }) {
  const [offers, setOffers] = useState<PatientOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fetchOffers = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('offers')
      .select('id, title, description, image_url, discount_percent, clinic_id, ends_at, clinic:clinic_id(name)')
      .eq('is_active', true)
      .gt('ends_at', new Date().toISOString())
      .order('ends_at', { ascending: true });

    if (error) setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل العروض الحالية.'));
    else setOffers((data as any) || []);
    setLoading(false);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchOffers, 0);
    // تحديث دوري كل دقيقة — يشيل العروض اللي انتهت مدتها لوحده بدون ما
    // المريض يعمل ريفريش يدوي للصفحة، وبيحدّث العدّاد التنازلي كمان
    const interval = setInterval(fetchOffers, 60000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [fetchOffers]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Tag className="w-6 h-6 text-rose-600" /> خصومات وعروض
          </CardTitle>
          <p className="text-gray-500">أحدث العروض والخصومات المتاحة حاليًا — احجز واستفد بالعرض قبل ما ينتهي.</p>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <ErrorState message={loadError} onRetry={fetchOffers} compact />
          ) : loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : offers.length === 0 ? (
            <p className="text-center text-gray-500 py-8">لا توجد عروض متاحة حاليًا، تابعنا قريبًا لعروض جديدة!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {offers.map((offer) => (
                <div key={offer.id} className="border rounded-2xl bg-white shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                  <div className="h-40 relative overflow-hidden">
                    <NewsImage url={offer.image_url} alt={offer.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                    {offer.discount_percent != null && (
                      <div className="absolute top-3 right-3 bg-rose-600 text-white font-black text-lg px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1">
                        <Percent className="w-4 h-4" /> {offer.discount_percent}%
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{offer.title}</h3>
                    {offer.clinic?.name && <p className="text-xs text-emerald-700 font-bold mb-2">{offer.clinic.name}</p>}
                    <p className="text-gray-600 text-sm leading-relaxed mb-3 flex-1">{offer.description}</p>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 mb-4">
                      <Clock className="w-3.5 h-3.5" />
                      <span dir="ltr">{formatRemaining(offer.ends_at, now)}</span>
                    </div>
                    <button
                      onClick={() => onBookOffer(offer)}
                      className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-4 h-4" /> احجز الآن واستفد بالعرض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
