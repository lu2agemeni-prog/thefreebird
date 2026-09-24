'use client';

// ============================================================================
// components/dashboards/patient/PatientOffers.tsx
// تبويب "خصومات وعروض" عند المريض — بيعرض العروض السارية فقط (اللي لسه
// في فترتها ومفعّلة)، مع عدّاد تنازلي وزر "احجز الآن بضغطة واحدة"
// يقوم بتسجيل الحجز فوراً مع تفاصيل العرض وعرض رسالة "تم الحجز بنجاح".
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { Percent, Clock, Calendar, Loader2, Tag, Zap, CheckCircle2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
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

interface PatientOffersProps {
  onBookOffer?: (offer: PatientOffer) => Promise<{ success: boolean; error?: string }> | void;
  onGoToAppointments?: () => void;
}

export function PatientOffers({ onBookOffer, onGoToAppointments }: PatientOffersProps) {
  const { user } = useAuth();
  const [offers, setOffers] = useState<PatientOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [bookingOfferId, setBookingOfferId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookedOffer, setBookedOffer] = useState<PatientOffer | null>(null);

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
    // تحديث دوري كل دقيقة — يشيل العروض اللي انتهت مدتها لوحده
    const interval = setInterval(fetchOffers, 60000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [fetchOffers]);

  // حجز فوري بضغطة واحدة وتسجيل تفاصيل العرض في جدول المواعيد
  const handleDirectBook = async (offer: PatientOffer) => {
    if (onBookOffer) {
      setBookingOfferId(offer.id);
      setBookingError(null);
      const res = await onBookOffer(offer);
      setBookingOfferId(null);
      if (res && !res.success) {
        setBookingError(res.error || 'تعذر إتمام الحجز.');
      } else {
        setBookedOffer(offer);
      }
      return;
    }

    if (!user?.id) {
      setBookingError('يرجى تسجيل الدخول أولاً لتأكيد الحجز.');
      return;
    }

    setBookingOfferId(offer.id);
    setBookingError(null);

    const discountLabel = offer.discount_percent != null ? ` (خصم ${offer.discount_percent}%)` : '';
    const clinicLabel = offer.clinic?.name ? ` - عيادة ${offer.clinic.name}` : '';
    const note = `حجز فوري للاستفادة من عرض: ${offer.title}${discountLabel}${clinicLabel}`;

    const { error } = await supabase.from('appointments').insert([
      {
        patient_id: user.id,
        clinic_id: offer.clinic_id || null,
        doctor_id: null,
        appointment_date: new Date().toISOString(),
        status: 'pending',
        notes: note,
      },
    ]);

    setBookingOfferId(null);
    if (error) {
      setBookingError(getFriendlyErrorMessage(error, 'تعذر تسجيل الموعد، يرجى المحاولة لاحقاً.'));
    } else {
      setBookedOffer(offer);
    }
  };

  return (
    <div className="space-y-6">
      {/* نجاح الحجز - نافذة منبثقة سريعة أو إشعار بارز */}
      {bookedOffer && (
        <div className="p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-emerald-900 font-black text-lg">تم الحجز بنجاح! 🎉</h4>
              <p className="text-emerald-700 text-sm font-medium">
                تم تسجيل موعدك للاستفادة من عرض: <span className="font-bold underline">{bookedOffer.title}</span>
                {bookedOffer.discount_percent != null && ` بنسبة خصم ${bookedOffer.discount_percent}%`}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onGoToAppointments && (
              <button
                onClick={onGoToAppointments}
                className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Calendar className="w-4 h-4" /> عرض مواعيدي
              </button>
            )}
            <button
              onClick={() => setBookedOffer(null)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-emerald-100/50 transition-colors"
              aria-label="إغلاق الإشعار"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {bookingError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl font-medium flex items-center justify-between">
          <span>{bookingError}</span>
          <button onClick={() => setBookingError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-2xl font-black text-gray-900">
              <Tag className="w-6 h-6 text-rose-600 animate-pulse" /> خصومات وعروض حصرية
            </CardTitle>
            <span className="bg-rose-100 text-rose-700 text-xs font-black px-3 py-1 rounded-full border border-rose-200 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 fill-rose-600" /> الحجز فوري بضغطة واحدة
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            أحدث العروض والتخفيضات المتاحة حالياً — احجز موعدك بضغطة واحدة قبل انتهاء العرض لتسجيل الخصم باسمك.
          </p>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <ErrorState message={loadError} onRetry={fetchOffers} compact />
          ) : loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : offers.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-bold text-base">لا توجد عروض متاحة حالياً</p>
              <p className="text-gray-400 text-xs mt-1">تابعنا باستمرار للاطلاع على أحدث العروض والخصومات القادمة!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {offers.map((offer) => {
                const isThisBooking = bookingOfferId === offer.id;
                const isBooked = bookedOffer?.id === offer.id;

                return (
                  <div 
                    key={offer.id} 
                    className="border border-gray-100 rounded-3xl bg-white shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col hover:border-emerald-200"
                  >
                    <div className="h-44 relative overflow-hidden bg-gray-50">
                      <NewsImage 
                        url={offer.image_url} 
                        alt={offer.title} 
                        fill 
                        sizes="(max-width: 768px) 100vw, 50vw" 
                        className="object-cover" 
                      />
                      {offer.discount_percent != null && (
                        <div className="absolute top-3 right-3 bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-lg px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1 animate-pulse">
                          <Percent className="w-4 h-4" /> {offer.discount_percent}%
                        </div>
                      )}
                      <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-amber-300 font-bold text-xs px-3 py-1 rounded-lg flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span dir="ltr">{formatRemaining(offer.ends_at, now)}</span>
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h3 className="text-lg font-black text-gray-900">{offer.title}</h3>
                          {offer.clinic?.name && (
                            <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                              {offer.clinic.name}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm leading-relaxed mb-4">{offer.description}</p>
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        {isBooked ? (
                          <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            تم تسجيل حجزك بهذا العرض بنجاح ✓
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDirectBook(offer)}
                            disabled={isThisBooking}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 text-sm"
                          >
                            {isThisBooking ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                جاري تسجيل الحجز بضغطة واحدة...
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                                احجز الآن بضغطة واحدة
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
