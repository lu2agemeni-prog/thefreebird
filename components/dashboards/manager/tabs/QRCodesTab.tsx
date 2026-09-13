'use client';

// ============================================================================
// components/dashboards/manager/tabs/QRCodesTab.tsx
// تبويب "QR Codes" — زرار "طباعة" كان موجود بس من غير أي onClick (مكسور
// تمامًا)، صلحته + ضفت قسم لإضافة رابط مخصص وحفظه وطباعته.
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Trash2, Printer, Loader2, Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getFriendlyErrorMessage } from '@/lib/errors';

function printQrCode(containerEl: HTMLElement | null, title: string, url: string) {
  const svg = containerEl?.querySelector('svg');
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);

  const printWindow = window.open('', '_blank', 'width=420,height=520');
  if (!printWindow) return;

  printWindow.document.write(`
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; text-align: center; }
          h2 { margin-bottom: 24px; font-size: 20px; }
          p { margin-top: 20px; font-size: 12px; color: #666; word-break: break-all; max-width: 320px; }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        ${svgData}
        <p>${url}</p>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  // نستنى الصورة تترندر قبل ما نفتح مربع الطباعة
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}

function QRCodeCard({ title, url, desc, onDelete }: { title: string; url: string; desc: string; onDelete?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-6 bg-gray-50 m-6 rounded-lg border">
        <div ref={containerRef}>
          <QRCodeSVG value={url} size={200} level="H" includeMargin={true} />
        </div>
        <p className="mt-4 text-xs text-gray-400 font-mono break-all text-center">{url}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => printQrCode(containerRef.current, title, url)}
            className="flex items-center gap-1.5 text-emerald-600 font-medium text-sm border border-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            <Printer className="w-4 h-4" /> طباعة
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 text-red-500 font-medium text-sm border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> حذف
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function QRCodesTab() {
  const { user } = useAuth();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const [customCodes, setCustomCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchCustomCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('custom_qr_codes').select('*').order('created_at', { ascending: false });
    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل روابط QR المخصصة.'));
    else setCustomCodes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomCodes(); }, [fetchCustomCodes]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!newTitle.trim() || !newUrl.trim()) {
      setAddError('يرجى إدخال العنوان والرابط.');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('custom_qr_codes').insert([{
      title: newTitle.trim(),
      url: newUrl.trim(),
      created_by: user?.id || null,
    }]);
    setAdding(false);
    if (error) {
      setAddError(getFriendlyErrorMessage(error, 'تعذر إضافة الرابط.'));
      return;
    }
    setNewTitle('');
    setNewUrl('');
    fetchCustomCodes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف كود QR هذا؟')) return;
    await supabase.from('custom_qr_codes').delete().eq('id', id);
    setCustomCodes(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-600" />
            إضافة رابط مخصص
          </CardTitle>
          <CardDescription>أضف أي رابط (صفحة خارجية، وسائل تواصل، عرض خاص...) وسيتولّد له QR Code جاهز للطباعة.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-gray-500 mb-1">العنوان</label>
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full border rounded-lg p-2.5" placeholder="مثال: صفحة فيسبوك المركز" required />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-gray-500 mb-1">الرابط</label>
              <input type="text" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="w-full border rounded-lg p-2.5" placeholder="https://..." required />
            </div>
            <button type="submit" disabled={adding} className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 h-[42px] whitespace-nowrap">
              {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              إضافة
            </button>
          </form>
          {addError && <div className="mt-3"><InlineError message={addError} /></div>}
        </CardContent>
      </Card>

      {error && <ErrorState message={error} onRetry={fetchCustomCodes} />}

      {loading ? (
        <p className="text-gray-500 text-center py-4">جاري تحميل الروابط المخصصة...</p>
      ) : customCodes.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-700 mb-4">الروابط المخصصة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customCodes.map(c => (
              <QRCodeCard key={c.id} title={c.title} url={c.url} desc="رابط مخصص" onDelete={() => handleDelete(c.id)} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-4">الروابط الجاهزة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <QRCodeCard title="لائحة الأسعار" url={`${origin}/prices`} desc="QR Code لصفحة الأسعار والخدمات" />
          <QRCodeCard title="الشكاوى والاقتراحات" url={`${origin}/public/complaints`} desc="QR Code لنموذج الشكاوى والمقترحات" />
          <QRCodeCard title="واي فاي العيادة" url={`${origin}/wifi`} desc="QR Code لصفحة بيانات الواي فاي للزوار" />
          <QRCodeCard title="الحجز السريع" url={`${origin}/book`} desc="QR Code لحجز موعد في العيادات" />
          <QRCodeCard title="شاشة النداء الآلي" url={`${origin}/queue`} desc="QR Code لفتح شاشة العرض العامة على الشاشات الكبيرة" />
          <QRCodeCard title="أطباء المركز" url={`${origin}/doctors`} desc="QR Code لعرض الأطباء ومواعيدهم" />
        </div>
      </div>
    </div>
  );
}
