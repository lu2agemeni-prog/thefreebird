'use client';

// ============================================================================
// app/news/page.tsx
// قائمة الأخبار الطبية (list بالصور) — كل خبر بيفتح في صفحته الخاصة
// /news/[id]، مع ترقيم صفحات حقيقي (.range() + count: 'exact').
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, Newspaper, User, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NewsImage } from '@/components/ui/news-image';
import { Pagination } from '@/components/ui/pagination';
import { ErrorState } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';

const PAGE_SIZE = 8;

export default function NewsListPage() {
  const [news, setNews] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error, count } = await supabase
      .from('medical_news')
      .select('id, title, content, image_url, created_at, doctor:doctor_id(first_name, last_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل الأخبار الطبية.'));
    else {
      setNews(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchNews(); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [fetchNews]);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-emerald-600 text-white p-6 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6" />
            الأخبار الطبية والمقالات
          </h1>
          <Link href="/" className="flex items-center gap-2 text-emerald-50 hover:text-white transition-colors">
            العودة للرئيسية <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 mt-6 space-y-4">
        {error && <ErrorState message={error} onRetry={fetchNews} />}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500 text-lg">لا توجد أخبار منشورة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {news.map((item) => (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="flex flex-col sm:flex-row gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all overflow-hidden group"
              >
                <div className="sm:w-56 h-44 sm:h-auto shrink-0 relative overflow-hidden">
                  <NewsImage
                    url={item.image_url}
                    alt={item.title || 'صورة مقال'}
                    fill
                    sizes="(max-width: 640px) 100vw, 224px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">{item.title}</h2>
                  <p className="text-gray-600 line-clamp-2 leading-relaxed mb-4 flex-1">{item.content}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      <span>{item.doctor ? `د. ${item.doctor.first_name} ${item.doctor.last_name}` : 'عيادات الطائر الحر'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span dir="ltr">{new Date(item.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} isLoading={loading} />}
      </main>
    </div>
  );
}
