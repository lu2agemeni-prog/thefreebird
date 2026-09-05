'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Newspaper, ChevronDown, User, Calendar } from 'lucide-react';

export function MedicalNewsViewer() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 3;

  useEffect(() => {
    fetchNews(0);
  }, []);

  const fetchNews = async (pageIndex: number) => {
    setLoading(true);
    const { data, error, count } = await supabase
      .from('medical_news')
      .select('*, doctor:doctor_id(first_name, last_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pageIndex * limit, (pageIndex + 1) * limit - 1);
      
    if (data) {
      if (pageIndex === 0) {
        setNews(data);
      } else {
        setNews(prev => [...prev, ...data]);
      }
      if (count !== null && (pageIndex + 1) * limit >= count) {
        setHasMore(false);
      }
    }
    setLoading(false);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNews(nextPage);
  };

  return (
    <div className="py-16 bg-white w-full">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-emerald-100 p-3 rounded-xl">
            <Newspaper className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800">أحدث المقالات الطبية</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {news.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col group">
              {item.image_url ? (
                <div className="h-56 overflow-hidden">
                  <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              ) : (
                <div className="h-56 bg-emerald-50 flex items-center justify-center">
                  <Newspaper className="w-16 h-16 text-emerald-200" />
                </div>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 mb-6 line-clamp-3 leading-relaxed flex-1">{item.content}</p>
                <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-sm text-gray-500">
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
            </div>
          ))}
        </div>
        
        {loading && (
          <div className="text-center py-10">
            <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {!loading && news.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-gray-500 text-lg">لا توجد مقالات طبية حالياً.</p>
          </div>
        )}

        {!loading && hasMore && news.length > 0 && (
          <div className="mt-12 text-center">
            <button 
              onClick={loadMore}
              className="inline-flex items-center gap-2 bg-white text-emerald-600 font-bold px-8 py-3 rounded-full border-2 border-emerald-100 hover:bg-emerald-50 transition-colors"
            >
              عرض المزيد
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
