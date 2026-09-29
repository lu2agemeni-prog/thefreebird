// ============================================================================
// app/api/manager/transactions/route.ts
// يخدم تبويب "الماليات والأرباح" — ترقيم حقيقي على السيرفر لأن جدول
// transactions بينمو باستمرار (كل تحصيل من الطابور بقى بينشئ صف فيه تلقائيًا).
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, parsePaginationParams } from '@/lib/api-auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, ['manager', 'accountant']);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const { page, pageSize, q, from, to } = parsePaginationParams(request);
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'income' | 'expense' | 'salary' | null
  const expenseGroup = searchParams.get('expenseGroup');
  const dateFrom = searchParams.get('dateFrom'); // YYYY-MM-DD
  const dateTo = searchParams.get('dateTo'); // YYYY-MM-DD

  let query = supabase
    .from('transactions')
    // transactions فيها علاقتين بـ profiles (user_id و beneficiary_id) —
    // لازم نحدد المقصود صراحةً وإلا Postgrest بيرفض الطلب بخطأ الغموض.
    .select('*, clinics(name), profiles!transactions_user_id_fkey(first_name, last_name), beneficiary:beneficiary_id(first_name, last_name)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type);
  if (expenseGroup) query = query.eq('expense_group', expenseGroup);
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

  if (q) {
    query = query.or(`description.ilike.%${q}%,category.ilike.%${q}%`);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: 'تعذر تحميل المعاملات المالية.' }, { status: 500 });
  }

  return NextResponse.json({ rows: data || [], total: count || 0, page, pageSize });
}

// ─── POST: فحص وتنظيف الحركات المكررة الناتجة عن التريجر المزدوج ───
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, ['manager']);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Default action
  }

  const action = body?.action || 'detect_duplicates';

  // جلب كافة حركات الإيرادات للتحقق من التكرارات
  const { data: incomeRows, error } = await supabase
    .from('transactions')
    .select('id, amount, clinic_id, created_at, description, type, category')
    .eq('type', 'income')
    .order('created_at', { ascending: true })
    .limit(5000);

  if (error || !incomeRows) {
    return NextResponse.json({ error: 'تعذر جلب الحركات المالية للفحص.' }, { status: 500 });
  }

  // كشف القيود المكررة (نفس المبلغ + نفس العيادة + إنشاء بفارق أقل من 15 ثانية)
  const duplicateIds: string[] = [];
  const keptIds = new Set<string>();

  for (let i = 0; i < incomeRows.length; i++) {
    const cur = incomeRows[i];
    if (duplicateIds.includes(cur.id) || keptIds.has(cur.id)) continue;
    keptIds.add(cur.id);

    const curTime = new Date(cur.created_at).getTime();
    for (let j = i + 1; j < incomeRows.length; j++) {
      const next = incomeRows[j];
      const nextTime = new Date(next.created_at).getTime();
      if (nextTime - curTime > 15000) break;

      if (
        !duplicateIds.includes(next.id) &&
        Number(cur.amount) === Number(next.amount) &&
        (cur.clinic_id === next.clinic_id || !cur.clinic_id || !next.clinic_id)
      ) {
        duplicateIds.push(next.id);
      }
    }
  }

  if (action === 'detect_duplicates') {
    return NextResponse.json({
      detectedCount: duplicateIds.length,
      duplicateIds,
    });
  }

  if (action === 'clean_duplicates') {
    if (duplicateIds.length === 0) {
      return NextResponse.json({ success: true, removedCount: 0, message: 'لا توجد قيود مكررة في الحسابات.' });
    }

    let totalRemoved = 0;
    const batchSize = 100;
    for (let b = 0; b < duplicateIds.length; b += batchSize) {
      const batch = duplicateIds.slice(b, b + batchSize);
      const { error: delErr } = await supabase
        .from('transactions')
        .delete()
        .in('id', batch);
      if (!delErr) {
        totalRemoved += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      removedCount: totalRemoved,
      message: `تم حذف ${totalRemoved} حركة مكررة بنجاح وضبط الحسابات بدقة.`,
    });
  }

  return NextResponse.json({ error: 'إجراء غير معروف.' }, { status: 400 });
}