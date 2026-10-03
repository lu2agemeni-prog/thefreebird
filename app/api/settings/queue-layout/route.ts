// ============================================================================
// app/api/settings/queue-layout/route.ts
// مسار خادم لحفظ واسترجاع إعدادات وتخصيصات شاشة النداء الافتراضية
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_QUEUE_LAYOUT_CONFIG,
  SETTINGS_KEY,
  sanitizeLayoutConfig,
} from '@/lib/queue-layout-config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-key';

const serverSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export async function GET(): Promise<NextResponse> {
  try {
    const { data, error } = await serverSupabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      return NextResponse.json({
        success: true,
        config: sanitizeLayoutConfig(data.value),
      });
    }

    return NextResponse.json({
      success: true,
      config: DEFAULT_QUEUE_LAYOUT_CONFIG,
    });
  } catch (err: any) {
    console.warn('API error fetching queue layout settings:', err);
    return NextResponse.json({
      success: true,
      config: DEFAULT_QUEUE_LAYOUT_CONFIG,
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const config = sanitizeLayoutConfig(body?.config);

    const { error } = await serverSupabase
      .from('settings')
      .upsert({
        key: SETTINGS_KEY,
        value: config,
      });

    if (error) {
      console.error('Failed to upsert queue layout config in settings table:', error);
      let userFriendlyMsg = error.message;
      if (error.message.includes('row-level security') || error.code === '42501') {
        userFriendlyMsg = 'يتطلب تفعيل صلاحية الحفظ لجدول settings عبر تشغيل كود SQL لسياسة الأمان (RLS Policy). تم حفظ الإعدادات محلياً على هذا الجهاز مؤقتاً.';
      }
      return NextResponse.json(
        { success: false, message: userFriendlyMsg, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config,
      message: 'تم حفظ الإعدادات الافتراضية للشاشة بنجاح',
    });
  } catch (err: any) {
    console.error('API error saving queue layout settings:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'خطأ داخلي في الخادم' },
      { status: 500 }
    );
  }
}
