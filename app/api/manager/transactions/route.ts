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
    .select('*, profiles!transactions_user_id_fkey(first_name, last_name), beneficiary:beneficiary_id(first_name, last_name)', { count: 'exact' })
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