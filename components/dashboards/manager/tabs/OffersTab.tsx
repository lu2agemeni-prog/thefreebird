'use client';

// ============================================================================
// components/dashboards/manager/tabs/OffersTab.tsx
// تبويب "عروض وخصومات" عند المدير — بينشئ إعلان (نص + صورة) بمدة صلاحية
// محددة (مثال: خصم 50% على التحاليل لمدة 72 ساعة)، يظهر تلقائيًا للمرضى
// في تبويبهم المقابل طول ما هو ساري، ويختفي لوحده لما تنتهي مدته (بدون
// أي تدخل يدوي) — أو يقدر المدير يقفله يدويًا قبل ميعاده لو حاب.
//
// نفس نمط MedicalNewsTab.tsx بالظبط (نص + رفع صورة)، وبيستخدم نفس مخزن
// الصور "news" الموجود أصلًا (مفيش داعي لعمل bucket جديد).
// ============================================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, Pencil, X, CheckCircle, Loader2, Percent, Clock, Building, PauseCircle, PlayCircle, Megaphone, Bell, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { NewsImage } from '@/components/ui/news-image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getFriendlyErrorMessage } from '@/lib/errors';

const FETCH_CAP = 2000;

// مدد جاهزة لسرعة إنشاء العرض — زي المثال "72 ساعة" بالظبط
const DURATION_PRESETS: { label: string; hours: number }[] = [
  { label: '24 ساعة', hours: 24 },
  { label: '48 ساعة', hours: 48 },
  { label: '72 ساعة', hours: 72 },
  { label: 'أسبوع', hours: 24 * 7 },
];

function toLocalDatetimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRemaining(endsAt: string, now: number) {
  const diffMs = new Date(endsAt).getTime() - now;
  if (diffMs <= 0) return 'منتهي';
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `متبقي ${days} يوم${hours % 24 ? ` و${hours % 24} س` : ''}`;
  }
  return `متبقي ${hours} س ${mins} د`;
}

interface OfferFormState {
  title: string;
  description: string;
  imageUrl: string;
  discountPercent: string;
  clinicId: string;
  endsAt: string;
}

const emptyForm = (): OfferFormState => ({
  title: '',
  description: '',
  imageUrl: '',
  discountPercent: '',
  clinicId: '',
  endsAt: toLocalDatetimeValue(new Date(Date.now() + 72 * 3600000)),
});

