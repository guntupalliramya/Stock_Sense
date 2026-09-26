import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Package, AlertTriangle, XCircle, ArrowDownToLine, ArrowUpFromLine,
  ArrowLeftRight, Boxes, TrendingDown, Filter,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { StatusBadge, StockStatusBadge, getStockStatus } from '@/components/ui/Badges';
import type { DashboardStats, Product, Category, Warehouse, Notification, StockLedgerEntry, DocStatus } from '@/types';

interface DashboardFilters {
  docType: string;
  status: string;
  warehouse: string;
  category: string;
}

const statusOptions: DocStatus[] = ['draft', 'waiting', 'ready', 'done', 'canceled'];

export function DashboardPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [recentMoves, setRecentMoves] = useState<StockLedgerEntry[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({
    docType: 'all', status: 'all', warehouse: 'all', category: 'all',
  });
  const [filteredDocs, setFilteredDocs] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, prodRes, catRes, whRes, notifRes] = await Promise.all([
        supabase.rpc('dashboard_stats'),
        supabase.from('products').select('*, category:categories(*), stock_levels(*, location:locations(*, warehouse:warehouses(*)))').eq('is_active', true),
        supabase.from('categories').select('*').order('name'),
        supabase.from('warehouses').select('*').order('name'),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      setStats(statsRes.data as DashboardStats);
      setProducts(prodRes.data as Product[]);
      setCategories(catRes.data as Category[]);
      setWarehouses(whRes.data as Warehouse[]);
      setAlerts((notifRes.data as Notification[]) ?? []);

      const { data: ledger } = await supabase
        .from('stock_ledger')
        .select('*, product:products(*), from_location:locations(*), to_location:locations(*)')
        .order('created_at', { ascending: false })
        .limit(20);
      setRecentMoves((ledger as StockLedgerEntry[]) ?? []);
    } catch {
      toast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Load filtered documents when filters change
  useEffect(() => {
    if (filters.docType === 'all' && filters.status === 'all' && filters.warehouse === 'all') {
      setFilteredDocs([]);
      return;
    }
    (async () => {
      const results: any[] = [];
      const statusFilter = filters.status === 'all' ? null : filters.status;

      if (filters.docType === 'all' || filters.docType === 'receipts') {
        let q = supabase.from('receipts').select('*, supplier:suppliers(*), warehouse:warehouses(*)');
        if (statusFilter) q = q.eq('status', statusFilter);
        if (filters.warehouse !== 'all') q = q.eq('warehouse_id', filters.warehouse);
        const { data } = await q.order('created_at', { ascending: false }).limit(50);
        (data ?? []).forEach((r) => results.push({ ...r, _type: 'Receipt' }));
      }
      if (filters.docType === 'all' || filters.docType === 'deliveries') {
        let q = supabase.from('deliveries').select('*, warehouse:warehouses(*)');
        if (statusFilter) q = q.eq('status', statusFilter);
        if (filters.warehouse !== 'all') q = q.eq('warehouse_id', filters.warehouse);
        const { data } = await q.order('created_at', { ascending: false }).limit(50);
        (data ?? []).forEach((r) => results.push({ ...r, _type: 'Delivery' }));
      }
      if (filters.docType === 'all' || filters.docType === 'transfers') {
        let q = supabase.from('transfers').select('*, from_location:locations(*, warehouse:warehouses(*)), to_location:locations(*, warehouse:warehouses(*))');
        if (statusFilter) q = q.eq('status', statusFilter);
        const { data } = await q.order('created_at', { ascending: false }).limit(50);
        (data ?? []).forEach((r) => results.push({ ...r, _type: 'Transfer' }));
      }
      if (filters.docType === 'all' || filters.docType === 'adjustments') {
        let q = supabase.from('adjustments').select('*');
        if (statusFilter) q = q.eq('status', statusFilter);
        const { data } = await q.order('created_at', { ascending: false }).limit(50);
        (data ?? []).forEach((r) => results.push({ ...r, _type: 'Adjustment' }));
      }
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setFilteredDocs(results.slice(0, 50));
    })();
  }, [filters]);

  const productStockMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const total = (p.stock_levels ?? []).reduce((sum, sl) => sum + Number(sl.quantity), 0);
      map.set(p.id, total);
    });
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (filters.category !== 'all') list = list.filter((p) => p.category_id === filters.category);
    return list;
  }, [products, filters.category]);

  const lowStockProducts = useMemo(() => {
    return filteredProducts
      .map((p) => ({ product: p, total: productStockMap.get(p.id) ?? 0 }))
      .filter((item) => item.total <= item.product.reorder_level)
      .sort((a, b) => a.total - b.total);
  }, [filteredProducts, productStockMap]);

  const stockByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredProducts.forEach((p) => {
      const catName = p.category?.name ?? 'Uncategorized';
      const total = productStockMap.get(p.id) ?? 0;
      map.set(catName, (map.get(catName) ?? 0) + total);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredProducts, productStockMap]);

  const stockByWarehouse = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      (p.stock_levels ?? []).forEach((sl) => {
        const whName = sl.location?.warehouse?.name ?? 'Unknown';
        map.set(whName, (map.get(whName) ?? 0) + Number(sl.quantity));
      });
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [products]);

  const incomingVsOutgoing = useMemo(() => {
    const incoming = recentMoves.filter((m) => m.transaction_type === 'receipt').reduce((s, m) => s + Number(m.quantity), 0);
    const outgoing = recentMoves.filter((m) => m.transaction_type === 'delivery').reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
    return { incoming, outgoing };
  }, [recentMoves]);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const kpis = [
    { label: 'Total Products', value: stats?.total_products ?? 0, icon: Package, color: 'blue' },
    { label: 'Low Stock Items', value: stats?.low_stock_count ?? 0, icon: TrendingDown, color: 'amber' },
    { label: 'Out of Stock', value: stats?.out_of_stock_count ?? 0, icon: XCircle, color: 'red' },
    { label: 'Pending Receipts', value: stats?.pending_receipts ?? 0, icon: ArrowDownToLine, color: 'cyan' },
    { label: 'Pending Deliveries', value: stats?.pending_deliveries ?? 0, icon: ArrowUpFromLine, color: 'indigo' },
    { label: 'Transfers Scheduled', value: stats?.pending_transfers ?? 0, icon: ArrowLeftRight, color: 'teal' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    teal: 'bg-teal-50 text-teal-600',
  };

  const maxCategoryValue = Math.max(...stockByCategory.map((d) => d.value), 1);
  const maxWarehouseValue = Math.max(...stockByWarehouse.map((d) => d.value), 1);
  const maxInOut = Math.max(incomingVsOutgoing.incoming, incomingVsOutgoing.outgoing, 1);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
              <div className={`mb-3 inline-flex rounded-lg p-2 ${colorMap[kpi.color]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Dashboard Filters</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Select value={filters.docType} onChange={(e) => setFilters({ ...filters, docType: e.target.value })}>
            <option value="all">All Document Types</option>
            <option value="receipts">Receipts</option>
            <option value="deliveries">Delivery</option>
            <option value="transfers">Internal Transfer</option>
            <option value="adjustments">Adjustments</option>
          </Select>
          <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="all">All Statuses</option>
            {statusOptions.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </Select>
          <Select value={filters.warehouse} onChange={(e) => setFilters({ ...filters, warehouse: e.target.value })}>
            <option value="all">All Warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          <Select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Stock by Category */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Stock by Category</h3>
          {stockByCategory.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No data</p>
          ) : (
            <div className="space-y-3">
              {stockByCategory.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">{item.name}</span>
                    <span className="text-slate-400">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${(item.value / maxCategoryValue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock by Warehouse */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Stock by Warehouse</h3>
          {stockByWarehouse.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No data</p>
          ) : (
            <div className="space-y-3">
              {stockByWarehouse.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">{item.name}</span>
                    <span className="text-slate-400">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-teal-500 transition-all duration-500" style={{ width: `${(item.value / maxWarehouseValue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming vs Outgoing */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Incoming vs Outgoing (Recent)</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium flex items-center gap-1.5">
                  <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-500" /> Incoming
                </span>
                <span className="text-slate-400">{incomingVsOutgoing.incoming}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${(incomingVsOutgoing.incoming / maxInOut) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium flex items-center gap-1.5">
                  <ArrowUpFromLine className="h-3.5 w-3.5 text-red-500" /> Outgoing
                </span>
                <span className="text-slate-400">{incomingVsOutgoing.outgoing}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${(incomingVsOutgoing.outgoing / maxInOut) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Low Stock Products */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-700">Low Stock Products</h3>
          </div>
          {lowStockProducts.length === 0 ? (
            <EmptyState title="All stock levels are healthy" description="No products below reorder level" />
          ) : (
            <div className="space-y-2">
              {lowStockProducts.slice(0, 8).map(({ product, total }) => (
                <div key={product.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                    <p className="text-xs text-slate-400">{product.sku}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-700">{total}</p>
                      <p className="text-[10px] text-slate-400">Reorder: {product.reorder_level}</p>
                    </div>
                    <StockStatusBadge status={getStockStatus(total, product.reorder_level)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Recent Stock Movements</h3>
          {recentMoves.length === 0 ? (
            <EmptyState title="No movements yet" />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentMoves.slice(0, 10).map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.product?.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{m.transaction_type} • {m.reference}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-semibold ${Number(m.quantity) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {Number(m.quantity) >= 0 ? '+' : ''}{m.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filtered Documents Table */}
      {filteredDocs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Filtered Documents</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4 font-semibold">Reference</th>
                  <th className="pb-2 pr-4 font-semibold">Type</th>
                  <th className="pb-2 pr-4 font-semibold">Date</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.map((doc) => (
                  <tr key={`${doc._type}-${doc.id}`} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-medium text-slate-700">{doc.reference}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{doc._type}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{new Date(doc.created_at).toLocaleDateString()}</td>
                    <td className="py-2.5 pr-4"><StatusBadge status={doc.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
