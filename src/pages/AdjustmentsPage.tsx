import { useEffect, useState, useCallback } from 'react';
import { SlidersHorizontal, Plus, Search, Eye, CheckCircle, X, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input, Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/Badges';
import type { Adjustment, AdjustmentItem, Location, Product } from '@/types';
import type { DocStatus } from '@/types';

interface LineItem {
  product_id: string;
  location_id: string;
  recorded_qty: string;
  counted_qty: string;
}

export function AdjustmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewAdj, setViewAdj] = useState<Adjustment | null>(null);
  const [saving, setSaving] = useState(false);
  const [validateId, setValidateId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const [form, setForm] = useState({ notes: '' });
  const [items, setItems] = useState<LineItem[]>([{ product_id: '', location_id: '', recorded_qty: '0', counted_qty: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    const [adjRes, locRes, prodRes] = await Promise.all([
      supabase.from('adjustments').select('*, adjustment_items(*, product:products(*), location:locations(*, warehouse:warehouses(*)))').order('created_at', { ascending: false }),
      supabase.from('locations').select('*, warehouse:warehouses(*)').order('code'),
      supabase.from('products').select('*, stock_levels(*, location:locations(*))').eq('is_active', true).order('name'),
    ]);
    setAdjustments(adjRes.data as Adjustment[]);
    setLocations(locRes.data as Location[]);
    setProducts(prodRes.data as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = adjustments.filter((a) => {
    if (search && !a.reference.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  const openCreate = () => {
    setForm({ notes: '' });
    setItems([{ product_id: '', location_id: '', recorded_qty: '0', counted_qty: '' }]);
    setModalOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: '', location_id: '', recorded_qty: '0', counted_qty: '' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, val: string) => {
    setItems(items.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));
  };

  const fetchRecordedQty = async (productId: string, locId: string, i: number) => {
    const { data } = await supabase
      .from('stock_levels')
      .select('quantity')
      .eq('product_id', productId)
      .eq('location_id', locId)
      .maybeSingle();
    updateItem(i, 'recorded_qty', String(data?.quantity ?? 0));
  };

  const handleProductOrLocChange = (i: number, field: 'product_id' | 'location_id', val: string) => {
    const newItems = items.map((item, idx) => (idx === i ? { ...item, [field]: val } : item));
    setItems(newItems);
    if (newItems[i].product_id && newItems[i].location_id) {
      fetchRecordedQty(newItems[i].product_id, newItems[i].location_id, i);
    }
  };

  const handleSave = async (status: DocStatus = 'draft') => {
    const validItems = items.filter((i) => i.product_id && i.location_id && i.counted_qty !== '');
    if (validItems.length === 0) { toast('Add at least one valid line item', 'error'); return; }

    for (const i of validItems) {
      if (Number(i.counted_qty) < 0) { toast('Counted quantity cannot be negative', 'error'); return; }
    }

    setSaving(true);
    const ref = `ADJ-${String(adjustments.length + 1).padStart(4, '0')}`;
    const { data: adj, error: adjErr } = await supabase
      .from('adjustments')
      .insert({
        reference: ref,
        status,
        notes: form.notes.trim(),
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (adjErr) { toast('Failed to create adjustment', 'error'); setSaving(false); return; }

    const itemPayload = validItems.map((i) => ({
      adjustment_id: adj.id,
      product_id: i.product_id,
      location_id: i.location_id,
      recorded_qty: Number(i.recorded_qty),
      counted_qty: Number(i.counted_qty),
    }));
    const { error: itemErr } = await supabase.from('adjustment_items').insert(itemPayload);
    if (itemErr) { toast('Failed to add items', 'error'); setSaving(false); return; }

    if (status === 'done') {
      for (const i of validItems) {
        const recorded = Number(i.recorded_qty);
        const counted = Number(i.counted_qty);
        const diff = counted - recorded;
        if (diff === 0) continue;

        const currentQty = await supabase
          .from('stock_levels')
          .select('quantity')
          .eq('product_id', i.product_id)
          .eq('location_id', i.location_id)
          .maybeSingle();

        const prevStock = currentQty.data?.quantity ? Number(currentQty.data.quantity) : 0;
        const newStock = counted;

        await supabase.from('stock_levels')
          .upsert({ product_id: i.product_id, location_id: i.location_id, quantity: newStock, updated_at: new Date().toISOString() }, { onConflict: 'product_id,location_id' });

        await supabase.from('stock_ledger').insert({
          product_id: i.product_id,
          transaction_type: 'adjustment',
          quantity: diff,
          from_location_id: i.location_id,
          to_location_id: i.location_id,
          previous_stock: prevStock,
          updated_stock: newStock,
          user_id: user?.id ?? null,
          reference: ref,
          status: 'done',
        });
      }
    }

    toast(status === 'done' ? 'Adjustment confirmed — stock updated' : 'Adjustment saved as draft');
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleValidate = async () => {
    if (!validateId) return;
    const adj = adjustments.find((a) => a.id === validateId);
    if (!adj) return;
    setValidateId(null);

    for (const item of adj.adjustment_items ?? []) {
      const diff = Number(item.counted_qty) - Number(item.recorded_qty);
      if (diff === 0) continue;

      const { data: sl } = await supabase
        .from('stock_levels')
        .select('quantity')
        .eq('product_id', item.product_id)
        .eq('location_id', item.location_id)
        .maybeSingle();

      const prevStock = sl?.quantity ? Number(sl.quantity) : 0;
      const newStock = Number(item.counted_qty);

      await supabase.from('stock_levels')
        .upsert({ product_id: item.product_id, location_id: item.location_id, quantity: newStock, updated_at: new Date().toISOString() }, { onConflict: 'product_id,location_id' });

      await supabase.from('stock_ledger').insert({
        product_id: item.product_id,
        transaction_type: 'adjustment',
        quantity: diff,
        from_location_id: item.location_id,
        to_location_id: item.location_id,
        previous_stock: prevStock,
        updated_stock: newStock,
        user_id: user?.id ?? null,
        reference: adj.reference,
        status: 'done',
      });
    }

    await supabase.from('adjustments').update({ status: 'done' }).eq('id', adj.id);
    toast('Adjustment confirmed — stock updated');
    load();
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    await supabase.from('adjustments').update({ status: 'canceled' }).eq('id', cancelId);
    setCancelId(null);
    toast('Adjustment canceled', 'info');
    load();
  };

  const locLabel = (l: Location | undefined) => l ? `${l.warehouse?.name} — ${l.name}` : '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-10" placeholder="Search by reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[160px]">
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="waiting">Waiting</option>
            <option value="ready">Ready</option>
            <option value="done">Done</option>
            <option value="canceled">Canceled</option>
          </Select>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New Adjustment</Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={SlidersHorizontal} title="No adjustments found" description="Create an adjustment to reconcile physical stock counts" action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> New Adjustment</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{a.reference}</td>
                  <td className="px-4 py-3 text-slate-600">{a.adjustment_items?.length ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewAdj(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Eye className="h-4 w-4" /></button>
                      {a.status !== 'done' && a.status !== 'canceled' && (
                        <button onClick={() => setValidateId(a.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Confirm"><CheckCircle className="h-4 w-4" /></button>
                      )}
                      {a.status !== 'done' && a.status !== 'canceled' && (
                        <button onClick={() => setCancelId(a.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Cancel"><X className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Inventory Adjustment"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => handleSave('draft')} loading={saving}>Save Draft</Button>
            <Button onClick={() => handleSave('done')} loading={saving}>Confirm Adjustment</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-700">Line Items</h4>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Add Item</Button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => {
                const diff = Number(item.counted_qty || 0) - Number(item.recorded_qty || 0);
                return (
                  <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-5">
                        <Select value={item.product_id} onChange={(e) => handleProductOrLocChange(i, 'product_id', e.target.value)}>
                          <option value="">Product</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </Select>
                      </div>
                      <div className="col-span-5">
                        <Select value={item.location_id} onChange={(e) => handleProductOrLocChange(i, 'location_id', e.target.value)}>
                          <option value="">Location</option>
                          {locations.map((l) => <option key={l.id} value={l.id}>{l.warehouse?.name} — {l.name}</option>)}
                        </Select>
                      </div>
                      <div className="col-span-2 flex justify-end pt-1">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-500">Recorded Qty</label>
                        <Input type="number" value={item.recorded_qty} disabled className="bg-slate-50" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Counted Qty</label>
                        <Input type="number" min="0" placeholder="0" value={item.counted_qty} onChange={(e) => updateItem(i, 'counted_qty', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Difference</label>
                        <div className={`flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {diff > 0 && <ArrowUp className="h-3.5 w-3.5" />}
                          {diff < 0 && <ArrowDown className="h-3.5 w-3.5" />}
                          {diff > 0 ? '+' : ''}{diff}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes about this adjustment" />
          </Field>
        </div>
      </Modal>

      <Modal open={!!viewAdj} onClose={() => setViewAdj(null)} title={`Adjustment ${viewAdj?.reference ?? ''}`} size="lg">
        {viewAdj && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-400">Date</p><p className="text-sm text-slate-700">{new Date(viewAdj.created_at).toLocaleString()}</p></div>
              <div><p className="text-xs text-slate-400">Status</p><StatusBadge status={viewAdj.status} /></div>
            </div>
            {viewAdj.notes && <div><p className="text-xs text-slate-400 mb-1">Notes</p><p className="text-sm text-slate-600">{viewAdj.notes}</p></div>}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Items</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2 text-right">Recorded</th>
                      <th className="px-3 py-2 text-right">Counted</th>
                      <th className="px-3 py-2 text-right">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewAdj.adjustment_items ?? []).map((item: AdjustmentItem) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-slate-700">{item.product?.name}</td>
                        <td className="px-3 py-2 text-slate-600">{locLabel(item.location)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{item.recorded_qty}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-700">{item.counted_qty}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${Number(item.difference) > 0 ? 'text-emerald-600' : Number(item.difference) < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {Number(item.difference) > 0 ? '+' : ''}{item.difference}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!validateId} title="Confirm adjustment?" message="This will update stock to match the counted quantities. This cannot be undone." confirmLabel="Confirm" variant="primary" onConfirm={handleValidate} onCancel={() => setValidateId(null)} />
      <ConfirmDialog open={!!cancelId} title="Cancel adjustment?" message="This adjustment will be marked as canceled." confirmLabel="Cancel Adjustment" onConfirm={handleCancel} onCancel={() => setCancelId(null)} />
    </div>
  );
}
