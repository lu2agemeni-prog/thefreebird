'use client';

// ============================================================================
// app/news/[id]/page.tsx
// صفحة مقال طبي مستقلة — بتتفتح لوحدها لكل خبر (بدل ما يكون محتوى مقصوص
// جوه كارت في القائمة).
// ============================================================================
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowRight, Newspaper, User, Calendar, Heart, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { NewsImage } from '@/components/ui/news-image';
import { ErrorState } from '@/components/ui/error-state';
import { getFriendlyErrorMessage } from '@/lib/errors';

export default function NewsArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loginWithGoogle } = useAuth();
  const [article, setArticle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('medical_news')
      .select('*, doctor:doctor_id(first_name, last_name), news_likes(user_id)')
      .eq('id', id)
      .single();

    if (error) setError(getFriendlyErrorMessage(error, 'تعذر تحميل المقال، قد يكون غير موجود.'));
    else setArticle(data);
    setLoading(false);
  };

  useEffect(() => { fetchArticle(); }, [id]);

  const toggleLike = async () => {
    if (!article) return;
    if (!user) {
      alert('يرجى تسجيل الدخول أولاً لتتمكن من التفاعل مع المقال.');
      loginWithGoogle();
      return;
    }
    const isLiked = article.news_likes?.some((l: any) => l.user_id === user.id);
    if (isLiked) {
      await supabase.from('news_likes').delete().match({ news_id: article.id, user_id: user.id });
      setArticle((a: any) => ({ ...a, news_likes: a.news_likes.filter((l: any) => l.user_id !== user.id) }));
    } else {
      await supabase.from('news_likes').insert([{ news_id: article.id, user_id: user.id }]);
      setArticle((a: any) => ({ ...a, news_likes: [...(a.news_likes || []), { user_id: user.id }] }));
    }
  };

  const likesCount = article?.news_likes?.length || 0;
  const isLiked = article?.news_likes?.some((l: any) => l.user_id === user?.id);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-emerald-600 text-white p-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6" />
            مقال طبي
          </h1>
          <Link href="/news" className="flex items-center gap-2 text-emerald-50 hover:text-white transition-colors">
            كل الأخبار <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 mt-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : error || !article ? (
          <ErrorState message={error || 'المقال غير موجود.'} onRetry={fetchArticle} />
        ) : (
          <article className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="h-72 sm:h-96 relative">
              <NewsImage url={article.image_url} alt={article.title || 'صورة مقال'} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
            </div>
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{article.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 pb-6 mb-6 border-b border-gray-100">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span>{article.doctor ? `د. ${article.doctor.first_name} ${article.doctor.last_name}` : 'عيادات الطائر الحر'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span dir="ltr">{new Date(article.created_at).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>

              <p className="text-gray-700 leading-loose whitespace-pre-wrap text-lg mb-8">{article.content}</p>

              <button
                onClick={toggleLike}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  isLiked ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-600' : ''}`} />
                {likesCount} {likesCount === 1 ? 'إعجاب' : 'إعجابات'}
              </button>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
