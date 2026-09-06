'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Bell, Check, Trash2, X } from 'lucide-react';

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    
    fetchNotifications();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('notifications_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Dynamic check for upcoming appointments (Patient only)
  useEffect(() => {
    const checkUpcomingAppointments = async () => {
      if (user?.role === 'patient') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = tomorrow.toISOString();
        const now = new Date().toISOString();

        const { data } = await supabase
          .from('appointments')
          .select('*, clinic:clinic_id(name)')
          .eq('patient_id', user.id)
          .gte('appointment_date', now)
          .lte('appointment_date', tomorrowISO)
          .in('status', ['pending', 'confirmed']);

        if (data && data.length > 0) {
          // Add them as dynamic notifications if not already present
          const upcoming = data.map(app => ({
            id: `upcoming-${app.id}`,
            title: 'تذكير بموعد قريب',
            message: `لديك موعد غداً في عيادة ${app.clinic?.name || 'المركز'} الساعة ${new Date(app.appointment_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}.`,
            is_read: false,
            created_at: new Date().toISOString(),
            type: 'appointment_reminder'
          }));

          setNotifications(prev => {
            const newNotifs = [...prev];
            let added = 0;
            upcoming.forEach(u => {
              if (!newNotifs.some(n => n.id === u.id)) {
                newNotifs.unshift(u);
                added++;
              }
            });
            if (added > 0) setUnreadCount(c => c + added);
            return newNotifs;
          });
        }
      }
    };
    checkUpcomingAppointments();
  }, [user]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (data) {
      setNotifications(prev => {
        // preserve dynamic notifications
        const dynamic = prev.filter(p => typeof p.id === 'string' && p.id.startsWith('upcoming-'));
        return [...dynamic, ...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    if (id.startsWith('upcoming-')) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
      
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    }
  };

  const markAllAsRead = async () => {
    const dbIds = notifications.filter(n => !n.is_read && !n.id.startsWith('upcoming-')).map(n => n.id);
    if (dbIds.length > 0) {
      await supabase.from('notifications').update({ is_read: true }).in('id', dbIds);
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id.startsWith('upcoming-')) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      return;
    }
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 bg-white text-gray-700 border rounded-lg shadow-sm hover:bg-gray-50 flex items-center justify-center transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-popover absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden" dir="rtl">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800">الإشعارات</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> تحديد الكل كمقروء
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">جاري التحميل...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">لا توجد إشعارات جديدة</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    onClick={() => !notif.is_read && markAsRead(notif.id)}
                    className={`p-4 transition-colors relative group ${notif.is_read ? 'bg-white text-gray-500' : 'bg-blue-50/50 cursor-pointer text-gray-800'}`}
                  >
                    {!notif.is_read && (
                      <div className="absolute right-2 top-4 w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                    <div className="pr-4">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`text-sm ${notif.is_read ? 'font-medium' : 'font-bold'}`}>{notif.title}</h4>
                        <button 
                          onClick={(e) => deleteNotification(notif.id, e)}
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed opacity-90">{notif.message}</p>
                      <span className="text-[10px] text-gray-400 mt-2 block" dir="ltr">
                        {new Date(notif.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
