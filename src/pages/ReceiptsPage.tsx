import { useEffect, useState, useCallback } from 'react';
import { ArrowDownToLine, Plus, Search, Eye, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input, Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/Badges';
import type { Receipt, ReceiptItem, Supplier, Warehouse, Location, Product } from '@/types';
import type { DocStatus } from '@/types';

interface LineItem {
  product_id: string;
  location_id: string;
  quantity: string;
}

export function ReceiptsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [validateId, setValidateId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplier_id: '',
    warehouse_id: '',
    notes: '',
  });
  const [items, setItems] = useState<LineItem[]>([{ product_id: '', location_id: '', quantity: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    const [recRes, supRes, whRes, locRes, prodRes] = await Promise.all([
      supabase.from('receipts').select('*, supplier:suppliers(*), warehouse:warehouses(*), receipt_items(*, product:products(*), location:locations(*))').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('warehouses').select('*').order('name'),
      supabase.from('locations').select('*, warehouse:warehouses(*)').order('code'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ]);
    setReceipts(recRes.data as Receipt[]);
    setSuppliers(supRes.data as Supplier[]);
    setWarehouses(whRes.data as Warehouse[]);
    setLocations(locRes.data as Location[]);
    setProducts(prodRes.data as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = receipts.filter((r) => {
    if (search && !r.reference.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const openCreate = () => {
    setForm({ supplier_id: '', warehouse_id: '', notes: '' });
    setItems([{ product_id: '', location_id: '', quantity: '' }]);
    setModalOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: '', location_id: '', quantity: '' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, val: string) => {
    setItems(items.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));
  };

  const locsForWh = (whId: string) => locations.filter((l) => l.warehouse_id === whId);

  const handleSave = async (status: DocStatus = 'draft') => {
    if (!form.warehouse_id) { toast('Please select a warehouse', 'error'); return; }
    const validItems = items.filter((i) => i.product_id && i.location_id && Number(i.quantity) > 0);
    if (validItems.length === 0) { toast('Add at least one valid line item', 'error'); return; }

    setSaving(true);
    const ref = `REC-${String(receipts.length + 1).padStart(4, '0')}`;
    const { data: rec, error: recErr } = await supabase
      .from('receipts')
      .insert({
        reference: ref,
        supplier_id: form.supplier_id || null,
        warehouse_id: form.warehouse_id,
        status,
        notes: form.notes.trim(),
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (recErr) {
      toast('Failed to create receipt', 'error');
      setSaving(false);
      return;
    }

    const itemPayload = validItems.map((i) => ({
      receipt_id: rec.id,
      product_id: i.product_id,
      location_id: i.location_id,
      quantity: Number(i.quantity),
    }));
    const { error: itemErr } = await supabase.from('receipt_items').insert(itemPayload);
    if (itemErr) {
      toast('Failed to add items', 'error');
      setSaving(false);
      return;
    }

    if (status === 'done') {
      for (const i of validItems) {
        await supabase.rpc('apply_stock_movement', {
          p_product: i.product_id,
          p_from_loc: null,
          p_to_loc: i.location_id,
          p_qty: Number(i.quantity),
          p_type: 'receipt',
          p_ref: ref,
          p_user: user?.id ?? null,
        });
      }
    }

    toast(status === 'done' ? 'Receipt validated — stock updated' : 'Receipt saved as draft');
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleValidate = async () => {
    if (!validateId) return;
    const rec = receipts.find((r) => r.id === validateId);
    if (!rec) return;
    setValidateId(null);

    for (const item of rec.receipt_items ?? []) {
      const { error } = await supabase.rpc('apply_stock_movement', {
        p_product: item.product_id,
        p_from_loc: null,
        p_to_loc: item.location_id,
        p_qty: Number(item.quantity),
        p_type: 'receipt',
        p_ref: rec.reference,
        p_user: user?.id ?? null,
      });
      if (error) {
        toast(`Failed: ${error.message}`, 'error');
        return;
      }
    }

    await supabase.from('receipts').update({ status: 'done' }).eq('id', rec.id);
    toast('Receipt validated — stock increased');
    load();
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    await supabase.from('receipts').update({ status: 'canceled' }).eq('id', cancelId);
    setCancelId(null);
    toast('Receipt canceled', 'info');
    load();
  };

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
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New Receipt</Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ArrowDownToLine} title="No receipts found" description="Create a receipt to record incoming stock" action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> New Receipt</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{r.reference}</td>
                  <td className="px-4 py-3 text-slate-600">{r.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.warehouse?.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.receipt_items?.length ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewReceipt(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Eye className="h-4 w-4" /></button>
                      {r.status !== 'done' && r.status !== 'canceled' && (
                        <button onClick={() => setValidateId(r.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Validate"><CheckCircle className="h-4 w-4" /></button>
                      )}
                      {r.status !== 'done' && r.status !== 'canceled' && (
                        <button onClick={() => setCancelId(r.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Cancel"><X className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Receipt"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => handleSave('draft')} loading={saving}>Save Draft</Button>
            <Button onClick={() => handleSave('done')} loading={saving}>Validate Receipt</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Supplier">
              <Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Warehouse" required>
              <Select value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
                <option value="">— Select warehouse —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
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
                  <div className="col-span-4">
                    <Select value={item.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)}>
                      <option value="">Product</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Select value={item.location_id} onChange={(e) => updateItem(i, 'location_id', e.target.value)} disabled={!form.warehouse_id}>
                      <option value="">Location</option>
                      {locsForWh(form.warehouse_id).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
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

      {/* View Modal */}
      <Modal open={!!viewReceipt} onClose={() => setViewReceipt(null)} title={`Receipt ${viewReceipt?.reference ?? ''}`} size="lg">
        {viewReceipt && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-400">Supplier</p><p className="text-sm font-medium text-slate-700">{viewReceipt.supplier?.name ?? '—'}</p></div>
              <div><p className="text-xs text-slate-400">Warehouse</p><p className="text-sm font-medium text-slate-700">{viewReceipt.warehouse?.name}</p></div>
              <div><p className="text-xs text-slate-400">Date</p><p className="text-sm text-slate-700">{new Date(viewReceipt.created_at).toLocaleString()}</p></div>
              <div><p className="text-xs text-slate-400">Status</p><StatusBadge status={viewReceipt.status} /></div>
            </div>
            {viewReceipt.notes && <div><p className="text-xs text-slate-400 mb-1">Notes</p><p className="text-sm text-slate-600">{viewReceipt.notes}</p></div>}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Items Received</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Location</th><th className="px-3 py-2 text-right">Quantity</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewReceipt.receipt_items ?? []).map((item: ReceiptItem) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-slate-700">{item.product?.name}</td>
                        <td className="px-3 py-2 text-slate-600">{item.location?.name}</td>
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

      <ConfirmDialog open={!!validateId} title="Validate receipt?" message="This will increase stock for all items in this receipt. This cannot be undone." confirmLabel="Validate" variant="primary" onConfirm={handleValidate} onCancel={() => setValidateId(null)} />
      <ConfirmDialog open={!!cancelId} title="Cancel receipt?" message="This receipt will be marked as canceled." confirmLabel="Cancel Receipt" onConfirm={handleCancel} onCancel={() => setCancelId(null)} />
    </div>
  );
}
