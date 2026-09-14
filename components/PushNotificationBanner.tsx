'use client';

// ============================================================================
// components/PushNotificationBanner.tsx
// شريط أعلى الصفحة بيظهر لأي مستخدم (جديد أو قديم) لسه ما فعّلش إشعارات
// الموبايل، وبيختفي تلقائيًا لو فعّلها بالفعل.
// ============================================================================
import { useState, useEffect } from 'react';
import { BellRing, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { enablePushNotifications, getPushSubscriptionStatus, isPushSupported } from '@/lib/push-notifications';

export function PushNotificationBanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed'>('loading');
  const [dismissed, setDismissed] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) { setTimeout(() => setStatus('unsupported'), 0); return; }
    getPushSubscriptionStatus().then(setStatus);
  }, []);

  const shouldShow = user && !dismissed && (status === 'default' || status === 'granted');
  if (!shouldShow) return null;

  async function handleEnable() {
    if (!user) return;
    setEnabling(true);
    const res = await enablePushNotifications(user.id);
    setEnabling(false);
    if (res.ok) {
      setStatus('subscribed');
    } else if (res.error) {
      alert(res.error);
      setStatus(await getPushSubscriptionStatus());
    }
  };

  return (
    <div className="bg-emerald-600 text-white px-4 py-3 flex flex-wrap items-center justify-center gap-3 text-sm relative">
      <div className="flex items-center gap-2 font-bold">
        <BellRing className="w-5 h-5 shrink-0" />
        <span>فعّل إشعارات الموبايل عشان توصلك أهم التحديثات حتى لو التطبيق مقفول</span>
      </div>
      <button
        onClick={handleEnable}
        disabled={enabling}
        className="bg-white text-emerald-700 font-bold px-4 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-2 disabled:opacity-60"
      >
        {enabling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        تفعيل الإشعارات
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-100 hover:text-white p-1"
        aria-label="إغلاق"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
