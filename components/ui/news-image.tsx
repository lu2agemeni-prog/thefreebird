'use client';

// ============================================================================
// components/ui/news-image.tsx
// مكوّن موحّد لعرض صور المقالات الطبية من bucket الـ news في Supabase.
//
// المشكلة التي يحلها:
//   • image_url في قاعدة البيانات يحمل روابط موقّعة (signed) بتوكنات مؤقتة
//     من مسار /object/sign/news/... — تنتهي صلاحيتها مع الوقت فتختفي الصور.
//   • بعد جعل الـ bucket عامًا (ملف الهجرة) يصبح المسار الصحيح
//     /object/public/news/... بلا توكنات.
//
// الاستراتيجية: نجرب الرابط العام أولًا، وإن فشل نرجع للرابط الموقّع الأصلي،
// وإن فشل الاثنان نعرض بديلًا أنيقًا (أيقونة) — فلا تنكسر الواجهة أبدًا.
// ============================================================================

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Newspaper } from 'lucide-react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://toxtgjiigsyqetpffjyc.supabase.co';

/**
 * يحوّل أي صيغة مخزنة لرابط عام دائم من bucket الـ news:
 *   - رابط موقّع قديم  → رابط عام جديد
 *   - اسم ملف فقط      → رابط عام كامل
 *   - مسار نسبي /...   → رابط كامل
 *   - رابط خارجي كامل  → يُستخدم كما هو
 */
export function publicNewsUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;

  if (url.includes('/object/sign/news/')) {
    const path = url.split('/object/sign/news/')[1]?.split('?')[0];
    if (path) return `${SUPABASE_URL}/storage/v1/object/public/news/${path}`;
    return null;
  }
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${SUPABASE_URL}${url}`;
  return `${SUPABASE_URL}/storage/v1/object/public/news/${url}`;
}

interface NewsImageProps {
  url?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
}

export function NewsImage({ url, alt, fill = false, width, height, sizes, className = '' }: NewsImageProps) {
  // قائمة المرشحين للعرض: الرابط العام أولًا ثم الرابط الأصلي كاحتياط
  const candidates = useMemo(() => {
    const list: string[] = [];
    const pub = publicNewsUrl(url);
    if (pub) list.push(pub);
    if (url && /^https?:\/\//i.test(url) && !list.includes(url)) list.push(url);
    return list;
  }, [url]);

  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [url]);

  // لا صورة أو فشل كل المرشحين → بديل أنيق
  if (!url || idx >= candidates.length) {
    return (
      <div
        className={`bg-emerald-50 flex items-center justify-center ${fill ? 'absolute inset-0' : ''} ${className}`}
        aria-label="لا توجد صورة"
      >
        <Newspaper className="w-12 h-12 text-emerald-200" aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image
      key={candidates[idx]}
      src={candidates[idx]}
      alt={alt}
      onError={() => setIdx((i) => i + 1)}
      {...(fill ? { fill: true, sizes: sizes || '100vw' } : { width: width || 480, height: height || 320 })}
      className={className}
    />
  );
}
