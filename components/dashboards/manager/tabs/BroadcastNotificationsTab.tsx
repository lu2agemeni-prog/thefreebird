'use client';

// ============================================================================
// components/dashboards/manager/tabs/BroadcastNotificationsTab.tsx
// تبويب "الإشعارات" — إرسال إشعار إخباري/دعائي لكل المستخدمين، أو الأطباء
// فقط، أو مستخدم معين. بيستخدم دالة broadcast_notification (تتحقق من إن
// المرسل مدير، وتوزّع الإشعار بكفاءة على الوجهة المطلوبة).
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { Megaphone, Send, Loader2, Users, Stethoscope, User, Search, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { supabase } from '@/lib/supabase';
import { getFriendlyErrorMessage } from '@/lib/errors';

type Target = 'all' | 'doctors' | 'user';

interface FoundUser {
  id: string;
  name: string;
  role: string;
}

const TARGET_OPTIONS: { value: Target; label: string; icon: any }[] = [
  { value: 'all', label: 'جميع المستخدمين', icon: Users },
  { value: 'doctors', label: 'الأطباء فقط', icon: Stethoscope },
  { value: 'user', label: 'مستخدم معين', icon: User },
];

function getRoleLabel(role: string) {
  switch (role) {
    case 'manager': return 'مدير';
    case 'doctor': return 'طبيب';
    case 'secretary': return 'سكرتارية';
    case 'accountant': return 'محاسب';
    case 'patient': return 'مريض';
    default: return role;
  }
}

export function BroadcastNotificationsTab() {
  const [target, setTarget] = useState<Target>('all');
  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<FoundUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState<string | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*, target_user:target_user_id(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) setHistoryError(getFriendlyErrorMessage(error, 'تعذر تحميل سجل الإشعارات السابقة.'));
    else setHistory(data || []);
    setHistoryLoading(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = userSearch.trim();
    if (!q) { setUserResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, role')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8);
      setUserResults((data || []).map(u => ({ id: u.id, name: `${u.first_name || ''} ${u.last_name || ''}`.trim(), role: u.role })));
      setSearching(false);
    }, 300);
  }, [userSearch]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    setSendOk(null);

    if (!title.trim()) {
      setSendError('يرجى إدخال عنوان الإشعار.');
      return;
    }
    if (target === 'user' && !selectedUser) {
      setSendError('يرجى اختيار المستخدم المطلوب إرسال الإشعار له.');
      return;
    }

    setSending(true);
    const { data, error } = await supabase.rpc('broadcast_notification', {
      p_target: target,
      p_user_id: target === 'user' ? selectedUser!.id : null,
      p_title: title.trim(),
      p_message: message.trim() || null,
      p_link: link.trim() || null,
    });
    setSending(false);

    if (error) {
      setSendError(getFriendlyErrorMessage(error, 'تعذر إرسال الإشعار.'));
      return;
    }

    setSendOk(`تم إرسال الإشعار بنجاح إلى ${data} مستخدم.`);
    setTitle('');
    setMessage('');
    setLink('');
    setSelectedUser(null);
    setUserSearch('');
    fetchHistory();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-emerald-600" />
            إرسال إشعار جديد
          </CardTitle>
          <CardDescription>إشعار إخباري أو دعائي — بيوصل في التطبيق وكإشعار push على الموبايل (لو مفعّل عند المستخدم).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">إرسال إلى</label>
              <div className="flex flex-wrap gap-2">
                {TARGET_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setTarget(opt.value); setSelectedUser(null); setUserSearch(''); }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                        target === opt.value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {target === 'user' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">اختر المستخدم</label>
                {selectedUser ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <span className="font-bold text-gray-800">{selectedUser.name} <span className="text-xs text-gray-500">({getRoleLabel(selectedUser.role)})</span></span>
                    <button type="button" onClick={() => setSelectedUser(null)} className="text-sm text-red-600 font-bold">تغيير</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="ابحث بالاسم أو رقم الهاتف..."
                      className="w-full pr-9 pl-3 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {searching && <Loader2 className="w-4 h-4 absolute left-3 top-3.5 animate-spin text-gray-400" />}
                    {userResults.length > 0 && (
                      <div className="mt-2 border rounded-xl divide-y overflow-hidden">
                        {userResults.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => { setSelectedUser(u); setUserResults([]); }}
                            className="w-full text-right p-3 hover:bg-emerald-50 transition-colors flex items-center justify-between"
                          >
                            <span className="font-bold text-gray-800">{u.name}</span>
                            <span className="text-xs text-gray-400">{getRoleLabel(u.role)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">عنوان الإشعار</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg p-2.5" placeholder="مثال: عرض خاص هذا الأسبوع" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">نص الإشعار</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full border rounded-lg p-2.5 resize-none" placeholder="تفاصيل الإشعار..." />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">رابط عند الضغط (اختياري)</label>
              <input type="text" value={link} onChange={(e) => setLink(e.target.value)} className="w-full border rounded-lg p-2.5" placeholder="/news أو /prices مثلاً" />
            </div>

            {sendError && <InlineError message={sendError} />}
            {sendOk && (
              <p className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4" /> {sendOk}
              </p>
            )}

            <button type="submit" disabled={sending} className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50">
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              إرسال الإشعار
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل الإشعارات المرسلة</CardTitle>
        </CardHeader>
        <CardContent>
          {historyError && <ErrorState message={historyError} onRetry={fetchHistory} compact />}
          {historyLoading ? (
            <p className="text-gray-500 py-4">جاري التحميل...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 font-semibold text-gray-600">التاريخ</th>
                    <th className="p-3 font-semibold text-gray-600">العنوان</th>
                    <th className="p-3 font-semibold text-gray-600">الوجهة</th>
                    <th className="p-3 font-semibold text-gray-600">عدد المستلمين</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(b => (
                    <tr key={b.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{new Date(b.created_at).toLocaleString('ar-EG')}</td>
                      <td className="p-3 font-bold text-gray-800">{b.title}</td>
                      <td className="p-3">
                        {b.target === 'all' && 'جميع المستخدمين'}
                        {b.target === 'doctors' && 'الأطباء فقط'}
                        {b.target === 'user' && (b.target_user ? `${b.target_user.first_name} ${b.target_user.last_name}` : 'مستخدم معين')}
                      </td>
                      <td className="p-3 font-bold text-emerald-600">{b.recipients_count}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">لا توجد إشعارات مرسلة بعد</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