export function OffersTab() {
  const { user } = useAuth();
  const [clinics, setClinics] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<OfferFormState>(emptyForm());
  const [notifyUsers, setNotifyUsers] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<OfferFormState>(emptyForm());
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [broadcastingOfferId, setBroadcastingOfferId] = useState<string | null>(null);

  const fetchClinics = useCallback(async () => {
    const { data } = await supabase.from('clinics').select('id, name').limit(FETCH_CAP);
    setClinics(data || []);
  }, []);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('offers')
      .select('*, clinic:clinic_id(name)')
      .order('created_at', { ascending: false })
      .limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل العروض.'));
    else setOffers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(fetchClinics, 0);
    const t2 = setTimeout(fetchOffers, 0);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [fetchClinics, fetchOffers]);

  // تحديث دوري بسيط للعدّاد التنازلي المعروض بجوار كل عرض ساري
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const uploadOfferImage = async (file: File, onDone: (url: string) => void) => {
    setUploadingImage(true);
    setUploadError(null);
    try {
      const safeName = `offers/${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('news').upload(safeName, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('news').getPublicUrl(safeName);
      onDone(data.publicUrl);
    } catch (err) {
      setUploadError(getFriendlyErrorMessage(err, 'تعذر رفع صورة الإعلان.'));
    } finally {
      setUploadingImage(false);
    }
  };

  const applyDurationPreset = (hours: number, setter: (f: (prev: OfferFormState) => OfferFormState) => void) => {
    setter((prev) => ({ ...prev, endsAt: toLocalDatetimeValue(new Date(Date.now() + hours * 3600000)) }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccessMsg(null);
    if (!form.title.trim() || !form.description.trim()) {
      setCreateError('يرجى إدخال عنوان العرض ونص الإعلان.');
      return;
    }
    if (!form.endsAt) {
      setCreateError('يرجى تحديد موعد انتهاء العرض.');
      return;
    }
    if (new Date(form.endsAt).getTime() <= Date.now()) {
      setCreateError('موعد انتهاء العرض لازم يكون في المستقبل.');
      return;
    }
    setCreating(true);
    const { error } = await supabase.from('offers').insert([{
      title: form.title.trim(),
      description: form.description.trim(),
      image_url: form.imageUrl || null,
      discount_percent: form.discountPercent ? Number(form.discountPercent) : null,
      clinic_id: form.clinicId || null,
      ends_at: new Date(form.endsAt).toISOString(),
      is_active: true,
      created_by: user?.id || null,
    }]);

    if (error) {
      setCreating(false);
      setCreateError(getFriendlyErrorMessage(error, 'تعذر نشر العرض.'));
      return;
    }

    // إرسال إشعار لجميع المستخدمين عند إنشاء العرض
    let notifSentCount = 0;
    if (notifyUsers) {
      const discountText = form.discountPercent ? ` (خصم ${form.discountPercent}%)` : '';
      const notifTitle = `🔥 عرض وخصم جديد: ${form.title.trim()}${discountText}`;
      const notifMessage = form.description.trim();
      const notifLink = '/?tab=offers';

      try {
        // 1. استدعاء دالة البث الرسمية broadcast_notification (تسجل الإشعار الجماعي وترسله للمستخدمين)
        const { data: rpcCount, error: rpcErr } = await supabase.rpc('broadcast_notification', {
          p_target: 'all',
          p_user_id: null,
          p_title: notifTitle,
          p_message: notifMessage,
          p_link: notifLink,
        });

        if (!rpcErr && typeof rpcCount === 'number') {
          notifSentCount = rpcCount;
        } else {
          // إجراء احتياطي مباشر: إدراج في جدول notifications لجميع المستخدمين المسجلين
          const { data: profiles } = await supabase.from('profiles').select('id');
          if (profiles && profiles.length > 0) {
            const rows = profiles.map((p) => ({
              user_id: p.id,
              title: notifTitle,
              message: notifMessage,
              type: 'offer',
              link: notifLink,
              is_read: false,
            }));
            const { error: insErr } = await supabase.from('notifications').insert(rows);
            if (!insErr) {
              notifSentCount = profiles.length;
            }
          }
        }
      } catch (err) {
        console.error('Failed to broadcast offer notification:', err);
      }
    }

    setCreating(false);
    setForm(emptyForm());
    setCreateSuccessMsg(
      notifyUsers && notifSentCount > 0
        ? `تم نشر العرض بنجاح وإرسال إشعار فوري لجميع المستخدمين (${notifSentCount} مستخدم) 🔔`
        : 'تم نشر العرض بنجاح!'
    );
    setTimeout(() => setCreateSuccessMsg(null), 8000);
    fetchOffers();
  };

  const handleBroadcastOffer = async (offer: any) => {
    setBroadcastingOfferId(offer.id);
    const discountText = offer.discount_percent != null ? ` (خصم ${offer.discount_percent}%)` : '';
    const notifTitle = `🔥 تذكير بعرض خاص: ${offer.title}${discountText}`;
    const notifMessage = offer.description;
    const notifLink = '/?tab=offers';

    try {
      const { data: rpcCount, error: rpcErr } = await supabase.rpc('broadcast_notification', {
        p_target: 'all',
        p_user_id: null,
        p_title: notifTitle,
        p_message: notifMessage,
        p_link: notifLink,
      });

      if (!rpcErr && typeof rpcCount === 'number') {
        alert(`تم إرسال إشعار العرض بنجاح إلى ${rpcCount} مستخدم في التطبيق!`);
      } else {
        const { data: profiles } = await supabase.from('profiles').select('id');
        if (profiles && profiles.length > 0) {
          const rows = profiles.map((p) => ({
            user_id: p.id,
            title: notifTitle,
            message: notifMessage,
            type: 'offer',
            link: notifLink,
            is_read: false,
          }));
          await supabase.from('notifications').insert(rows);
          alert(`تم إرسال إشعار العرض بنجاح إلى ${profiles.length} مستخدم!`);
        } else {
          alert('تعذر إرسال الإشعار لعدم توفر حسابات مستخدمين.');
        }
      }
    } catch (err) {
      alert('حدث خطأ أثناء إرسال الإشعار.');
    } finally {
      setBroadcastingOfferId(null);
    }
  };

  const startEdit = (offer: any) => {
    setEditingId(offer.id);
    setEditForm({
      title: offer.title || '',
      description: offer.description || '',
      imageUrl: offer.image_url || '',
      discountPercent: offer.discount_percent != null ? String(offer.discount_percent) : '',
      clinicId: offer.clinic_id || '',
      endsAt: toLocalDatetimeValue(new Date(offer.ends_at)),
    });
    setEditError(null);
  };

  const handleSaveEdit = async (id: string) => {
    setEditError(null);
    if (!editForm.title.trim() || !editForm.description.trim()) {
      setEditError('يرجى إدخال عنوان العرض ونص الإعلان.');
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase.from('offers').update({
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      image_url: editForm.imageUrl || null,
      discount_percent: editForm.discountPercent ? Number(editForm.discountPercent) : null,
      clinic_id: editForm.clinicId || null,
      ends_at: new Date(editForm.endsAt).toISOString(),
    }).eq('id', id);
    setSavingEdit(false);
    if (error) {
      setEditError(getFriendlyErrorMessage(error, 'تعذر حفظ تعديلات العرض.'));
    } else {
      setEditingId(null);
      fetchOffers();
    }
  };

  const toggleActive = async (offer: any) => {
    setBusyId(offer.id);
    await supabase.from('offers').update({ is_active: !offer.is_active }).eq('id', offer.id);
    setBusyId(null);
    fetchOffers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض نهائيًا؟')) return;
    setBusyId(id);
    await supabase.from('offers').delete().eq('id', id);
    setBusyId(null);
    fetchOffers();
  };

  const offerStatus = (offer: any): { label: string; color: string } => {
    if (!offer.is_active) return { label: 'متوقف يدويًا', color: 'bg-gray-100 text-gray-600' };
    if (new Date(offer.ends_at).getTime() <= now) return { label: 'منتهي', color: 'bg-red-50 text-red-600' };
    return { label: 'ساري الآن', color: 'bg-emerald-100 text-emerald-700' };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>إنشاء عرض / خصم جديد</CardTitle>
          <CardDescription>هيظهر تلقائيًا في تبويب &quot;خصومات وعروض&quot; عند المرضى طول ما هو ساري، وهيختفي لوحده لما تنتهي مدته.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">عنوان العرض</label>
                <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required className="w-full border rounded-lg p-2" placeholder="مثال: خصم 50% على التحاليل" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Percent className="w-4 h-4" /> نسبة الخصم % (اختياري)</label>
                <input type="number" min="0" max="100" value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))} className="w-full border rounded-lg p-2" placeholder="50" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">نص الإعلان / التفاصيل</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required rows={3} className="w-full border rounded-lg p-2 resize-none" placeholder="اكتب تفاصيل العرض هنا..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">صورة الإعلان (اختياري)</label>
                <div className="space-y-2">
                  <input type="url" value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} className="w-full border rounded-lg p-2" placeholder="رابط صورة أو ارفع من جهازك" />
                  <label className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 cursor-pointer hover:bg-emerald-100 transition-colors w-fit">
                    <Upload className="w-4 h-4" />
                    {uploadingImage ? 'جاري الرفع...' : 'رفع صورة من الجهاز'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadOfferImage(file, (url) => setForm((f) => ({ ...f, imageUrl: url })));
                      e.currentTarget.value = '';
                    }} />
                  </label>
                  {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                  {form.imageUrl && (
                    <div className="flex items-center gap-2">
                      <NewsImage url={form.imageUrl} alt="" width={64} height={64} className="w-16 h-16 object-cover rounded-lg border" />
                      <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))} className="text-xs text-red-500 font-bold">إزالة الصورة</button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Building className="w-4 h-4" /> العيادة / الخدمة المرتبطة (اختياري)</label>
                <select value={form.clinicId} onChange={(e) => setForm((f) => ({ ...f, clinicId: e.target.value }))} className="w-full border rounded-lg p-2 mb-3">
                  <option value="">-- عرض عام (كل العيادات) --</option>
                  {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Clock className="w-4 h-4" /> مدة العرض</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {DURATION_PRESETS.map((p) => (
                    <button key={p.hours} type="button" onClick={() => applyDurationPreset(p.hours, setForm)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                      {p.label}
                    </button>
                  ))}
                </div>
                <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} className="w-full border rounded-lg p-2" required />
                <p className="text-xs text-gray-400 mt-1">العرض هيتقفل تلقائيًا لوحده في هذا الموعد بالظبط.</p>
              </div>
            </div>

            {createError && <InlineError message={createError} />}

            {createSuccessMsg && (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{createSuccessMsg}</span>
              </div>
            )}

            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
              <input
                type="checkbox"
                id="notifyUsersCheckbox"
                checked={notifyUsers}
                onChange={(e) => setNotifyUsers(e.target.checked)}
                className="mt-1 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="notifyUsersCheckbox" className="text-sm cursor-pointer select-none">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-emerald-600" />
                  إرسال إشعار فوري لجميع المستخدمين بصدور هذا العرض
                </span>
                <span className="block text-xs text-emerald-700 mt-0.5">
                  سيصل تنبيه في جرس الإشعارات لكل مستخدم في التطبيق، إضافة لإشعار Push على الموبايل للإعلان عن هذا الخصم وتشجيعهم على الحجز.
                </span>
              </label>
            </div>

            <button type="submit" disabled={creating} className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50">
              {creating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري نشر العرض وإرسال الإشعارات...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  نشر العرض {notifyUsers && 'وإشعار المستخدمين'}
                </>
              )}
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>العروض المنشورة</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={fetchOffers} compact />}
          {loading ? <p className="text-gray-500 py-4">جاري تحميل العروض...</p> : (
            <div className="grid grid-cols-1 gap-4">
              {offers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">لا توجد عروض منشورة بعد.</p>
              ) : offers.map((offer) => {
                const status = offerStatus(offer);
                return editingId === offer.id ? (
                  <form key={offer.id} onSubmit={(e) => { e.preventDefault(); handleSaveEdit(offer.id); }} className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50/40 space-y-3">
                    <h4 className="font-bold text-emerald-800 flex items-center gap-2">
                      <Pencil className="w-5 h-5" />
                      تعديل العرض
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">العنوان</label>
                        <input type="text" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg p-2" required />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">نسبة الخصم %</label>
                        <input type="number" min="0" max="100" value={editForm.discountPercent} onChange={(e) => setEditForm((f) => ({ ...f, discountPercent: e.target.value }))} className="w-full border rounded-lg p-2" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">نص الإعلان</label>
                      <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full border rounded-lg p-2 resize-none" required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">صورة الإعلان</label>
                        <div className="space-y-2">
                          <input type="url" value={editForm.imageUrl} onChange={(e) => setEditForm((f) => ({ ...f, imageUrl: e.target.value }))} className="w-full border rounded-lg p-2" />
                          <label className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-white border border-emerald-100 rounded-lg px-3 py-2 cursor-pointer hover:bg-emerald-50 transition-colors w-fit">
                            <Upload className="w-4 h-4" />
                            {uploadingImage ? 'جاري الرفع...' : 'رفع صورة جديدة'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadOfferImage(file, (url) => setEditForm((f) => ({ ...f, imageUrl: url })));
                              e.currentTarget.value = '';
                            }} />
                          </label>
                          {editForm.imageUrl && (
                            <div className="flex items-center gap-2">
                              <NewsImage url={editForm.imageUrl} alt="" width={64} height={64} className="w-16 h-16 object-cover rounded-lg border" />
                              <button type="button" onClick={() => setEditForm((f) => ({ ...f, imageUrl: '' }))} className="text-xs text-red-500 font-bold">إزالة الصورة</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">العيادة المرتبطة</label>
                        <select value={editForm.clinicId} onChange={(e) => setEditForm((f) => ({ ...f, clinicId: e.target.value }))} className="w-full border rounded-lg p-2 mb-3">
                          <option value="">-- عرض عام --</option>
                          {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <label className="block text-sm font-bold text-gray-700 mb-1">موعد الانتهاء</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {DURATION_PRESETS.map((p) => (
                            <button key={p.hours} type="button" onClick={() => applyDurationPreset(p.hours, setEditForm)} className="text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <input type="datetime-local" value={editForm.endsAt} onChange={(e) => setEditForm((f) => ({ ...f, endsAt: e.target.value }))} className="w-full border rounded-lg p-2" required />
                      </div>
                    </div>
                    {editError && <InlineError message={editError} />}
                    <div className="flex gap-2">
                      <button type="submit" disabled={savingEdit} className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                        {savingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        حفظ التعديلات
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="border border-gray-200 text-gray-600 font-bold px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                        <X className="w-5 h-5" /> إلغاء
                      </button>
                    </div>
                  </form>
                ) : (
                  <div key={offer.id} className="border rounded-xl p-4 flex flex-col md:flex-row gap-4 bg-white">
                    <NewsImage url={offer.image_url} alt="" width={128} height={128} className="w-32 h-32 object-cover rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-bold text-lg text-emerald-900">{offer.title}</h4>
                        {offer.discount_percent != null && (
                          <span className="text-xs font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">خصم {offer.discount_percent}%</span>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                      </div>
                      {offer.clinic && <p className="text-xs text-gray-500 mb-1">العيادة: {offer.clinic.name}</p>}
                      <p className="text-gray-700 text-sm line-clamp-2">{offer.description}</p>
                      <div className="mt-3 flex flex-wrap justify-between items-center gap-2">
                        <span className="text-xs text-gray-400" dir="ltr">
                          {status.label === 'ساري الآن' ? formatRemaining(offer.ends_at, now) : `انتهى في ${new Date(offer.ends_at).toLocaleString('ar-EG')}`}
                        </span>
                        <div className="flex gap-3 items-center flex-wrap">
                          <button
                            onClick={() => handleBroadcastOffer(offer)}
                            disabled={broadcastingOfferId === offer.id}
                            title="إرسال إشعار فوري لجميع المستخدمين بهذا العرض"
                            className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            {broadcastingOfferId === offer.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Megaphone className="w-3.5 h-3.5" />
                            )}
                            إرسال إشعار للكل
                          </button>
                          <button onClick={() => toggleActive(offer)} disabled={busyId === offer.id} className="text-amber-600 text-sm font-bold hover:text-amber-800 flex items-center gap-1 disabled:opacity-50">
                            {offer.is_active ? <><PauseCircle className="w-4 h-4" /> إيقاف الآن</> : <><PlayCircle className="w-4 h-4" /> تفعيل</>}
                          </button>
                          <button onClick={() => startEdit(offer)} className="text-blue-600 text-sm font-bold hover:text-blue-800 flex items-center gap-1">
                            <Pencil className="w-4 h-4" /> تعديل
                          </button>
                          <button onClick={() => handleDelete(offer.id)} disabled={busyId === offer.id} className="text-red-500 text-sm font-bold hover:text-red-700 disabled:opacity-50">حذف</button>
                        </div>
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
