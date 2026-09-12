'use client';

// ============================================================================
// lib/push-notifications.ts
// تسجيل الـ Service Worker والاشتراك/إلغاء الاشتراك في إشعارات Push.
// ============================================================================
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushSubscriptionStatus(): Promise<'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed'> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const existing = await reg?.pushManager.getSubscription();
  if (existing) return 'subscribed';
  return Notification.permission === 'granted' ? 'granted' : 'default';
}

export async function enablePushNotifications(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: 'المتصفح ده لا يدعم إشعارات Push.' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'إعدادات إشعارات Push لم تُفعّل بعد من الإدارة.' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'تم رفض إذن الإشعارات — يمكنك تفعيله لاحقًا من إعدادات المتصفح.' };
    }

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert([{
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh!,
      auth: json.keys!.auth!,
    }], { onConflict: 'endpoint' });

    if (error) return { ok: false, error: 'تعذر حفظ الاشتراك في الخادم.' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'حدث خطأ أثناء تفعيل الإشعارات.' };
  }
}

export async function disablePushNotifications(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: true };
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = await reg?.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.rpc('remove_push_subscription', { p_endpoint: endpoint });
  }
  return { ok: true };
}
