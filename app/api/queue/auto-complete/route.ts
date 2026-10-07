import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  autoCompleteExpiredQueueItems,
  fetchQueueAutoExpireConfig,
  formatExpiryConfigSummary,
  QueueAutoExpireConfig,
} from '@/lib/queue-auto-complete';

// ============================================================================
// app/api/queue/auto-complete/route.ts
// مسار برمجي للإنهاء التلقائي لكافة أدوار النداء المتجاوزة للمدة المحددة من المدير
// ============================================================================

export async function GET() {
  try {
    const config = await fetchQueueAutoExpireConfig(supabase);
    const result = await autoCompleteExpiredQueueItems(supabase, config);
    return NextResponse.json({
      ...result,
      appliedConfig: config,
      summary: formatExpiryConfigSummary(config),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'خطأ أثناء الإنهاء التلقائي' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    let overrideConfig: QueueAutoExpireConfig | undefined;
    try {
      const body = await req.json();
      if (body?.config) {
        overrideConfig = body.config;
      }
    } catch {
      // no body, use stored config
    }

    const config = overrideConfig || (await fetchQueueAutoExpireConfig(supabase));
    const result = await autoCompleteExpiredQueueItems(supabase, config);

    return NextResponse.json({
      ...result,
      appliedConfig: config,
      summary: formatExpiryConfigSummary(config),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'خطأ أثناء الإنهاء التلقائي' },
      { status: 500 }
    );
  }
}
