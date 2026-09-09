'use client';

// ============================================================================
// components/dashboards/manager/QueueMediaManager.tsx
// إدارة الفيديوهات/الصور اللي بتتعرض في شاشة النداء الآلي (يسار/يمين).
// ============================================================================

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { ImageIcon, Loader2, Plus, Trash2, Eye, EyeOff, Video } from 'lucide-react';

export function QueueMediaManager() {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [url, setUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error } = await supabase.from('queue_media').select('*').order('display_order', { ascending: true });
    if (error) {
      setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل قائمة الوسائط.'));
    } else if (data) {
      setMedia(data);
    }
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setActionError(null);
    const { error } = await supabase.from('queue_media').insert([{
      media_type: mediaType,
      url: url.trim(),
      display_order: parseInt(displayOrder, 10) || 0,
      is_active: true,
    }]);
    setSubmitting(false);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر إضافة الوسائط.'));
      return;
    }
    setUrl('');
    setDisplayOrder('0');
    fetchMedia();
  };

  const toggleActive = async (id: string, current: boolean) => {
    setActionError(null);
    const { error } = await supabase.from('queue_media').update({ is_active: !current }).eq('id', id);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر تحديث الوسائط.'));
    } else {
      fetchMedia();
    }
  };

  const deleteMedia = async (id: string) => {
    setActionError(null);
    const { error } = await supabase.from('queue_media').delete().eq('id', id);
    if (error) {
      setActionError(getFriendlyErrorMessage(error, 'تعذر حذف الوسائط.'));
    } else {
      fetchMedia();
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchMedia} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <ImageIcon className="w-8 h-8 text-emerald-600" />
        <h2 className="text-3xl font-bold text-gray-800">وسائط شاشة النداء</h2>
      </div>

      {actionError && <InlineError message={actionError} />}

      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-gray-700 mb-3">إضافة وسائط جديدة</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as 'image' | 'video')}
              className="border rounded-lg p-2 bg-white"
            >
              <option value="image">صورة</option>
              <option value="video">فيديو</option>
            </select>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="رابط الصورة/الفيديو (https://...)"
              className="sm:col-span-2 border rounded-lg p-2"
              dir="ltr"
            />
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder="ترتيب العرض"
              className="border rounded-lg p-2"
            />
            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="sm:col-span-4 bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إضافة
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-gray-700 mb-3">الوسائط الحالية ({media.length})</h3>
          {media.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">لا توجد وسائط مضافة بعد</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {media.map(m => (
                <div key={m.id} className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-900 aspect-video flex items-center justify-center">
                    {m.media_type === 'video' ? (
                      <video src={m.url} className="w-full h-full object-contain" muted />
                    ) : (
                      <img src={m.url} alt="" className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {m.media_type === 'video' ? <Video className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                      ترتيب: {m.display_order}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(m.id, m.is_active)}
                        title={m.is_active ? 'إخفاء' : 'إظهار'}
                        className={`p-1.5 rounded-lg ${m.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}
                      >
                        {m.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteMedia(m.id)}
                        title="حذف"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
