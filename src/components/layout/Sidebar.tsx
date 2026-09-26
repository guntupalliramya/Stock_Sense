import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  History,
  Warehouse,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Boxes,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/contexts/ToastContext';

interface SidebarProps {
  current: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
];

const operationsGroup = [
  { id: 'receipts', label: 'Receipts', icon: ArrowDownToLine },
  { id: 'deliveries', label: 'Delivery Orders', icon: ArrowUpFromLine },
  { id: 'adjustments', label: 'Inventory Adjustments', icon: SlidersHorizontal },
  { id: 'move-history', label: 'Move History', icon: History },
];

const settingsGroup = [
  { id: 'warehouses', label: 'Warehouse', icon: Warehouse },
];

const bottomNav = [
  { id: 'profile', label: 'My Profile', icon: User },
];

export function Sidebar({ current, onNavigate, mobileOpen, onCloseMobile }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const [opsOpen, setOpsOpen] = useState(
    operationsGroup.some((o) => o.id === current)
  );
  const [settingsOpen, setSettingsOpen] = useState(
    settingsGroup.some((s) => s.id === current)
  );
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleNav = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  const handleLogout = async () => {
    await signOut();
    setConfirmLogout(false);
    toast('You have been logged out', 'info');
  };

  const NavItem = ({ item }: { item: { id: string; label: string; icon: React.ComponentType<{ className?: string }> } }) => {
    const Icon = item.icon;
    const active = current === item.id;
    return (
      <button
        onClick={() => handleNav(item.id)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          active
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] ${active ? 'text-blue-600' : 'text-slate-400'}`} />
        {item.label}
      </button>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 leading-tight">StockSense</p>
              <p className="text-[10px] text-slate-400 leading-tight">Inventory Management</p>
            </div>
            <button onClick={onCloseMobile} className="ml-auto lg:hidden text-slate-400">
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {nav.map((item) => <NavItem key={item.id} item={item} />)}

            <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Operations
            </div>
            <button
              onClick={() => setOpsOpen(!opsOpen)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <ArrowDownToLine className="h-[18px] w-[18px] text-slate-400" />
              Operations
              <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${opsOpen ? 'rotate-180' : ''}`} />
            </button>
            {opsOpen && (
              <div className="ml-3 space-y-1 border-l border-slate-200 pl-3">
                {operationsGroup.map((item) => <NavItem key={item.id} item={item} />)}
              </div>
            )}

            <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Settings
            </div>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <Warehouse className="h-[18px] w-[18px] text-slate-400" />
              Settings
              <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
            </button>
            {settingsOpen && (
              <div className="ml-3 space-y-1 border-l border-slate-200 pl-3">
                {settingsGroup.map((item) => <NavItem key={item.id} item={item} />)}
              </div>
            )}

            <div className="pt-4">
              {bottomNav.map((item) => <NavItem key={item.id} item={item} />)}
            </div>
          </nav>

          <div className="border-t border-slate-200 p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                {profile?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-700">{profile?.full_name || 'User'}</p>
                <p className="truncate text-xs text-slate-400 capitalize">{profile?.role?.replace('_', ' ') || ''}</p>
              </div>
              <button
                onClick={() => setConfirmLogout(true)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                title="Logout"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="You will need to sign in again to access your inventory."
        confirmLabel="Log out"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </>
  );
}

export function Header({ title, onOpenSidebar, onOpenNotifications }: { title: string; onOpenSidebar: () => void; onOpenNotifications: () => void }) {
  const { profile } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-sm lg:px-6">
      <button onClick={onOpenSidebar} className="lg:hidden text-slate-500">
        <Menu className="h-6 w-6" />
      </button>
      <h1 className="text-lg font-semibold text-slate-900 lg:text-xl">{title}</h1>
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={onOpenNotifications}
          className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {profile?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700 leading-tight">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-slate-400 capitalize leading-tight">{profile?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
