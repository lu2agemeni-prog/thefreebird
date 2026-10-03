'use client';

// ============================================================================
// components/dashboards/secretary/QuickTokenModal.tsx
// نافذة سحب دور سريع (Quick Token) بنقرة واحدة أثناء أوقات الذروة:
// - تتيح للسكرتارية حجز رقم دور فوري في ثانية واحدة دون ملء بيانات الزيارة كاملة.
// - العميل يستلم تذكرته ويجلس في صالة الانتظار ويظهر رقمه فوراً في شاشة العرض.
// - يمكن للسكرتارية في أي وقت لاحق استكمال بيانات المريض والخدمات والتحصيل المالي.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { X, Zap, Loader2, Stethoscope, User, Phone, Building, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface QuickTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinics: any[];
  doctors: any[];
  defaultClinicId?: string;
  onSuccess: (info: { tokenNumber: number; clinicName: string; patientName: string }) => void;
}

export function QuickTokenModal({
  isOpen,
  onClose,
  clinics,
  doctors,
  defaultClinicId,
  onSuccess,
}: QuickTokenModalProps) {
  const { user } = useAuth();
  const [clinicId, setClinicId] = useState<string>('');
  const [doctorId, setDoctorId] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setClinicId(defaultClinicId || clinics[0]?.id || '');
      setDoctorId('');
      setPatientName('');
      setPhone('');
      setError(null);
    }
  }, [isOpen, defaultClinicId, clinics]);

  if (!isOpen) return null;

  // قائمة الأطباء المتاحين للعيادة المختارة
  const clinicDoctors = doctors.filter(
    (d) => !clinicId || d.clinic_id === clinicId || (d.clinics && d.clinics.id === clinicId)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) {
      setError('يرجى اختيار العيادة المطلوبة.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. توليد رقم الدور المتسلسل للعيادة لليوم
      const { data: token, error: tokenErr } = await supabase.rpc('get_next_queue_number', {
        p_clinic_id: clinicId,
      });

      if (tokenErr || token === null || token === undefined) {
        throw tokenErr || new Error('تعذر حجز رقم دور للعيادة.');
      }

      const assignedToken = Number(token);
      const chosenName = patientName.trim() || `زائر #${assignedToken}`;
      const selectedClinic = clinics.find((c) => c.id === clinicId);
      const clinicName = selectedClinic?.name || 'العيادة';

      // 2. إدراج صف فوري في جدول call_queue بحالة waiting ودون visit_group_id (دور سريع غير مكتمل البيانات)
      const { error: insertErr } = await supabase.from('call_queue').insert([
        {
          clinic_id: clinicId,
          doctor_id: doctorId || null,
          patient_name: chosenName,
          phone: phone.trim() || null,
          token_number: assignedToken,
          status: 'waiting',
          paid_amount: 0,
          remaining_amount: 0,
          collected_by: user?.id || null,
          visit_group_id: null, // علامة مميزة: دور سريع لم تُسجل بيانات زيارته الكاملة بعد
        },
      ]);

      if (insertErr) throw insertErr;

      onSuccess({
        tokenNumber: assignedToken,
        clinicName,
        patientName: chosenName,
      });
      onClose();
    } catch (err: any) {
      console.error('Error generating quick token:', err);
      setError(err?.message || 'حدث خطأ أثناء حجز رقم الدور السريع.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* الترويسة */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Zap className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="font-black text-base">سحب دور سريع ⚡</h3>
              <p className="text-xs text-amber-100 mt-0.5">حجز فوري للتذكرة في صالة الانتظار خلال ثوانٍ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* نموذج الإدخال السريع */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-900 leading-relaxed">
            💡 <strong>توفير الوقت في أوقات الزحام:</strong> سيتولى النظام حجز رقم الدور فوراً ليدخل المريض صالة الانتظار ويظهر على الشاشة، وتستطيعين استكمال بيانات المريض والخدمات والتحصيل لاحقاً.
          </div>

          {/* اختيار العيادة */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-amber-600" />
              <span>العيادة المطلوبة <span className="text-red-500">*</span></span>
            </label>
            <select
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-amber-500 focus:bg-white"
            >
              <option value="" disabled>-- اختر العيادة --</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* اسم المريض أو الزائر (اختياري) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-600" />
                <span>اسم المريض / الزائر (اختياري)</span>
              </span>
              <span className="text-[11px] text-gray-400 font-normal">يمكن تركه فارغاً وسيتم تسميته تلقائياً</span>
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="مثال: محمد أحمد (أو اتركيه فارغاً)"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          {/* رقم الهاتف (اختياري) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-600" />
              <span>رقم الهاتف (اختياري)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              dir="ltr"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 text-right focus:outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          {/* الطبيب (اختياري) */}
          {clinicDoctors.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-amber-600" />
                <span>الطبيب المتواجد (اختياري)</span>
              </label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500 focus:bg-white"
              >
                <option value="">-- أي طبيب متاح في العيادة --</option>
                {clinicDoctors.map((doc) => {
                  const docName = doc.profiles ? `${doc.profiles.first_name || ''} ${doc.profiles.last_name || ''}`.trim() : 'طبيب';
                  return (
                    <option key={doc.profile_id} value={doc.profile_id}>
                      د. {docName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* أزرار الإجراء */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={loading || !clinicId}
              className="flex-[2] py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-black shadow-lg shadow-amber-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري حجز التذكرة...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-amber-200" />
                  <span>حجز الدور الفوري الآن</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
