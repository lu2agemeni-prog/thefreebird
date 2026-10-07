import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG,
  QUEUE_AUTO_EXPIRE_SETTINGS_KEY,
  QueueAutoExpireConfig,
} from '@/lib/queue-auto-complete';

// ============================================================================
// app/api/settings/queue-auto-expire/route.ts
// مسار جلب وحفظ إعدادات الإنهاء التلقائي لأدوار النداء الآلي (تحكم المدير)
// ============================================================================

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', QUEUE_AUTO_EXPIRE_SETTINGS_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      return NextResponse.json({
        success: true,
        config: data.value,
      });
    }

    return NextResponse.json({
      success: true,
      config: DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG,
    });
  } catch (err: any) {
    console.error('Error fetching queue auto-expire config:', err);
    return NextResponse.json({
      success: false,
      config: DEFAULT_QUEUE_AUTO_EXPIRE_CONFIG,
      error: err?.message,
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const config: QueueAutoExpireConfig = body.config || body;

    // التحقق من صحة الإعدادات
    if (!config || (config.mode !== 'hours' && config.mode !== 'end_of_day')) {
      return NextResponse.json(
        { success: false, error: 'إعدادات غير صالحة' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('settings')
      .upsert({
        key: QUEUE_AUTO_EXPIRE_SETTINGS_KEY,
        value: config,
      });

    if (error) {
      console.error('Error saving queue auto-expire config:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config,
      message: 'تم حفظ إعدادات الإنهاء التلقائي بنجاح',
    });
  } catch (err: any) {
    console.error('Error saving queue auto-expire config:', err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
