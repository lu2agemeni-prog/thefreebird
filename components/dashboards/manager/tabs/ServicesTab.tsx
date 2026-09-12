'use client';

// ============================================================================
// components/dashboards/manager/tabs/ServicesTab.tsx
// تبويب "الخدمات والأسعار" — مستخرج من ManagerDashboard.tsx بنفس السلوك.
// ملحوظة صغيرة: serviceError كانت موجودة بس مش متعرضة في الواجهة أصلاً —
// ضفنا عرضها تحت الجدول (تصحيح بسيط أثناء النقل، مش تغيير سلوك مقصود).
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Pencil, X, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';

const FETCH_CAP = 2000;

export function ServicesTab() {
  const [clinics, setClinics] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceClinicId, setServiceClinicId] = useState('');

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServicePrice, setEditServicePrice] = useState('');
  const [editServiceClinicId, setEditServiceClinicId] = useState('');
  const [editServiceActive, setEditServiceActive] = useState(true);
  const [savingService, setSavingService] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  const fetchClinics = useCallback(async () => {
    const { data } = await supabase.from('clinics').select('*').limit(FETCH_CAP);
    setClinics(data || []);
  }, []);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('services').select('*, clinic:clinic_id(name)').order('name', { ascending: true }).limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل الخدمات.'));
    else setServices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClinics(); fetchServices(); }, [fetchClinics, fetchServices]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName || !servicePrice || !serviceClinicId) return alert('الرجاء إدخال اسم الخدمة والسعر والعيادة');
    const { error } = await supabase.from('services').insert([{
      name: serviceName,
      price: parseFloat(servicePrice),
      clinic_id: serviceClinicId === 'general' ? null : serviceClinicId,
    }]);
    if (!error) {
      alert('تم إضافة الخدمة بنجاح');
      setServiceName('');
      setServicePrice('');
      setServiceClinicId('');
      fetchServices();
    } else {
      console.error(error);
      alert('حدث خطأ أثناء إضافة الخدمة');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الخدمة؟')) {
      await supabase.from('services').delete().eq('id', id);
      fetchServices();
    }
  };

  const startEditService = (service: any) => {
    setEditingServiceId(service.id);
    setEditServiceName(service.name || '');
    setEditServicePrice(String(service.price ?? ''));
    setEditServiceClinicId(service.clinic_id || 'general');
    setEditServiceActive(service.is_active !== false);
    setServiceError(null);
  };

  const handleSaveService = async (id: string) => {
    setServiceError(null);
    if (!editServiceName.trim() || editServicePrice === '' || isNaN(Number(editServicePrice))) {
      setServiceError('يرجى إدخال اسم الخدمة وسعر صحيح.');
      return;
    }
    setSavingService(true);
    const { error } = await supabase
      .from('services')
      .update({
        name: editServiceName.trim(),
        price: Number(editServicePrice),
        clinic_id: editServiceClinicId === 'general' ? null : editServiceClinicId,
        is_active: editServiceActive,
      })
      .eq('id', id);
    setSavingService(false);
    if (error) {
      setServiceError(getFriendlyErrorMessage(error, 'تعذر حفظ تعديلات الخدمة.'));
    } else {
      setEditingServiceId(null);
      fetchServices();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>إضافة خدمة جديدة</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateService} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">اسم الخدمة</label>
              <input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)} required className="w-full border rounded-lg p-2" placeholder="مثال: كشف باطنة" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">السعر (جنيه)</label>
              <input type="number" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} required className="w-full border rounded-lg p-2" placeholder="250" min="0" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">العيادة التابعة</label>
              <select value={serviceClinicId} onChange={(e) => setServiceClinicId(e.target.value)} required className="w-full border rounded-lg p-2">
                <option value="">-- اختر العيادة --</option>
                <option value="general">خدمة عامة (بدون عيادة)</option>
                {clinics.map(clinic => (
                  <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors h-[42px]">إضافة</button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الخدمات والأسعار الحالية</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={fetchServices} compact />}
          {serviceError && <div className="mb-3"><InlineError message={serviceError} /></div>}
          {loading ? <p className="text-gray-500 py-4">جاري تحميل الخدمات...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 font-semibold text-gray-600">اسم الخدمة</th>
                    <th className="p-3 font-semibold text-gray-600">العيادة</th>
                    <th className="p-3 font-semibold text-gray-600">السعر</th>
                    <th className="p-3 font-semibold text-gray-600">الحالة</th>
                    <th className="p-3 font-semibold text-gray-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {services.length === 0 ? (
                    <tr><td colSpan={5} className="text-center p-4 text-gray-500">لا توجد خدمات مسجلة.</td></tr>
                  ) : services.map(service => (
                    editingServiceId === service.id ? (
                      <tr key={service.id} className="border-b bg-emerald-50/50">
                        <td className="p-2">
                          <input type="text" value={editServiceName} onChange={(e) => setEditServiceName(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                        </td>
                        <td className="p-2">
                          <select value={editServiceClinicId} onChange={(e) => setEditServiceClinicId(e.target.value)} className="w-full border rounded-lg p-2 text-sm">
                            <option value="general">خدمة عامة (بدون عيادة)</option>
                            {clinics.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" value={editServicePrice} onChange={(e) => setEditServicePrice(e.target.value)} className="w-24 border rounded-lg p-2 text-sm" />
                        </td>
                        <td className="p-2">
                          <label className="flex items-center gap-1 text-xs font-bold text-gray-700 cursor-pointer select-none">
                            <input type="checkbox" checked={editServiceActive} onChange={(e) => setEditServiceActive(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                            {editServiceActive ? 'مفعلة' : 'معطلة'}
                          </label>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleSaveService(service.id)} disabled={savingService} className="text-emerald-600 hover:text-emerald-800 text-sm font-bold flex items-center gap-1 disabled:opacity-50">
                              {savingService ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} حفظ
                            </button>
                            <button onClick={() => setEditingServiceId(null)} className="text-gray-500 hover:text-gray-700 text-sm font-bold flex items-center gap-1">
                              <X className="w-4 h-4" /> إلغاء
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={service.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-bold text-gray-800">{service.name}</td>
                        <td className="p-3 text-gray-600">{service.clinic?.name || 'غير محدد'}</td>
                        <td className="p-3 font-bold text-emerald-600" dir="ltr">{service.price} ج.م</td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${service.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {service.is_active ? 'مفعلة' : 'معطلة'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => startEditService(service)} className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1">
                              <Pencil className="w-4 h-4" /> تعديل
                            </button>
                            <button onClick={() => handleDeleteService(service.id)} className="text-red-500 hover:text-red-700 text-sm font-bold">حذف</button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
