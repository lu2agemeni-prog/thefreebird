// ============================================================================
// app/api/push/dispatch/route.ts
// بينادى عليه trigger قاعدة البيانات (عن طريق pg_net) مش المتصفح مباشرة —
// محمي بمفتاح سري مشترك (x-push-secret) بدل جلسة مستخدم، لأن القاعدة نفسها
// هي اللي بتستدعيه. بيبعت إشعار Push حقيقي لكل جهاز مشترك، حتى لو التطبيق
// مقفول تمامًا على الموبايل.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-push-secret');
  if (!secret || secret !== process.env.PUSH_DISPATCH_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: 'push not configured (missing VAPID env vars)' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const subscriptions: { endpoint: string; p256dh: string; auth: string }[] = body?.subscriptions || [];
  if (subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const payload = JSON.stringify({
    title: body.title || 'إشعار جديد',
    message: body.message || '',
    link: body.link || '/',
  });

  // نفس الـ anon client، بدون أي جلسة مستخدم — بيستخدم بس RPC آمن لحذف
  // الاشتراكات المنتهية بمطابقة endpoint (شرح كامل في ملف الهجرة).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  let sent = 0;
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (err: any) {
      // 404/410 = الاشتراك ملغي (المستخدم مسح الإذن أو شال التطبيق) — ننظفه
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
      }
    }
  }));

  return NextResponse.json({ sent });
}
