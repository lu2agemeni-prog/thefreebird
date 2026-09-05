'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Newspaper, Heart, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PatientMedicalNews() {
  const { user } = useAuth();
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = async () => {
    setLoading(true);
    // Fetch news with doctor info and all likes
    const { data, error } = await supabase
      .from('medical_news')
      .select('*, doctor:doctor_id(first_name, last_name), news_likes(user_id)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNews(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const toggleLike = async (newsId: string, isLiked: boolean) => {
    if (!user) return;

    if (isLiked) {
      // Remove like
      await supabase.from('news_likes').delete().match({ news_id: newsId, user_id: user.id });
    } else {
      // Add like
      await supabase.from('news_likes').insert([{ news_id: newsId, user_id: user.id }]);
    }
    
    // Refresh to update counts locally or refetch
    fetchNews();
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

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
          <div className="grid gap-6">
            {news.length === 0 ? (
              <p className="text-center text-gray-500 py-8">لا توجد أخبار منشورة حالياً.</p>
            ) : news.map((post) => {
              const likesCount = post.news_likes?.length || 0;
              const isLiked = post.news_likes?.some((like: any) => like.user_id === user?.id);

              return (
                <div key={post.id} className="border rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow">
                  {post.image_url && (
                    <div className="md:w-1/3 bg-gray-100 flex-shrink-0">
                      <img src={post.image_url} alt={post.title} className="w-full h-48 md:h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h3>
                    {post.doctor && (
                      <p className="text-sm font-bold text-emerald-700 mb-4">بواسطة: د. {post.doctor.first_name} {post.doctor.last_name}</p>
                    )}
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap flex-1 mb-4">
                      {post.content}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                      <span className="text-xs text-gray-400">
                        {new Date(post.created_at).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      
                      <button 
                        onClick={() => toggleLike(post.id, isLiked)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
                          isLiked ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-600' : ''}`} />
                        {likesCount} {likesCount === 1 ? 'إعجاب' : 'إعجابات'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
