import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { autoCompleteExpiredQueueItems, QUEUE_AUTO_COMPLETE_HOURS } from '@/lib/queue-auto-complete';

// ============================================================================
// app/api/queue/auto-complete/route.ts
// مسار برمجي للإنهاء التلقائي لكافة أدوار النداء التي تجاوزت ساعتين من تسجيلها
// ============================================================================

export async function GET() {
  const result = await autoCompleteExpiredQueueItems(supabase, QUEUE_AUTO_COMPLETE_HOURS);
  return NextResponse.json({
    ...result,
    expiryHours: QUEUE_AUTO_COMPLETE_HOURS,
    timestamp: new Date().toISOString(),
  });
}

export async function POST() {
  const result = await autoCompleteExpiredQueueItems(supabase, QUEUE_AUTO_COMPLETE_HOURS);
  return NextResponse.json({
    ...result,
    expiryHours: QUEUE_AUTO_COMPLETE_HOURS,
    timestamp: new Date().toISOString(),
  });
}
