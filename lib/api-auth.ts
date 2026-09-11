// ============================================================================
// lib/api-auth.ts
// أداة مشتركة لكل app/api/manager/* routes: بتتحقق من هوية المستخدم من
// الـ JWT اللي العميل بيبعته في هيدر Authorization (Bearer)، وبتتأكد إن
// دوره ضمن الأدوار المسموحة قبل تنفيذ أي استعلام.
//
// ملحوظة مهمة: العميل هنا بيستخدم مفتاح anon العادي (NEXT_PUBLIC_SUPABASE_ANON_KEY)
// نفسه المتاح بالفعل، مش service_role جديد — يعني مفيش سيكريت إضافي لازم
// يتضاف على Vercel. الحماية الحقيقية لسه معتمدة على سياسات RLS في قاعدة
// البيانات (زي ما هي)، وده بس طبقة تحقق إضافية + مكان مركزي للترقيم.
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export type Role = 'manager' | 'doctor' | 'patient' | 'secretary' | 'accountant';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export async function requireRole(request: NextRequest, allowedRoles: Role[]) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return {
      error: NextResponse.json({ error: 'غير مصرح — الرجاء تسجيل الدخول.' }, { status: 401 }),
    } as const;
  }

  // عميل موجّه بتوكن المستخدم نفسه — أي استعلام بعد كده لسه خاضع لسياسات RLS
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return {
      error: NextResponse.json({ error: 'جلسة غير صالحة، الرجاء تسجيل الدخول مرة أخرى.' }, { status: 401 }),
    } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, first_name, last_name')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return {
      error: NextResponse.json({ error: 'تعذر التحقق من صلاحيات الحساب.' }, { status: 403 }),
    } as const;
  }

  if (!allowedRoles.includes(profile.role as Role)) {
    return {
      error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذه البيانات.' }, { status: 403 }),
    } as const;
  }

  return { supabase, profile } as const;
}

// معاملات ترقيم/بحث موحّدة — مقروءة من query string
export function parsePaginationParams(request: NextRequest, defaultPageSize = 10) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || String(defaultPageSize), 10) || defaultPageSize));
  const q = (searchParams.get('q') || '').trim();
  return { page, pageSize, q, from: page * pageSize, to: page * pageSize + pageSize - 1 };
}
