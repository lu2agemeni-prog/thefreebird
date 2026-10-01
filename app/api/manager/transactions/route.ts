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
  const clinicId = searchParams.get('clinicId');
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') === 'asc';
  const dateFrom = searchParams.get('dateFrom'); // YYYY-MM-DD
  const dateTo = searchParams.get('dateTo'); // YYYY-MM-DD
  const fetchAll = searchParams.get('fetchAll') === 'true' || searchParams.get('all') === 'true';

  let query = supabase
    .from('transactions')
    // transactions فيها علاقتين بـ profiles (user_id و beneficiary_id) —
    // لازم نحدد المقصود صراحةً وإلا Postgrest بيرفض الطلب بخطأ الغموض.
    .select('*, clinics(name), profiles!transactions_user_id_fkey(first_name, last_name), beneficiary:beneficiary_id(first_name, last_name)', { count: 'exact' });

  if (sortBy === 'amount') {
    query = query.order('amount', { ascending: sortOrder }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: sortOrder });
  }

  if (type) query = query.eq('type', type);
  if (clinicId) query = query.eq('clinic_id', clinicId);
  if (expenseGroup) query = query.eq('expense_group', expenseGroup);
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

  if (q) {
    query = query.or(`description.ilike.%${q}%,category.ilike.%${q}%`);
  }

  // في حالة طلب كافة البيانات للطباعة أو التصدير للشهر المالي/الفترة
  if (fetchAll) {
    const { data, error, count } = await query.limit(5000);

    if (error) {
      return NextResponse.json({ error: 'تعذر تحميل المعاملات المالية.' }, { status: 500 });
    }

    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    (data || []).forEach((r: any) => {
      const amt = Number(r.amount || 0);
      if (r.type === 'income') {
        if (amt > 0) {
          income += amt;
          incomeCount++;
        }
      } else {
        expense += amt;
        expenseCount++;
      }
    });

    return NextResponse.json({
      rows: data || [],
      total: count || (data?.length || 0),
      summary: {
        income,
        expense,
        net: income - expense,
        totalCount: incomeCount + expenseCount,
        incomeCount,
        expenseCount,
      },
    });
  }

  // الجلب الافتراضي المرقم للصفحة الحالية
  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: 'تعذر تحميل المعاملات المالية.' }, { status: 500 });
  }

  // حساب إحصائيات الشهر المالي / الفترة الزمنية المحددة بالكامل (وليس مجرد الصفحة الحالية)
  let sumQuery = supabase
    .from('transactions')
    .select('id, type, amount, created_at, clinic_id, description');

  if (type) sumQuery = sumQuery.eq('type', type);
  if (clinicId) sumQuery = sumQuery.eq('clinic_id', clinicId);
  if (expenseGroup) sumQuery = sumQuery.eq('expense_group', expenseGroup);
  if (dateFrom) sumQuery = sumQuery.gte('created_at', `${dateFrom}T00:00:00`);
  if (dateTo) sumQuery = sumQuery.lte('created_at', `${dateTo}T23:59:59`);
  if (q) {
    sumQuery = sumQuery.or(`description.ilike.%${q}%,category.ilike.%${q}%`);
  }

  const { data: sumRows } = await sumQuery.limit(5000);

  let periodIncome = 0;
  let periodExpense = 0;
  let periodIncomeCount = 0;
  let periodExpenseCount = 0;

  if (sumRows) {
    const validSumRows: any[] = [];
    sumRows.forEach((t: any) => {
      if (t.type === 'income') {
        if (Number(t.amount) === 0) return;
        const curTime = t.created_at ? new Date(t.created_at).getTime() : 0;
        const curDesc = (t.description || '').trim().toLowerCase();
        const isTwin = validSumRows.some((prev) => {
          if (prev.type !== 'income') return false;
          if (Number(prev.amount) !== Number(t.amount)) return false;
          const prevTime = prev.created_at ? new Date(prev.created_at).getTime() : 0;
          const prevDesc = (prev.description || '').trim().toLowerCase();
          const quickTwin = Math.abs(curTime - prevTime) <= 60000 && (prev.clinic_id === t.clinic_id || !prev.clinic_id || !t.clinic_id);
          const descTwin = curDesc && curDesc === prevDesc && Math.abs(curTime - prevTime) <= 86400000;
          return quickTwin || descTwin;
        });
        if (!isTwin) validSumRows.push(t);
      } else {
        validSumRows.push(t);
      }
    });

    validSumRows.forEach((r: any) => {
      const amt = Number(r.amount || 0);
      if (r.type === 'income') {
        periodIncome += amt;
        periodIncomeCount++;
      } else {
        periodExpense += amt;
        periodExpenseCount++;
      }
    });
  }

  return NextResponse.json({
    rows: data || [],
    total: count || 0,
    page,
    pageSize,
    summary: {
      income: periodIncome,
      expense: periodExpense,
      net: periodIncome - periodExpense,
      totalCount: periodIncomeCount + periodExpenseCount,
      incomeCount: periodIncomeCount,
      expenseCount: periodExpenseCount,
    },
  });
}

