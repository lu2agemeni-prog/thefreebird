'use client';

// ============================================================================
// components/dashboards/secretary/AddQueueServiceModal.tsx
// ضم خدمة إضافية لنفس زيارة المريض في طابور النداء (تحاليل/أشعة بعد
// الكشف مثلاً)، مع عرض كل الخدمات المضمومة سابقًا وإجمالي السعر.
// ============================================================================

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { X, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { ServicePicker, EMPTY_SERVICE_VALUE, resolveServiceSelection, type ServicePickerValue } from './ServicePicker';

interface AddQueueServiceModalProps {
  queueId: string;
  clinicId: string;
  patientName: string;
  onClose: () => void;
  onChanged: () => void;
}

export function AddQueueServiceModal({ queueId, clinicId, patientName, onClose, onChanged }: AddQueueServiceModalProps) {
  const { user } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serviceValue, setServiceValue] = useState<ServicePickerValue>(EMPTY_SERVICE_VALUE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadError(null);
    setLoading(true);
    const [servicesRes, linesRes] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true),
      supabase.from('queue_services').select('*, service:service_id(name)').eq('queue_id', queueId).order('created_at', { ascending: true }),
    ]);
    if (servicesRes.error) {
      setLoadError(getFriendlyErrorMessage(servicesRes.error, 'تعذر تحميل قائمة الخدمات.'));
      setLoading(false);
      return;
    }
    setServices(servicesRes.data || []);
    if (linesRes.data) setLines(linesRes.data);
    setLoading(false);
  };

  const total = lines.reduce((sum, l) => sum + (l.price || 0), 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const resolved = await resolveServiceSelection(supabase, clinicId, serviceValue);
    const price = resolved.serviceId
      ? (services.find(s => s.id === resolved.serviceId)?.price || 0)
      : resolved.price;

    if (!resolved.serviceId && !resolved.customName) {
      setSubmitting(false);
      setError('اختر خدمة أو اكتب اسم خدمة مخصّصة.');
      return;
    }

    const { error: insertError } = await supabase.from('queue_services').insert([{
      queue_id: queueId,
      service_id: resolved.serviceId,
      custom_name: resolved.customName,
      price,
      added_by: user?.id || null,
    }]);

    setSubmitting(false);

    if (insertError) {
      setError(getFriendlyErrorMessage(insertError, 'تعذر ضم الخدمة.'));
      return;
    }

    setServiceValue(EMPTY_SERVICE_VALUE);
    fetchData();
    onChanged();
  };

  const removeLine = async (id: string) => {
    const { error: deleteError } = await supabase.from('queue_services').delete().eq('id', id);
    if (!deleteError) {
      fetchData();
      onChanged();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-600" /> ضم خدمة
            </h3>
            <p className="text-sm text-gray-500">{patientName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : loadError ? (
          <div className="p-6"><InlineError message={loadError} /></div>
        ) : (
          <div className="p-5 space-y-4">
            {lines.length > 0 && (
              <div className="border rounded-xl divide-y">
                {lines.map(l => (
                  <div key={l.id} className="flex items-center justify-between p-3">
                    <span className="text-sm font-bold text-gray-700">{l.service?.name || l.custom_name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">{l.price} ج.م</span>
                      <button onClick={() => removeLine(l.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-gray-50 font-bold">
                  <span>الإجمالي</span>
                  <span>{total} ج.م</span>
                </div>
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-3">
              <ServicePicker clinicId={clinicId} services={services} value={serviceValue} onChange={setServiceValue} />
              {error && <InlineError message={error} />}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                إضافة للخدمات
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
