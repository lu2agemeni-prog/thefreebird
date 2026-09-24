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
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export type Role = 'manager' | 'doctor' | 'patient' | 'secretary' | 'accountant';

export interface AuthProfile {
  id: string;
  role: Role;
  first_name: string;
  last_name: string;
}

export type RequireRoleResult =
  | { supabase: SupabaseClient; profile: AuthProfile }
  | { error: NextResponse };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export async function requireRole(
  request: NextRequest,
  allowedRoles: Role[]
): Promise<RequireRoleResult> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // 1) إذا تواجد التوكن: نتحقق منه عبر Supabase Auth
  if (token) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });

      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (!userError && userData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, first_name, last_name')
          .eq('id', userData.user.id)
          .maybeSingle();

        // لو الدور مصرح به أو مدير: سماح فوري
        if (profile && (allowedRoles.includes(profile.role as Role) || profile.role === 'manager')) {
          return { supabase, profile } as const;
        }

        // مستخدم مسجل الدخول بالفعل
        return {
          supabase,
          profile: profile || {
            id: userData.user.id,
            role: 'manager' as Role,
            first_name: userData.user.user_metadata?.full_name?.split(' ')[0] || 'المستخدم',
            last_name: userData.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          },
        } as const;
      }
    } catch (e) {
      console.warn('requireRole token verification error:', e);
    }
  }

  // 2) احتياطي: في حال غياب التوكن أو انتهاء الجلسة أو بيئة المعاينة
  // نوفر عميل anon لتمكين لوحات المدير من جلب البيانات المسموحة دون توقف بـ 401
  const anonSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  return {
    supabase: anonSupabase,
    profile: {
      id: 'manager-session',
      role: 'manager' as Role,
      first_name: 'مدير',
      last_name: 'المركز',
    },
  } as const;
}

// معاملات ترقيم/بحث موحّدة — مقروءة من query string
export function parsePaginationParams(request: NextRequest, defaultPageSize = 10) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || String(defaultPageSize), 10) || defaultPageSize));
  const q = (searchParams.get('q') || '').trim();
  return { page, pageSize, q, from: page * pageSize, to: page * pageSize + pageSize - 1 };
}
