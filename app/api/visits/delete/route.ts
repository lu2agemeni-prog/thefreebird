// ============================================================================
// app/api/visits/delete/route.ts
// يقوم بحذف الزيارة أو خدمة من الزيارة مع تنظيف كافة الآثار المالية والتنظيمية:
// 1) حذف صف الخدمة أو كافة صفوف الزيارة من patient_visits.
// 2) حذف القيد المالي المقابل من transactions (بما فيه أي تكرارات توأمية مرتبطة).
// 3) حذف الدور من شاشة النداء call_queue عند حذف الزيارة بالكامل.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, ['manager', 'secretary']);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
  }

  const visitId = body?.visitId ? String(body.visitId).trim() : null;
  const visitGroupId = body?.visitGroupId ? String(body.visitGroupId).trim() : null;

  if (!visitId && !visitGroupId) {
    return NextResponse.json({ error: 'يجب تحديد معرف الزيارة أو معرف المجموعة للحذف.' }, { status: 400 });
  }

  let deletedVisitsCount = 0;
  let deletedTransactionsCount = 0;
  let deletedQueueCount = 0;

  // ─── الحالة 1: حذف زيارة بالكامل (كافة الخدمات المرتبطة بنفس visit_group_id) ───
  if (visitGroupId) {
    // جلب كافة صفوف الزيارة لمعرفة بياناتها المالية والمريض
    const { data: groupRows, error: fetchErr } = await supabase
      .from('patient_visits')
      .select('id, patient_name, clinic_id, doctor_id, paid_amount, visit_date, visit_group_id, created_at')
      .or(`visit_group_id.eq.${visitGroupId},id.eq.${visitGroupId}`);

    if (fetchErr) {
      return NextResponse.json({ error: 'تعذر جلب بيانات الزيارة المراد حذفها.' }, { status: 500 });
    }

    if (!groupRows || groupRows.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على أي زيارات مطابقة.' }, { status: 404 });
    }

    const first = groupRows[0];
    const patientName = first.patient_name;
    const clinicId = first.clinic_id;
    const visitDate = (first.visit_date || '').slice(0, 10);
    const visitRowIds = groupRows.map((r) => r.id);

    // 1) حذف كافة صفوف الزيارة من patient_visits
    const { error: delVisitsErr } = await supabase
      .from('patient_visits')
      .delete()
      .in('id', visitRowIds);

    if (delVisitsErr) {
      return NextResponse.json({ error: 'تعذر حذف صفوف الزيارة من السجل الطبي.' }, { status: 500 });
    }
    deletedVisitsCount = visitRowIds.length;

    // 2) حذف الدور من call_queue لشاشة النداء
    let qQuery = supabase.from('call_queue').delete();
    if (first.visit_group_id) {
      qQuery = qQuery.or(`visit_group_id.eq.${first.visit_group_id},and(patient_name.eq.${patientName},clinic_id.eq.${clinicId})`);
    } else {
      qQuery = qQuery.match({ patient_name: patientName, clinic_id: clinicId });
    }
    const { error: delQueueErr } = await qQuery;
    if (!delQueueErr) {
      deletedQueueCount = 1;
    }

    // 3) حذف كافة القيود المالية المقابلة من transactions
    // نبحث عن حركات الإيرادات لنفس العيادة والمريض التي أنشئت في نفس تاريخ الزيارة أو خلال 48 ساعة
    if (patientName) {
      const dateStart = visitDate ? `${visitDate}T00:00:00` : new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const dateEnd = visitDate ? `${visitDate}T23:59:59` : new Date().toISOString();

      let txQuery = supabase
        .from('transactions')
        .select('id, amount, clinic_id, description, created_at')
        .eq('type', 'income')
        .ilike('description', `%${patientName}%`);

      if (clinicId) {
        txQuery = txQuery.eq('clinic_id', clinicId);
      }
      if (visitDate) {
        txQuery = txQuery.gte('created_at', dateStart).lte('created_at', dateEnd);
      }

      const { data: txRows } = await txQuery;
      if (txRows && txRows.length > 0) {
        const txIds = txRows.map((t) => t.id);
        const { error: delTxErr } = await supabase
          .from('transactions')
          .delete()
          .in('id', txIds);
        if (!delTxErr) {
          deletedTransactionsCount = txIds.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      deletedVisits: deletedVisitsCount,
      deletedTransactions: deletedTransactionsCount,
      deletedQueue: deletedQueueCount,
      message: `تم حذف الزيارة (${deletedVisitsCount} خدمة) وخصم ${deletedTransactionsCount} حركة مالية من الحسابات بنجاح.`,
    });
  }

  // ─── الحالة 2: حذف خدمة مفردة بالـ visitId ───
  if (visitId) {
    // جلب بيانات الخدمة قبل حذفها
    const { data: targetVisit, error: fetchErr } = await supabase
      .from('patient_visits')
      .select('id, patient_name, clinic_id, doctor_id, paid_amount, visit_date, visit_group_id, created_at')
      .eq('id', visitId)
      .single();

    if (fetchErr || !targetVisit) {
      return NextResponse.json({ error: 'لم يتم العثور على الخدمة المحددة.' }, { status: 404 });
    }

    const { patient_name, clinic_id, paid_amount, visit_date, visit_group_id, created_at } = targetVisit;
    const amountVal = Number(paid_amount || 0);

    // فحص ما إذا كانت هذه هي الخدمة الوحيدة المتبقية في هذه المجموعة
    let isLastServiceInGroup = true;
    if (visit_group_id) {
      const { data: siblings } = await supabase
        .from('patient_visits')
        .select('id')
        .eq('visit_group_id', visit_group_id)
        .neq('id', visitId);
      if (siblings && siblings.length > 0) {
        isLastServiceInGroup = false;
      }
    }

    // 1) حذف الخدمة من patient_visits
    const { error: delErr } = await supabase
      .from('patient_visits')
      .delete()
      .eq('id', visitId);

    if (delErr) {
      return NextResponse.json({ error: 'تعذر حذف الخدمة من السجل.' }, { status: 500 });
    }
    deletedVisitsCount = 1;

    // 2) إذا كانت هي الخدمة الوحيدة في الزيارة، نحذف أيضاً الدور من call_queue
    if (isLastServiceInGroup) {
      let qQuery = supabase.from('call_queue').delete();
      if (visit_group_id) {
        qQuery = qQuery.or(`visit_group_id.eq.${visit_group_id},and(patient_name.eq.${patient_name},clinic_id.eq.${clinic_id})`);
      } else {
        qQuery = qQuery.match({ patient_name, clinic_id });
      }
      const { error: delQueueErr } = await qQuery;
      if (!delQueueErr) {
        deletedQueueCount = 1;
      }
    }

    // 3) حذف المعاملة المالية المقابلة من transactions
    if (patient_name) {
      const visitDateStr = (visit_date || '').slice(0, 10);
      const dateStart = visitDateStr ? `${visitDateStr}T00:00:00` : new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const dateEnd = visitDateStr ? `${visitDateStr}T23:59:59` : new Date().toISOString();

      let txQuery = supabase
        .from('transactions')
        .select('id, amount, clinic_id, description, created_at')
        .eq('type', 'income')
        .ilike('description', `%${patient_name}%`);

      if (clinic_id) {
        txQuery = txQuery.eq('clinic_id', clinic_id);
      }
      if (visitDateStr) {
        txQuery = txQuery.gte('created_at', dateStart).lte('created_at', dateEnd);
      }

      const { data: txRows } = await txQuery;
      if (txRows && txRows.length > 0) {
        // نحدد الحركة أو الحركات المطابقة لمبلغ هذه الخدمة (بما في ذلك التكرار التوأمي)
        let matchingIds: string[] = [];

        if (amountVal > 0) {
          // نبحث عن الحركات المطابقة لمبلغ هذه الخدمة تحديداً
          const exactAmt = txRows.filter((t) => Number(t.amount) === amountVal);
          if (exactAmt.length > 0) {
            matchingIds = exactAmt.map((t) => t.id);
          } else {
            // إن لم تتطابق المبالغ وكانت آخر خدمة، نحذف كل حركات هذا المريض في هذا اليوم
            if (isLastServiceInGroup) {
              matchingIds = txRows.map((t) => t.id);
            }
          }
        } else if (isLastServiceInGroup) {
          matchingIds = txRows.map((t) => t.id);
        }

        if (matchingIds.length > 0) {
          const { error: delTxErr } = await supabase
            .from('transactions')
            .delete()
            .in('id', matchingIds);
          if (!delTxErr) {
            deletedTransactionsCount = matchingIds.length;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      deletedVisits: 1,
      deletedTransactions: deletedTransactionsCount,
      deletedQueue: deletedQueueCount,
      message: `تم حذف الخدمة وخصم ${deletedTransactionsCount > 0 ? `${deletedTransactionsCount} حركة مالية` : 'المعاملة المالية'} من الحسابات بنجاح.`,
    });
  }

  return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 });
}
