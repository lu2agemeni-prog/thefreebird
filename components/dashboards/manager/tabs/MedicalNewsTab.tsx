'use client';

// ============================================================================
// components/dashboards/manager/tabs/MedicalNewsTab.tsx
// تبويب "الأخبار الطبية" — مستخرج من ManagerDashboard.tsx بنفس السلوك بالضبط.
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { Upload, Pencil, X, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { NewsImage } from '@/components/ui/news-image';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';

const FETCH_CAP = 2000;

export function MedicalNewsTab() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsImage, setNewsImage] = useState('');
  const [newsDoctor, setNewsDoctor] = useState('');

  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [editNewsTitle, setEditNewsTitle] = useState('');
  const [editNewsContent, setEditNewsContent] = useState('');
  const [editNewsImage, setEditNewsImage] = useState('');
  const [editNewsDoctor, setEditNewsDoctor] = useState('');
  const [savingNews, setSavingNews] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchDoctors = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*, doctor:doctors(*)').eq('role', 'doctor').limit(FETCH_CAP);
    setDoctors(data || []);
  }, []);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('medical_news').select('*, doctor:doctor_id(first_name, last_name)').order('created_at', { ascending: false }).limit(FETCH_CAP);
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل الأخبار الطبية.'));
    else setNews(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDoctors(); fetchNews(); }, [fetchDoctors, fetchNews]);

  const uploadNewsImage = async (file: File, onDone: (url: string) => void) => {
    setUploadingImage(true);
    setUploadError(null);
    try {
      const safeName = `${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('news').upload(safeName, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('news').getPublicUrl(safeName);
      onDone(data.publicUrl);
    } catch (err) {
      setUploadError(getFriendlyErrorMessage(err, 'تعذر رفع الصورة إلى مخزن news.'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle || !newsContent) return alert('الرجاء إدخال العنوان والمحتوى');
    const { error } = await supabase.from('medical_news').insert([{
      title: newsTitle,
      content: newsContent,
      image_url: newsImage || null,
      doctor_id: newsDoctor || null,
    }]);
    if (!error) {
      alert('تم نشر الخبر الطبي بنجاح!');
      setNewsTitle('');
      setNewsContent('');
      setNewsImage('');
      setNewsDoctor('');
      fetchNews();
    } else {
      alert('حدث خطأ أثناء النشر.');
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الخبر؟')) {
      await supabase.from('medical_news').delete().eq('id', id);
      fetchNews();
    }
  };

  const startEditNews = (post: any) => {
    setEditingNewsId(post.id);
    setEditNewsTitle(post.title || '');
    setEditNewsContent(post.content || '');
    setEditNewsImage(post.image_url || '');
    setEditNewsDoctor(post.doctor_id || '');
    setNewsError(null);
  };

  const handleSaveNews = async (id: string) => {
    setNewsError(null);
    if (!editNewsTitle.trim() || !editNewsContent.trim()) {
      setNewsError('يرجى إدخال عنوان الخبر ومحتواه.');
      return;
    }
    setSavingNews(true);
    const { error } = await supabase
      .from('medical_news')
      .update({
        title: editNewsTitle.trim(),
        content: editNewsContent.trim(),
        image_url: editNewsImage.trim() || null,
        doctor_id: editNewsDoctor || null,
      })
      .eq('id', id);
    setSavingNews(false);
    if (error) {
      setNewsError(getFriendlyErrorMessage(error, 'تعذر حفظ تعديلات الخبر.'));
    } else {
      setEditingNewsId(null);
      fetchNews();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>نشر خبر طبي جديد</CardTitle>
          <CardDescription>إضافة مقال أو خبر طبي ليظهر للمرضى في لوحة التحكم الخاصة بهم.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateNews} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">عنوان الخبر / المقال</label>
              <input type="text" value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} required className="w-full border rounded-lg p-2" placeholder="مثال: نصائح هامة للوقاية من نزلات البرد" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">المحتوى</label>
              <textarea value={newsContent} onChange={(e) => setNewsContent(e.target.value)} required rows={4} className="w-full border rounded-lg p-2 resize-none" placeholder="اكتب تفاصيل الخبر هنا..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">صورة الخبر (اختياري)</label>
                <div className="space-y-2">
                  <input type="url" value={newsImage} onChange={(e) => setNewsImage(e.target.value)} className="w-full border rounded-lg p-2" placeholder="https://example.com/image.jpg أو ارفع من جهازك" />
                  <label className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 cursor-pointer hover:bg-emerald-100 transition-colors w-fit">
                    <Upload className="w-4 h-4" />
                    {uploadingImage ? 'جاري الرفع إلى مخزن news...' : 'رفع صورة من الجهاز إلى مخزن news'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadNewsImage(file, setNewsImage);
                      e.currentTarget.value = '';
                    }} />
                  </label>
                  {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                  {newsImage && (
                    <div className="flex items-center gap-2">
                      <NewsImage url={newsImage} alt="" width={64} height={64} className="w-16 h-16 object-cover rounded-lg border" />
                      <button type="button" onClick={() => setNewsImage('')} className="text-xs text-red-500 font-bold">إزالة الصورة</button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الطبيب المقدم للمقال (اختياري)</label>
                <select value={newsDoctor} onChange={(e) => setNewsDoctor(e.target.value)} className="w-full border rounded-lg p-2">
                  <option value="">-- بدون تحديد طبيب --</option>
                  {doctors.map(doc => (
                    <option key={doc.id} value={doc.id}>د. {doc.first_name} {doc.last_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors">نشر الخبر</button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الأخبار المنشورة</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={fetchNews} compact />}
          {loading ? <p className="text-gray-500 py-4">جاري تحميل الأخبار...</p> : (
            <div className="grid grid-cols-1 gap-4">
              {news.length === 0 ? (
                <p className="text-gray-500 text-center py-4">لا توجد أخبار منشورة بعد.</p>
              ) : news.map((post) => (
                editingNewsId === post.id ? (
                  <form key={post.id} onSubmit={(e) => { e.preventDefault(); handleSaveNews(post.id); }} className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50/40 space-y-3">
                    <h4 className="font-bold text-emerald-800 flex items-center gap-2">
                      <Pencil className="w-5 h-5" />
                      تعديل الخبر
                    </h4>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">العنوان</label>
                      <input type="text" value={editNewsTitle} onChange={(e) => setEditNewsTitle(e.target.value)} className="w-full border rounded-lg p-2" required />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">المحتوى</label>
                      <textarea value={editNewsContent} onChange={(e) => setEditNewsContent(e.target.value)} rows={4} className="w-full border rounded-lg p-2 resize-none" required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">صورة الخبر</label>
                        <div className="space-y-2">
                          <input type="url" value={editNewsImage} onChange={(e) => setEditNewsImage(e.target.value)} className="w-full border rounded-lg p-2" placeholder="رابط الصورة أو ارفع من جهازك" />
                          <label className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-white border border-emerald-100 rounded-lg px-3 py-2 cursor-pointer hover:bg-emerald-50 transition-colors w-fit">
                            <Upload className="w-4 h-4" />
                            {uploadingImage ? 'جاري الرفع...' : 'رفع صورة من مخزن news'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadNewsImage(file, setEditNewsImage);
                              e.currentTarget.value = '';
                            }} />
                          </label>
                          {editNewsImage && (
                            <div className="flex items-center gap-2">
                              <NewsImage url={editNewsImage} alt="" width={64} height={64} className="w-16 h-16 object-cover rounded-lg border" />
                              <button type="button" onClick={() => setEditNewsImage('')} className="text-xs text-red-500 font-bold">إزالة الصورة</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">الطبيب المقدم للمقال</label>
                        <select value={editNewsDoctor} onChange={(e) => setEditNewsDoctor(e.target.value)} className="w-full border rounded-lg p-2">
                          <option value="">-- بدون تحديد طبيب --</option>
                          {doctors.map(doc => (
                            <option key={doc.id} value={doc.id}>د. {doc.first_name} {doc.last_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {newsError && <InlineError message={newsError} />}
                    <div className="flex gap-2">
                      <button type="submit" disabled={savingNews} className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                        {savingNews ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        حفظ التعديلات
                      </button>
                      <button type="button" onClick={() => setEditingNewsId(null)} className="border border-gray-200 text-gray-600 font-bold px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                        <X className="w-5 h-5" /> إلغاء
                      </button>
                    </div>
                  </form>
                ) : (
                  <div key={post.id} className="border rounded-xl p-4 flex flex-col md:flex-row gap-4 bg-white">
                    <NewsImage url={post.image_url} alt="" width={128} height={128} className="w-32 h-32 object-cover rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-lg text-emerald-900">{post.title}</h4>
                      {post.doctor && (
                        <p className="text-xs text-gray-500 mb-2">بواسطة: د. {post.doctor.first_name} {post.doctor.last_name}</p>
                      )}
                      <p className="text-gray-700 text-sm line-clamp-2">{post.content}</p>
                      <div className="mt-4 flex justify-between items-center">
                        <span className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString('ar-EG')}</span>
                        <div className="flex gap-3">
                          <button onClick={() => startEditNews(post)} className="text-blue-600 text-sm font-bold hover:text-blue-800 flex items-center gap-1">
                            <Pencil className="w-4 h-4" /> تعديل
                          </button>
                          <button onClick={() => handleDeleteNews(post.id)} className="text-red-500 text-sm font-bold hover:text-red-700">حذف الخبر</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
