import { useEffect, useState } from 'react';
import { X, Bell, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import type { Notification } from '@/types';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

const severityConfig = {
  error: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' },
};

export function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setNotifications((data as Notification[]) ?? []);
        setLoading(false);
      });
  }, [open]);

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications((n) => n.map((item) => ({ ...item, is_read: true })));
    toast('All notifications marked as read');
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-slate-900/30" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm transform bg-white shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
              {notifications.some((n) => !n.is_read) && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                  {notifications.filter((n) => !n.is_read).length} new
                </span>
              )}
            </div>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          {notifications.length > 0 && (
            <div className="border-b border-slate-100 px-5 py-2">
              <button onClick={markAllRead} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                Mark all as read
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="space-y-3 p-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-300" />
                <p className="mt-3 text-sm text-slate-500">No notifications</p>
                <p className="text-xs text-slate-400">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const config = severityConfig[n.severity];
                const Icon = config.icon;
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 rounded-lg border p-3 ${n.is_read ? 'border-slate-100 bg-white' : 'border-blue-100 bg-blue-50/30'}`}
                  >
                    <div className={`shrink-0 rounded-lg p-2 ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{n.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
