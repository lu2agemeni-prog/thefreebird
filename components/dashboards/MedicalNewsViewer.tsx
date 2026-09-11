'use client';

// ============================================================================
// components/MedicalNewsViewer.tsx
// قسم "أحدث المقالات الطبية" في الصفحة الرئيسية — بقى list بالصور بدل
// شبكة كروت، وكل مقال بيفتح في صفحته الخاصة /news/[id]. الترقيم الكامل
// (بكل الأخبار) موجود في /news، وهنا بس عرض مختصر لآخر عدد محدود + رابط
// "عرض كل الأخبار".
// ============================================================================
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Newspaper, User, Calendar, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NewsImage } from '@/components/ui/news-image';

const TEASER_LIMIT = 4;

export function MedicalNewsViewer() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('medical_news')
      .select('id, title, content, image_url, created_at, doctor:doctor_id(first_name, last_name)')
      .order('created_at', { ascending: false })
      .range(0, TEASER_LIMIT - 1)
      .then(({ data }) => {
        if (data) setNews(data);
        setLoading(false);
      });
  }, []);

  if (!loading && news.length === 0) return null;

  return (
    <div className="py-16 bg-white w-full">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-3 rounded-xl">
              <Newspaper className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800">أحدث المقالات الطبية</h2>
          </div>
          <Link href="/news" className="hidden sm:flex items-center gap-1.5 text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
            عرض كل الأخبار
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {news.map((item) => (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="flex flex-col sm:flex-row gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all overflow-hidden group"
              >
                <div className="sm:w-48 h-40 sm:h-auto shrink-0 relative overflow-hidden">
                  <NewsImage
                    url={item.image_url}
                    alt={item.title || 'صورة مقال'}
                    fill
                    sizes="(max-width: 640px) 100vw, 192px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">{item.title}</h3>
                  <p className="text-gray-600 line-clamp-2 leading-relaxed mb-3 flex-1">{item.content}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>{item.doctor ? `د. ${item.doctor.first_name} ${item.doctor.last_name}` : 'عيادات الطائر الحر'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span dir="ltr">{new Date(item.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link href="/news" className="inline-flex items-center gap-1.5 text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
            عرض كل الأخبار
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
