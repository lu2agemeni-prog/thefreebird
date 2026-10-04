'use client';

// ============================================================================
// components/queue/QueueNewsTicker.tsx
// شريط الأخبار المتحرك بالأسفل (Bottom News Ticker):
// - يعرض آخر الأخبار الطبية الحية من جدول medical_news
// - يعرض الإعلانات والتنبيهات المخصصة للمركز
// - حركة شريطية مستمرة وسلسة (Marquee animation)
// - قابلية كاملة لتخصيص الألوان والسرعة والخط والأيقونات
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Newspaper, BellRing, Sparkles, Activity } from 'lucide-react';
import { QueueLayoutConfig } from '@/lib/queue-layout-config';

interface QueueNewsTickerProps {
  config: QueueLayoutConfig;
}

interface NewsItem {
  id: string;
  title: string;
  created_at?: string;
}

export function QueueNewsTicker({ config }: QueueNewsTickerProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // جلب آخر الأخبار الطبية
  useEffect(() => {
    let isMounted = true;

    async function loadNews() {
      try {
        const { data, error } = await supabase
          .from('medical_news')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(8);

        if (!error && data && isMounted) {
          setNews(data);
        }
      } catch (err) {
        console.warn('Could not load medical news for ticker:', err);
      }
    }

    loadNews();

    // اشتراك لحظي في جدول الأخبار
    const channel = supabase
      .channel('queue_ticker_news_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medical_news' },
        () => loadNews()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // تجهيز قائمة عناصر الشريط
  const tickerItems = useMemo(() => {
    const items: Array<{ id: string; text: string; type: 'news' | 'announcement' }> = [];

    // 1. إضافة النص الإعلاني المخصص للمركز إذا تم اختياره
    if (
      (config.tickerTextSource === 'custom' || config.tickerTextSource === 'both') &&
      config.tickerCustomText?.trim()
    ) {
      items.push({
        id: 'custom-announcement',
        text: config.tickerCustomText.trim(),
        type: 'announcement',
      });
    }

    // 2. إضافة عناوين الأخبار الطبية
    if (config.tickerTextSource === 'medical_news' || config.tickerTextSource === 'both') {
      if (news.length > 0) {
        news.forEach((n) => {
          items.push({
            id: `news-${n.id}`,
            text: n.title,
            type: 'news',
          });
        });
      } else if (items.length === 0) {
        // نص افتراضي في حال عدم وجود أخبار
        items.push({
          id: 'default-tip',
          text: 'مركز الطائر الحر الطبي يرحب بكم.. صحتكم وراحتكم هي غايتنا الأولى دائماً.',
          type: 'announcement',
        });
      }
    }

    return items;
  }, [config.tickerTextSource, config.tickerCustomText, news]);

  // تكرار عناصر الشريط ورا بعضها بشكل متصل ومستمر دون أي فراغات
  const baseItemsList = useMemo(() => {
    if (tickerItems.length === 0) return [];
    const list: Array<{ id: string; text: string; type: 'news' | 'announcement' }> = [];
    // نضمن تكرار العناصر عدة مرات متتالية ورا بعضها مباشرة
    const repeats = Math.max(12, Math.ceil(14 / tickerItems.length));
    for (let r = 0; r < repeats; r++) {
      tickerItems.forEach((item) => {
        list.push(item);
      });
    }
    return list;
  }, [tickerItems]);

  if (!config.showNewsTicker) {
    return null;
  }

  // مدة الحركة بالثواني - يتم ضمان قيمة كافية لحركة هادئة ومريحة للقراءة
  const durationSec = Math.max(20, config.tickerSpeedSeconds || 75);
  const fontSize = config.tickerFontSizePx || 15;
  const isRtlMovement = config.tickerDirection === 'rtl';

  return (
    <div
      style={{
        height: `${config.tickerHeightPx}px`,
        backgroundColor: config.tickerBgColor,
        color: config.tickerTextColor,
        borderTop: `1px solid ${config.cardBorderColor || '#334155'}`,
        fontSize: `${fontSize}px`,
      }}
      className="relative flex items-center overflow-hidden shrink-0 z-20 select-none shadow-xl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <style>{`
        @keyframes ticker-marquee-move {
          0% {
            transform: translateX(${isRtlMovement ? '0%' : '-50%'});
          }
          100% {
            transform: translateX(${isRtlMovement ? '-50%' : '0%'});
          }
        }
        .queue-marquee-track {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          width: max-content;
          animation: ticker-marquee-move ${durationSec}s linear infinite;
          will-change: transform;
        }
        .queue-marquee-track.paused {
          animation-play-state: paused;
        }
      `}</style>

      {/* الشارة الثابتة يمين شريط الأخبار */}
      <div
        style={{
          backgroundColor: config.tickerBadgeBg,
          color: config.tickerBadgeTextColor,
        }}
        className="h-full px-4 sm:px-5 flex items-center gap-2 font-black text-xs sm:text-sm tracking-wide shrink-0 z-10 shadow-md border-l border-white/20"
      >
        <Newspaper className="w-4 h-4 animate-bounce" />
        <span className="hidden sm:inline">أخبار المركز والتنبيهات</span>
        <span className="sm:hidden">الأخبار</span>
      </div>

      {/* مسار حركة النص المستمرة المتكررة ورا بعضها بنظام LTR لضبط إحداثيات الحركة 100% */}
      <div className="flex-1 overflow-hidden relative h-full flex items-center" dir="ltr">
        <div
          style={{ fontSize: `${fontSize}px` }}
          className={`queue-marquee-track ${isPaused ? 'paused' : ''} gap-6 font-bold`}
        >
          {/* النصف الأول من العناصر المتكررة ورا بعضها */}
          {baseItemsList.map((item, idx) => (
            <div
              key={`rep1-${item.id}-${idx}`}
              dir="rtl"
              className="inline-flex items-center gap-2.5 shrink-0 px-2"
            >
              {item.type === 'announcement' ? (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <BellRing className="w-3 h-3" />
                  <span>تنبيه</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Activity className="w-3 h-3" />
                  <span>طبي</span>
                </span>
              )}
              <span className="font-bold tracking-wide">{item.text}</span>
              <span className="text-amber-400/90 mr-2 font-mono font-bold text-sm">✦</span>
            </div>
          ))}

          {/* النصف الثاني التوأم لضمان دوران متصل لانهائي دون أي انقطاع */}
          {baseItemsList.map((item, idx) => (
            <div
              key={`rep2-${item.id}-${idx}`}
              dir="rtl"
              className="inline-flex items-center gap-2.5 shrink-0 px-2"
            >
              {item.type === 'announcement' ? (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <BellRing className="w-3 h-3" />
                  <span>تنبيه</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  <span>طبي</span>
                </span>
              )}
              <span className="font-bold tracking-wide">{item.text}</span>
              <span className="text-amber-400/90 mr-2 font-mono font-bold text-sm">✦</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
