'use client';

// ============================================================================
// components/dashboards/patient/PatientOfferModal.tsx
// مودال ترحيبي يظهر تلقائياً للمريض عند فتح التطبيق إذا كان هناك عروض سارية.
// يحتوي على زر إغلاق (Close) وإمكانية الحجز بضغطة واحدة مع تسجيل تفاصيل العرض
// وعرض رسالة تأكيد النجاح فوراً دون فتح صفحة حجز معقدة.
// ============================================================================
import React, { useState } from 'react';
import { X, Sparkles, Percent, Clock, Calendar, CheckCircle2, ChevronRight, ChevronLeft, Loader2, Building, Zap } from 'lucide-react';
import { NewsImage } from '@/components/ui/news-image';
import { type PatientOffer } from './PatientOffers';

interface PatientOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  offers: PatientOffer[];
  onBookOffer: (offer: PatientOffer) => Promise<{ success: boolean; error?: string }>;
  onGoToAppointments: () => void;
}

function formatRemaining(endsAt: string) {
  const diffMs = new Date(endsAt).getTime() - Date.now();
  if (diffMs <= 0) return 'انتهى العرض';
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `متبقي ${days} يوم${hours % 24 ? ` و${hours % 24} س` : ''}`;
  }
  return `متبقي ${hours} س ${mins} د`;
}

export function PatientOfferModal({
  isOpen,
  onClose,
  offers,
  onBookOffer,
  onGoToAppointments,
}: PatientOfferModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [successOffer, setSuccessOffer] = useState<PatientOffer | null>(null);

  if (!isOpen || offers.length === 0) return null;

  const currentOffer = offers[Math.min(currentIndex, offers.length - 1)];

  const handleBook = async () => {
    if (!currentOffer) return;
    setLoading(true);
    setBookingError(null);
    const result = await onBookOffer(currentOffer);
    setLoading(false);
    if (result.success) {
      setSuccessOffer(currentOffer);
    } else {
      setBookingError(result.error || 'تعذر إتمام الحجز، يرجى المحاولة مرة أخرى.');
    }
  };

  const handleNext = () => {
    setBookingError(null);
    setCurrentIndex((prev) => (prev + 1) % offers.length);
  };

  const handlePrev = () => {
    setBookingError(null);
    setCurrentIndex((prev) => (prev - 1 + offers.length) % offers.length);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 flex flex-col max-h-[90vh]">
        {/* Top Header Ribbon */}
        <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 p-4 text-white flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
            </span>
            <div>
              <h3 className="font-black text-base md:text-lg leading-tight">عروض وتخفيضات خاصة!</h3>
              <p className="text-xs text-rose-100 font-medium">احجز الآن بضغطة واحدة واستفد بالخصم</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            aria-label="إغلاق الإعلان"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-4">
          {successOffer ? (
            /* Success State */
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-gray-900">تم الحجز بنجاح! 🎉</h4>
                <p className="text-emerald-700 font-bold text-base">
                  تم تسجيل موعدك للاستفادة من عرض:
                </p>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-right space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-gray-900 text-lg">{successOffer.title}</span>
                    {successOffer.discount_percent != null && (
                      <span className="bg-rose-600 text-white text-xs font-black px-2.5 py-1 rounded-lg">
                        خصم {successOffer.discount_percent}%
                      </span>
                    )}
                  </div>
                  {successOffer.clinic?.name && (
                    <p className="text-xs text-emerald-800 font-semibold flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" /> {successOffer.clinic.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 pt-1 border-t border-emerald-100">
                    تم إدراج هذا العرض في سجل مواعيدك بحالة (قيد الانتظار)، وسيتواصل معك موظف الاستقبال لتأكيد الحضور.
                  </p>
                </div>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    onClose();
                    onGoToAppointments();
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" /> عرض تفاصيل مواعيدي
                </button>
                <button
                  onClick={onClose}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-5 rounded-xl transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            /* Offer Display State */
            <>
              {/* Multi-offer switcher if more than one */}
              {offers.length > 1 && (
                <div className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 text-xs text-gray-600 font-bold">
                  <button
                    onClick={handlePrev}
                    className="p-1 hover:bg-white rounded-lg transition-colors flex items-center gap-1 text-gray-700"
                  >
                    <ChevronRight className="w-4 h-4" /> العرض السابق
                  </button>
                  <span>عرض {currentIndex + 1} من {offers.length}</span>
                  <button
                    onClick={handleNext}
                    className="p-1 hover:bg-white rounded-lg transition-colors flex items-center gap-1 text-gray-700"
                  >
                    العرض التالي <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Offer Image */}
              <div className="relative h-48 md:h-56 w-full rounded-2xl overflow-hidden bg-gray-100 shadow-sm border border-gray-100">
                <NewsImage
                  url={currentOffer.image_url}
                  alt={currentOffer.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  className="object-cover"
                />
                {currentOffer.discount_percent != null && (
                  <div className="absolute top-3 right-3 bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-lg px-3.5 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 animate-pulse">
                    <Percent className="w-4 h-4" /> خصم {currentOffer.discount_percent}%
                  </div>
                )}
                <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-amber-300 font-bold text-xs px-3 py-1 rounded-lg flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span dir="ltr">{formatRemaining(currentOffer.ends_at)}</span>
                </div>
              </div>

              {/* Offer Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-xl font-black text-gray-900 leading-snug">
                    {currentOffer.title}
                  </h4>
                  {currentOffer.clinic?.name && (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      {currentOffer.clinic.name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed max-h-32 overflow-y-auto">
                  {currentOffer.description}
                </p>
              </div>

              {/* Error feedback if any */}
              {bookingError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                  {bookingError}
                </div>
              )}

              {/* Actions: One-click Booking & Close */}
              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  onClick={handleBook}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-3.5 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري تسجيل حجزك بضغطة واحدة...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 fill-amber-300 text-amber-300 animate-pulse" />
                      احجز الآن بضغطة واحدة واستفد بالعرض
                    </>
                  )}
                </button>

                <button
                  onClick={onClose}
                  className="w-full text-center py-2 text-xs text-gray-500 hover:text-gray-800 transition-colors font-medium"
                >
                  إغلاق التنبيه والتصفح لاحقاً
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
