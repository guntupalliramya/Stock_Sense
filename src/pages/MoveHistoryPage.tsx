import { useEffect, useState, useCallback, useMemo } from 'react';
import { History, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input, Select } from '@/components/ui/Field';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import type { StockLedgerEntry } from '@/types';

const PAGE_SIZE = 50;

export function MoveHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<StockLedgerEntry[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stock_ledger')
      .select('*, product:products(*), from_location:locations(*, warehouse:warehouses(*)), to_location:locations(*, warehouse:warehouses(*))')
      .order('created_at', { ascending: false })
      .limit(500);
    setEntries((data as StockLedgerEntry[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = entries;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.product?.name?.toLowerCase().includes(q) ||
        e.product?.sku?.toLowerCase().includes(q) ||
        e.reference?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') list = list.filter((e) => e.transaction_type === typeFilter);
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter);
    if (dateFrom) list = list.filter((e) => new Date(e.created_at) >= new Date(dateFrom));
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      list = list.filter((e) => new Date(e.created_at) <= to);
    }
    return list;
  }, [entries, search, typeFilter, statusFilter, dateFrom, dateTo]);

  const locLabel = (l: StockLedgerEntry['from_location']) => l ? `${l.warehouse?.name} — ${l.name}` : '—';

  const typeColors: Record<string, string> = {
    receipt: 'bg-emerald-50 text-emerald-700',
    delivery: 'bg-red-50 text-red-700',
    transfer: 'bg-blue-50 text-blue-700',
    adjustment: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="relative md:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-10" placeholder="Search product, SKU, or reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="receipt">Receipt</option>
            <option value="delivery">Delivery</option>
            <option value="transfer">Transfer</option>
            <option value="adjustment">Adjustment</option>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="done">Done</option>
            <option value="draft">Draft</option>
            <option value="canceled">Canceled</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={History} title="No transactions found" description="Stock movements will appear here once you start processing receipts, deliveries, transfers, or adjustments" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3 text-right">Prev</th>
                <th className="px-4 py-3 text-right">Updated</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, visible).map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{e.product?.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.product?.sku}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${typeColors[e.transaction_type]}`}>
                      {e.transaction_type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${Number(e.quantity) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Number(e.quantity) >= 0 ? '+' : ''}{e.quantity}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{locLabel(e.from_location)}</td>
                  <td className="px-4 py-3 text-slate-600">{locLabel(e.to_location)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{e.previous_stock}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{e.updated_stock}</td>
                  <td className="px-4 py-3 text-slate-600">{e.reference}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize">{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible < filtered.length && (
            <div className="border-t border-slate-100 p-4 text-center">
              <button
                onClick={() => setVisible(visible + PAGE_SIZE)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Load more ({filtered.length - visible} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
