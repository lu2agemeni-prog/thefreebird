'use client';

// ============================================================================
// lib/api-client.ts
// نداء fetch بسيط بيرفق access_token بتاع الجلسة الحالية تلقائيًا كهيدر
// Authorization، عشان app/api/manager/* يقدر يتحقق من هوية المستخدم ودوره.
// ============================================================================
import { supabase } from './supabase';

export async function authFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  return fetch(path, { ...options, headers });
}

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
}

export async function authFetchJson<T = any>(path: string, options: RequestInit = {}): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await authFetch(path, options);
    const body = await res.json();
    if (!res.ok) {
      return { data: null, error: body?.error || 'حدث خطأ غير متوقع.' };
    }
    return { data: body, error: null };
  } catch (e) {
    return { data: null, error: 'تعذر الاتصال بالخادم. تحقق من اتصالك ثم أعد المحاولة.' };
  }
}
