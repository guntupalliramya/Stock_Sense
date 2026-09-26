import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthPage } from '@/pages/AuthPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { ReceiptsPage } from '@/pages/ReceiptsPage';
import { DeliveriesPage } from '@/pages/DeliveriesPage';
import { TransfersPage } from '@/pages/TransfersPage';
import { AdjustmentsPage } from '@/pages/AdjustmentsPage';
import { MoveHistoryPage } from '@/pages/MoveHistoryPage';
import { WarehousesPage } from '@/pages/WarehousesPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { Sidebar, Header } from '@/components/layout/Sidebar';
import { NotificationDrawer } from '@/components/layout/NotificationDrawer';
import { LoadingSpinner } from '@/components/ui/States';

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  receipts: 'Receipts',
  deliveries: 'Delivery Orders',
  adjustments: 'Inventory Adjustments',
  'move-history': 'Move History',
  warehouses: 'Warehouse Settings',
  profile: 'My Profile',
};

function AppContent() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (session) setPage('dashboard');
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner message="Loading StockSense..." />
      </div>
    );
  }

  if (!session) {
    return <AuthPage initialMode="login" />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'products': return <ProductsPage />;
      case 'receipts': return <ReceiptsPage />;
      case 'deliveries': return <DeliveriesPage />;
      case 'transfers': return <TransfersPage />;
      case 'adjustments': return <AdjustmentsPage />;
      case 'move-history': return <MoveHistoryPage />;
      case 'warehouses': return <WarehousesPage />;
      case 'profile': return <ProfilePage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        current={page}
        onNavigate={setPage}
        mobileOpen={mobileSidebar}
        onCloseMobile={() => setMobileSidebar(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={pageTitles[page] ?? 'Dashboard'}
          onOpenSidebar={() => setMobileSidebar(true)}
          onOpenNotifications={() => setNotifOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-7xl animate-slideUp">
            {renderPage()}
          </div>
        </main>
      </div>
      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
