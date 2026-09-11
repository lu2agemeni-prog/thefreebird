// ============================================================================
// app/api/manager/patients-import/route.ts
// استيراد مرضى بالجملة من ملف إكسيل (تم تحليله في المتصفح وإرساله هنا كـ
// JSON) — للسكرتارية والمدير. بيتحقق من التكرار قبل الإدراج عن طريق مقارنة
// رقم الهاتف (بعد تطبيع الأرقام) مع كل من:
//   1) المرضى المسجّلين بحساب فعلي (profiles حيث role = patient)
//   2) مرضى الزيارة المباشرة المسجّلين قبل كده (walk_in_patients)
// أي صف رقم هاتفه موجود بالفعل (في الملف أو في القاعدة) يتم تجاهله، والباقي
// يُدرج في walk_in_patients (نفس الجدول المستخدم لإضافة مريض يدويًا من غير
// حساب دخول، لأن profiles.id مرتبط إجباريًا بحساب auth.users حقيقي).
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

const MAX_ROWS = 2000;

function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  // إزالة كود الدولة لو موجود (20 أو 0020) عشان نقارن بنفس صيغة الأرقام
  // المصرية المحلية (01XXXXXXXXX)
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length > 10) digits = digits.slice(2);
  if (digits.length > 1 && !digits.startsWith('0')) digits = '0' + digits;
  return digits;
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['manager', 'secretary']);
  if ('error' in auth) return auth.error;
  const { supabase, profile } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'تعذر قراءة الملف المرسل.' }, { status: 400 });
  }

  const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: 'الملف لا يحتوي على أي صفوف صالحة.' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `الحد الأقصى ${MAX_ROWS} صف في المرة الواحدة — قسّم الملف على دفعات.` }, { status: 400 });
  }

  // 1) تنظيف وتحقق أولي + إزالة التكرار داخل الملف نفسه
  const seenInFile = new Set<string>();
  let invalidCount = 0;
  let duplicateInFileCount = 0;
  const cleaned: { name: string; phone: string | null; phoneKey: string | null }[] = [];

  for (const row of rows) {
    const name = String(row?.name ?? '').trim();
    if (!name) {
      invalidCount++;
      continue;
    }
    const phone = normalizePhone(row?.phone);
    const phoneKey = phone;
    if (phoneKey) {
      if (seenInFile.has(phoneKey)) {
        duplicateInFileCount++;
        continue; // مكرر داخل نفس الملف
      }
      seenInFile.add(phoneKey);
    }
    cleaned.push({ name, phone, phoneKey });
  }

  // 2) التحقق من التكرار مع القاعدة — على دفعات (phone IN (...))
  const phoneKeys = cleaned.map(r => r.phoneKey).filter((p): p is string => !!p);
  const existingPhones = new Set<string>();

  if (phoneKeys.length > 0) {
    const [profilesRes, walkInRes] = await Promise.all([
      supabase.from('profiles').select('phone').eq('role', 'patient').in('phone', phoneKeys),
      supabase.from('walk_in_patients').select('phone').in('phone', phoneKeys),
    ]);
    (profilesRes.data || []).forEach((p: any) => { if (p.phone) existingPhones.add(normalizePhone(p.phone) || ''); });
    (walkInRes.data || []).forEach((p: any) => { if (p.phone) existingPhones.add(normalizePhone(p.phone) || ''); });
  }

  const toInsert = cleaned.filter(r => !r.phoneKey || !existingPhones.has(r.phoneKey));
  const duplicateCount = (cleaned.length - toInsert.length) + duplicateInFileCount;

  if (toInsert.length === 0) {
    return NextResponse.json({
      inserted: 0,
      duplicates: duplicateCount,
      invalid: invalidCount,
      total: rows.length,
    });
  }

  const { error: insertError } = await supabase.from('walk_in_patients').insert(
    toInsert.map(r => ({ name: r.name, phone: r.phone, created_by: profile.id }))
  );

  if (insertError) {
    return NextResponse.json({ error: 'تعذر حفظ بيانات المرضى في قاعدة البيانات.' }, { status: 500 });
  }

  return NextResponse.json({
    inserted: toInsert.length,
    duplicates: duplicateCount,
    invalid: invalidCount,
    total: rows.length,
  });
}
