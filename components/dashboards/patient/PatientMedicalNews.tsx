'use client';

// ============================================================================
// components/dashboards/patient/PatientMedicalNews.tsx
// تبويب "الأخبار الطبية" داخل لوحة المريض — بقى list بالصور مع ترقيم
// صفحات حقيقي، وكل خبر بيفتح في صفحته المستقلة /news/[id] بدل عرض
// المحتوى كامل جوه كارت في القائمة.
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Newspaper, User, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NewsImage } from '@/components/ui/news-image';
import { Pagination } from '@/components/ui/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';

const PAGE_SIZE = 6;

export function PatientMedicalNews() {
  const [news, setNews] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    const { data, error, count } = await supabase
      .from('medical_news')
      .select('id, title, content, image_url, created_at, doctor:doctor_id(first_name, last_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) setLoadError(getFriendlyErrorMessage(error, 'تعذر تحميل الأخبار الطبية.'));
    else {
      setNews(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Newspaper className="w-6 h-6 text-emerald-600" /> الأخبار الطبية والمقالات
          </CardTitle>
          <p className="text-gray-500">تابع أحدث النصائح والمقالات الطبية من أطباء المركز.</p>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <ErrorState message={loadError} onRetry={fetchNews} compact />
          ) : loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
          ) : (
            <div className="space-y-4">
              {news.length === 0 ? (
                <p className="text-center text-gray-500 py-8">لا توجد أخبار منشورة حالياً.</p>
              ) : news.map((post) => (
                <Link
                  key={post.id}
                  href={`/news/${post.id}`}
                  className="flex flex-col sm:flex-row gap-4 border rounded-2xl bg-white shadow-sm hover:shadow-md hover:border-emerald-200 transition-all overflow-hidden group"
                >
                  <div className="sm:w-48 h-40 sm:h-auto shrink-0 relative overflow-hidden">
                    <NewsImage
                      url={post.image_url}
                      alt={post.title || 'صورة خبر'}
                      fill
                      sizes="(max-width: 640px) 100vw, 192px"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">{post.title}</h3>
                    <p className="text-gray-600 line-clamp-2 leading-relaxed mb-3 flex-1">{post.content}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-50 mt-auto">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>{post.doctor ? `د. ${post.doctor.first_name} ${post.doctor.last_name}` : 'عيادات الطائر الحر'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span dir="ltr">{new Date(post.created_at).toLocaleDateString('ar-EG')}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {!loading && !loadError && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} isLoading={loading} />}
        </CardContent>
      </Card>
    </div>
  );
}
