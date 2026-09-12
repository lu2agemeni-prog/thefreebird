// ============================================================================
// app/api/manager/profiles/route.ts
// يخدم تبويبي "الملفات الطبية" (role=patient) و"صلاحيات المستخدمين" (كل الأدوار)
// — ترقيم حقيقي بـ .range() + count: 'exact' بدل سحب 2000 صف وتقطيعهم في المتصفح.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, parsePaginationParams } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['manager']);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const { page, pageSize, q, from, to } = parsePaginationParams(request);
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role'); // 'patient' | null (null = كل الأدوار لتبويب الصلاحيات)

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (role) query = query.eq('role', role);

  if (q) {
    // بحث بسيط بالاسم الأول/الأخير/الهاتف/كود المريض — يشتغل على السيرفر
    // بدل ما نجيب كل الصفوف ونفلتر في المتصفح
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: 'تعذر تحميل البيانات.' }, { status: 500 });
  }

  return NextResponse.json({ rows: data || [], total: count || 0, page, pageSize });
}
