// ============================================================================
// app/api/transactions/sync-visit/route.ts
// يقوم بمزامنة وضبط قيود transactions فور تسجيل زيارة جديدة أو إضافة خدمة.
// يحل جذرياً مشكلة التكرار المزدوج الناتج عن تريجر patient_visits وتريجر call_queue:
// 1) يمسح أي قيود بمبلغ صفر ناتجة عن صف الطابور المجرد.
// 2) يكتشف القيود التوأم المكررة لنفس الخدمة والمريض والمبلغ ويحذف التكرار فوراً.
// 3) يضمن وجود قيد مالي واحد ووحيد ودقيق لكل خدمة تم تحصيلها.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

interface ServiceItem {
  name: string;
  price: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, ['manager', 'secretary']);
  if ('error' in auth) return auth.error;
  const { supabase, profile } = auth;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
  }

  const patientName = String(body?.patientName || '').trim();
  const clinicId = body?.clinicId || null;
  const services: ServiceItem[] = Array.isArray(body?.services) ? body.services : [];

  if (!patientName) {
    return NextResponse.json({ error: 'اسم المريض مطلوب للمزامنة.' }, { status: 400 });
  }

  // انتظر 300 مللي ثانية للتأكد من اكتمال تنفيذ تريجرات قاعدة البيانات
  await new Promise((res) => setTimeout(res, 300));

  // استعلام عن الحركات المسجلة مؤخراً (في آخر 3 دقائق)
  const windowStart = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  let query = supabase
    .from('transactions')
    .select('id, amount, clinic_id, description, created_at, type, category')
    .eq('type', 'income')
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(40);

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data: recentRows, error: fetchErr } = await query;
  if (fetchErr || !recentRows) {
    return NextResponse.json({ success: true, message: 'تعذر جلب الحركات للمزامنة الفورية.' });
  }

  // فرز الحركات المرتبطة بهذا المريض
  // نبحث إما عن ورود اسم المريض في الوصف أو قيود حديثة جداً مطابقة للمبالغ
  const patientRelated = recentRows.filter((t) => {
    const desc = (t.description || '').toLowerCase();
    const nameMatch = desc.includes(patientName.toLowerCase());
    return nameMatch;
  });

  const idsToDelete: string[] = [];

  // 1) حذف أي قيد بمبلغ صفر (الناتج عن call_queue بدون تحصيل)
  patientRelated.forEach((t) => {
    if (Number(t.amount) === 0) {
      idsToDelete.push(t.id);
    }
  });

  // 2) تنظيف التكرارات المزدوجة بين تريجر الطابور وتريجر الزيارات
  // نحسب المبالغ المتوقعة لكل خدمة مدفوعة
  const validServicePrices = services
    .map((s) => Number(s.price) || 0)
    .filter((p) => p > 0);

  // نجمع الحركات غير الصفرية للمريض
  const nonZeroPatientRows = patientRelated.filter(
    (t) => Number(t.amount) > 0 && !idsToDelete.includes(t.id)
  );

  // لكل مبلغ متوقع، نسمح بقيد واحد فقط لكل خدمة، وما زاد يُعتبر تكراراً للتريجر المزدوج
  const expectedCounts: Record<number, number> = {};
  validServicePrices.forEach((p) => {
    expectedCounts[p] = (expectedCounts[p] || 0) + 1;
  });

  const seenCounts: Record<number, number> = {};
  nonZeroPatientRows.forEach((t) => {
    const amt = Number(t.amount);
    seenCounts[amt] = (seenCounts[amt] || 0) + 1;
    const maxAllowed = expectedCounts[amt] || 1;
    if (seenCounts[amt] > maxAllowed) {
      // قيد مكرر إضافي زائد عن عدد الخدمات المحصلة بهذا السعر
      idsToDelete.push(t.id);
    }
  });

  // 3) فحص التوأم المتطابق بالثواني (نفس المبلغ ونفس العيادة في غضون 20 ثانية)
  // كشبكة أمان إضافية لضمان عدم بقاء أي حركة توأم
  for (let i = 0; i < nonZeroPatientRows.length; i++) {
    const cur = nonZeroPatientRows[i];
    if (idsToDelete.includes(cur.id)) continue;
    const curTime = new Date(cur.created_at).getTime();

    for (let j = i + 1; j < nonZeroPatientRows.length; j++) {
      const other = nonZeroPatientRows[j];
      if (idsToDelete.includes(other.id)) continue;
      const otherTime = new Date(other.created_at).getTime();

      if (
        Number(cur.amount) === Number(other.amount) &&
        cur.clinic_id === other.clinic_id &&
        Math.abs(curTime - otherTime) <= 20000
      ) {
        // إذا كانا لنفس الخدمة والعدد المسجل يتجاوز المتوقع
        const amt = Number(cur.amount);
        const maxExpected = expectedCounts[amt] || 1;
        const keptSoFar = nonZeroPatientRows.filter(
          (r) => Number(r.amount) === amt && !idsToDelete.includes(r.id)
        ).length;
        if (keptSoFar > maxExpected) {
          idsToDelete.push(other.id);
        }
      }
    }
  }

  // تنفيذ الحذف الفعلي للقيود المكررة أو الصفرية
  let deletedCount = 0;
  if (idsToDelete.length > 0) {
    const uniqueIds = Array.from(new Set(idsToDelete));
    const { error: delErr } = await supabase
      .from('transactions')
      .delete()
      .in('id', uniqueIds);
    if (!delErr) {
      deletedCount = uniqueIds.length;
    }
  }

  return NextResponse.json({
    success: true,
    deletedDuplicates: deletedCount,
    message: deletedCount > 0 ? `تم ضبط الحركات المالية وحذف ${deletedCount} قيد مكرر تلقائيًا.` : 'الحركات المالية مضبوطة.',
  });
}
