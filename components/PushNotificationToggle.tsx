'use client';

// ============================================================================
// components/PushNotificationToggle.tsx
// زرار في الهيدر لتفعيل إشعارات الموبايل الحقيقية (توصل حتى لو التطبيق
// مقفول تمامًا) — مختلف عن جرس الإشعارات اللي بيتحدث بس وانت فاتح التطبيق.
// ============================================================================
import { useState, useEffect } from 'react';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { enablePushNotifications, disablePushNotifications, getPushSubscriptionStatus, isPushSupported } from '@/lib/push-notifications';

export function PushNotificationToggle() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) { setStatus('unsupported'); return; }
    getPushSubscriptionStatus().then(setStatus);
  }, []);

  if (status === 'loading' || status === 'unsupported' || !user) return null;

  const handleClick = async () => {
    setBusy(true);
    if (status === 'subscribed') {
      await disablePushNotifications();
      setStatus('default');
    } else {
      const res = await enablePushNotifications(user.id);
      if (res.ok) setStatus('subscribed');
      else {
        alert(res.error);
        setStatus(await getPushSubscriptionStatus());
      }
    }
    setBusy(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy || status === 'denied'}
      title={
        status === 'denied'
          ? 'تم حظر الإشعارات من إعدادات المتصفح'
          : status === 'subscribed'
          ? 'إشعارات الموبايل مفعّلة — اضغط لإيقافها'
          : 'تفعيل إشعارات الموبايل حتى لو التطبيق مقفول'
      }
      className={`p-2 rounded-lg transition-colors ${
        status === 'subscribed' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
      } ${status === 'denied' ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : status === 'subscribed' ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
    </button>
  );
}
