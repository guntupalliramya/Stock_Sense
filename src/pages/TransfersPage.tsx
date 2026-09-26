import { useEffect, useState, useCallback } from 'react';
import { ArrowLeftRight, Plus, Search, Eye, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input, Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/Badges';
import type { Transfer, TransferItem, Location, Product, Warehouse } from '@/types';
import type { DocStatus } from '@/types';

interface LineItem {
  product_id: string;
  quantity: string;
}

export function TransfersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTransfer, setViewTransfer] = useState<Transfer | null>(null);
  const [saving, setSaving] = useState(false);
  const [validateId, setValidateId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const [form, setForm] = useState({ from_location_id: '', to_location_id: '', notes: '' });
  const [items, setItems] = useState<LineItem[]>([{ product_id: '', quantity: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    const [trRes, locRes, prodRes] = await Promise.all([
      supabase.from('transfers').select('*, from_location:locations(*, warehouse:warehouses(*)), to_location:locations(*, warehouse:warehouses(*)), transfer_items(*, product:products(*))').order('created_at', { ascending: false }),
      supabase.from('locations').select('*, warehouse:warehouses(*)').order('code'),
      supabase.from('products').select('*, stock_levels(*, location:locations(*))').eq('is_active', true).order('name'),
    ]);
    setTransfers(trRes.data as Transfer[]);
    setLocations(locRes.data as Location[]);
    setProducts(prodRes.data as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = transfers.filter((t) => {
    if (search && !t.reference.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  const openCreate = () => {
    setForm({ from_location_id: '', to_location_id: '', notes: '' });
    setItems([{ product_id: '', quantity: '' }]);
    setModalOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: '', quantity: '' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, val: string) => {
    setItems(items.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));
  };

  const getStockAtLoc = (productId: string, locId: string): number => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return 0;
    const sl = (p.stock_levels ?? []).find((s) => s.location_id === locId);
    return sl ? Number(sl.quantity) : 0;
  };

  const handleSave = async (status: DocStatus = 'draft') => {
    if (!form.from_location_id) { toast('Select source location', 'error'); return; }
    if (!form.to_location_id) { toast('Select destination location', 'error'); return; }
    if (form.from_location_id === form.to_location_id) { toast('Source and destination must differ', 'error'); return; }
    const validItems = items.filter((i) => i.product_id && Number(i.quantity) > 0);
    if (validItems.length === 0) { toast('Add at least one valid line item', 'error'); return; }

    if (status === 'done') {
      for (const i of validItems) {
        const available = getStockAtLoc(i.product_id, form.from_location_id);
        if (Number(i.quantity) > available) {
          const p = products.find((pr) => pr.id === i.product_id);
          toast(`Insufficient stock for ${p?.name}. Available: ${available}, Required: ${i.quantity}`, 'error');
          return;
        }
      }
    }

    setSaving(true);
    const ref = `TRF-${String(transfers.length + 1).padStart(4, '0')}`;
    const { data: tr, error: trErr } = await supabase
      .from('transfers')
      .insert({
        reference: ref,
        from_location_id: form.from_location_id,
        to_location_id: form.to_location_id,
        status,
        notes: form.notes.trim(),
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (trErr) { toast('Failed to create transfer', 'error'); setSaving(false); return; }

    const itemPayload = validItems.map((i) => ({
      transfer_id: tr.id,
      product_id: i.product_id,
      quantity: Number(i.quantity),
    }));
    const { error: itemErr } = await supabase.from('transfer_items').insert(itemPayload);
    if (itemErr) { toast('Failed to add items', 'error'); setSaving(false); return; }

    if (status === 'done') {
      for (const i of validItems) {
        const { error } = await supabase.rpc('apply_stock_movement', {
          p_product: i.product_id,
          p_from_loc: form.from_location_id,
          p_to_loc: form.to_location_id,
          p_qty: Number(i.quantity),
          p_type: 'transfer',
          p_ref: ref,
          p_user: user?.id ?? null,
        });
        if (error) { toast(`Stock error: ${error.message}`, 'error'); setSaving(false); return; }
      }
    }

    toast(status === 'done' ? 'Transfer validated — stock moved' : 'Transfer saved as draft');
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleValidate = async () => {
    if (!validateId) return;
    const tr = transfers.find((t) => t.id === validateId);
    if (!tr) return;
    setValidateId(null);

    for (const item of tr.transfer_items ?? []) {
      const { data: ok } = await supabase.rpc('check_stock_available', {
        p_product: item.product_id,
        p_location: tr.from_location_id,
        p_qty: Number(item.quantity),
      });
      if (!ok) {
        toast(`Insufficient stock for ${item.product?.name} at source location`, 'error');
        return;
      }
    }

    for (const item of tr.transfer_items ?? []) {
      const { error } = await supabase.rpc('apply_stock_movement', {
        p_product: item.product_id,
        p_from_loc: tr.from_location_id,
        p_to_loc: tr.to_location_id,
        p_qty: Number(item.quantity),
        p_type: 'transfer',
        p_ref: tr.reference,
        p_user: user?.id ?? null,
      });
      if (error) { toast(`Stock error: ${error.message}`, 'error'); return; }
    }

    await supabase.from('transfers').update({ status: 'done' }).eq('id', tr.id);
    toast('Transfer validated — stock moved between locations');
    load();
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    await supabase.from('transfers').update({ status: 'canceled' }).eq('id', cancelId);
    setCancelId(null);
    toast('Transfer canceled', 'info');
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
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New Transfer</Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No transfers found" description="Create a transfer to move stock between locations" action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> New Transfer</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{t.reference}</td>
                  <td className="px-4 py-3 text-slate-600">{locLabel(t.from_location)}</td>
                  <td className="px-4 py-3 text-slate-600">{locLabel(t.to_location)}</td>
                  <td className="px-4 py-3 text-slate-600">{t.transfer_items?.length ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewTransfer(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Eye className="h-4 w-4" /></button>
                      {t.status !== 'done' && t.status !== 'canceled' && (
                        <button onClick={() => setValidateId(t.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Validate"><CheckCircle className="h-4 w-4" /></button>
                      )}
                      {t.status !== 'done' && t.status !== 'canceled' && (
                        <button onClick={() => setCancelId(t.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Cancel"><X className="h-4 w-4" /></button>
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
        title="New Internal Transfer"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => handleSave('draft')} loading={saving}>Save Draft</Button>
            <Button onClick={() => handleSave('done')} loading={saving}>Validate Transfer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="From Location" required>
              <Select value={form.from_location_id} onChange={(e) => setForm({ ...form, from_location_id: e.target.value })}>
                <option value="">— Select source —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.warehouse?.name} — {l.name} ({l.code})</option>)}
              </Select>
            </Field>
            <Field label="To Location" required>
              <Select value={form.to_location_id} onChange={(e) => setForm({ ...form, to_location_id: e.target.value })}>
                <option value="">— Select destination —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.warehouse?.name} — {l.name} ({l.code})</option>)}
              </Select>
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-700">Line Items</h4>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Add Item</Button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-7">
                    <Select value={item.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)}>
                      <option value="">Product</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
                    {item.product_id && form.from_location_id && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Available: {getStockAtLoc(item.product_id, form.from_location_id)}</p>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end pt-1">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
          </Field>
        </div>
      </Modal>

      <Modal open={!!viewTransfer} onClose={() => setViewTransfer(null)} title={`Transfer ${viewTransfer?.reference ?? ''}`} size="lg">
        {viewTransfer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-400">From</p><p className="text-sm font-medium text-slate-700">{locLabel(viewTransfer.from_location)}</p></div>
              <div><p className="text-xs text-slate-400">To</p><p className="text-sm font-medium text-slate-700">{locLabel(viewTransfer.to_location)}</p></div>
              <div><p className="text-xs text-slate-400">Date</p><p className="text-sm text-slate-700">{new Date(viewTransfer.created_at).toLocaleString()}</p></div>
              <div><p className="text-xs text-slate-400">Status</p><StatusBadge status={viewTransfer.status} /></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Items</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Quantity</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewTransfer.transfer_items ?? []).map((item: TransferItem) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-slate-700">{item.product?.name}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-700">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!validateId} title="Validate transfer?" message="This will move stock from source to destination location." confirmLabel="Validate" variant="primary" onConfirm={handleValidate} onCancel={() => setValidateId(null)} />
      <ConfirmDialog open={!!cancelId} title="Cancel transfer?" message="This transfer will be marked as canceled." confirmLabel="Cancel Transfer" onConfirm={handleCancel} onCancel={() => setCancelId(null)} />
    </div>
  );
}