// ─── PUT: تعديل حركة مالية بواسطة المدير ───
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, ['manager']);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
  }

  const { id, amount, type, category, description, clinic_id, created_at, expense_group } = body;
  if (!id) {
    return NextResponse.json({ error: 'معرف الحركة مطلوب للتعديل.' }, { status: 400 });
  }

  const updateData: any = {};
  if (amount !== undefined) {
    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt < 0) {
      return NextResponse.json({ error: 'المبلغ غير صالح.' }, { status: 400 });
    }
    updateData.amount = parsedAmt;
  }
  if (type !== undefined) updateData.type = type;
  if (category !== undefined) updateData.category = category;
  if (description !== undefined) updateData.description = description;
  if (clinic_id !== undefined) updateData.clinic_id = clinic_id || null;
  if (created_at !== undefined) updateData.created_at = created_at;
  if (expense_group !== undefined) updateData.expense_group = expense_group;

  const { data, error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id)
    .select('*, clinics(name), profiles!transactions_user_id_fkey(first_name, last_name), beneficiary:beneficiary_id(first_name, last_name)')
    .single();

  if (error) {
    return NextResponse.json({ error: 'تعذر تعديل المعاملة المالية.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    transaction: data,
    message: 'تم حفظ تعديل المعاملة المالية بنجاح.',
  });
}

// ─── DELETE: حذف حركة مالية بواسطة المدير ───
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, ['manager']);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
  }

  const id = body?.id ? String(body.id).trim() : null;
  if (!id) {
    return NextResponse.json({ error: 'معرف الحركة مطلوب للحذف.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'تعذر حذف المعاملة المالية.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'تم حذف المعاملة المالية من سجل الحسابات بنجاح.',
  });
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

  // كشف القيود المكررة والقيود الصفرية غير الصحيحة
  const duplicateIds: string[] = [];
  const keptIds = new Set<string>();

  for (let i = 0; i < incomeRows.length; i++) {
    const cur = incomeRows[i];

    // أي قيد إيراد بمبلغ صفر هو قيد مشوه من تريجر الطابور يُحذف فوراً
    if (Number(cur.amount) === 0) {
      if (!duplicateIds.includes(cur.id)) duplicateIds.push(cur.id);
      continue;
    }

    if (duplicateIds.includes(cur.id) || keptIds.has(cur.id)) continue;
    keptIds.add(cur.id);

    const curTime = new Date(cur.created_at).getTime();
    const curDesc = (cur.description || '').trim().toLowerCase();

    for (let j = i + 1; j < incomeRows.length; j++) {
      const next = incomeRows[j];
      if (duplicateIds.includes(next.id)) continue;

      const nextTime = new Date(next.created_at).getTime();
      const timeDiff = nextTime - curTime;
      const nextDesc = (next.description || '').trim().toLowerCase();

      // 1) قيد توأم متطابق في غضون 60 ثانية لنفس العيادة والمبلغ
      const isQuickTwin =
        timeDiff <= 60000 &&
        Number(cur.amount) === Number(next.amount) &&
        (cur.clinic_id === next.clinic_id || !cur.clinic_id || !next.clinic_id);

      // 2) قيد بنفس الوصف والمبلغ لنفس العيادة في غضون نفس اليوم
      const isExactDescTwin =
        curDesc &&
        curDesc === nextDesc &&
        Number(cur.amount) === Number(next.amount) &&
        Math.abs(timeDiff) <= 86400000;

      if (isQuickTwin || isExactDescTwin) {
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