import { useEffect, useState, useCallback } from 'react';
import { ArrowUpFromLine, Plus, Search, Eye, CheckCircle, X, PackageCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input, Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/Badges';
import type { Delivery, DeliveryItem, Warehouse, Location, Product } from '@/types';
import type { DocStatus } from '@/types';

interface LineItem {
  product_id: string;
  location_id: string;
  quantity: string;
}

export function DeliveriesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewDelivery, setViewDelivery] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);
  const [validateId, setValidateId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const [form, setForm] = useState({ customer_name: '', warehouse_id: '', notes: '' });
  const [items, setItems] = useState<LineItem[]>([{ product_id: '', location_id: '', quantity: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    const [delRes, whRes, locRes, prodRes] = await Promise.all([
      supabase.from('deliveries').select('*, warehouse:warehouses(*), delivery_items(*, product:products(*), location:locations(*))').order('created_at', { ascending: false }),
      supabase.from('warehouses').select('*').order('name'),
      supabase.from('locations').select('*, warehouse:warehouses(*)').order('code'),
      supabase.from('products').select('*, stock_levels(*, location:locations(*))').eq('is_active', true).order('name'),
    ]);
    setDeliveries(delRes.data as Delivery[]);
    setWarehouses(whRes.data as Warehouse[]);
    setLocations(locRes.data as Location[]);
    setProducts(prodRes.data as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = deliveries.filter((d) => {
    if (search && !d.reference.toLowerCase().includes(search.toLowerCase()) && !d.customer_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

  const openCreate = () => {
    setForm({ customer_name: '', warehouse_id: '', notes: '' });
    setItems([{ product_id: '', location_id: '', quantity: '' }]);
    setModalOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: '', location_id: '', quantity: '' }]);
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
    if (!form.warehouse_id) { toast('Please select a warehouse', 'error'); return; }
    if (!form.customer_name.trim()) { toast('Customer name is required', 'error'); return; }
    const validItems = items.filter((i) => i.product_id && i.location_id && Number(i.quantity) > 0);
    if (validItems.length === 0) { toast('Add at least one valid line item', 'error'); return; }

    if (status === 'done') {
      for (const i of validItems) {
        const available = getStockAtLoc(i.product_id, i.location_id);
        if (Number(i.quantity) > available) {
          const p = products.find((pr) => pr.id === i.product_id);
          toast(`Insufficient stock for ${p?.name}. Available: ${available}, Requested: ${i.quantity}`, 'error');
          return;
        }
      }
    }

    setSaving(true);
    const ref = `DEL-${String(deliveries.length + 1).padStart(4, '0')}`;
    const { data: del, error: delErr } = await supabase
      .from('deliveries')
      .insert({
        reference: ref,
        customer_name: form.customer_name.trim(),
        warehouse_id: form.warehouse_id,
        status,
        notes: form.notes.trim(),
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (delErr) { toast('Failed to create delivery', 'error'); setSaving(false); return; }

    const itemPayload = validItems.map((i) => ({
      delivery_id: del.id,
      product_id: i.product_id,
      location_id: i.location_id,
      quantity: Number(i.quantity),
      picked: status === 'done',
      packed: status === 'done',
    }));
    const { error: itemErr } = await supabase.from('delivery_items').insert(itemPayload);
    if (itemErr) { toast('Failed to add items', 'error'); setSaving(false); return; }

    if (status === 'done') {
      for (const i of validItems) {
        const { error } = await supabase.rpc('apply_stock_movement', {
          p_product: i.product_id,
          p_from_loc: i.location_id,
          p_to_loc: null,
          p_qty: Number(i.quantity),
          p_type: 'delivery',
          p_ref: ref,
          p_user: user?.id ?? null,
        });
        if (error) { toast(`Stock error: ${error.message}`, 'error'); setSaving(false); return; }
      }
    }

    toast(status === 'done' ? 'Delivery validated — stock decreased' : 'Delivery saved as draft');
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleValidate = async () => {
    if (!validateId) return;
    const del = deliveries.find((d) => d.id === validateId);
    if (!del) return;
    setValidateId(null);

    for (const item of del.delivery_items ?? []) {
      const { data: ok } = await supabase.rpc('check_stock_available', {
        p_product: item.product_id,
        p_location: item.location_id,
        p_qty: Number(item.quantity),
      });
      if (!ok) {
        toast(`Insufficient stock for ${item.product?.name} at ${item.location?.name}`, 'error');
        return;
      }
    }

    for (const item of del.delivery_items ?? []) {
      const { error } = await supabase.rpc('apply_stock_movement', {
        p_product: item.product_id,
        p_from_loc: item.location_id,
        p_to_loc: null,
        p_qty: Number(item.quantity),
        p_type: 'delivery',
        p_ref: del.reference,
        p_user: user?.id ?? null,
      });
      if (error) { toast(`Stock error: ${error.message}`, 'error'); return; }
    }

    await supabase.from('delivery_items').update({ picked: true, packed: true }).eq('delivery_id', del.id);
    await supabase.from('deliveries').update({ status: 'done' }).eq('id', del.id);
    toast('Delivery validated — stock decreased');
    load();
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    await supabase.from('deliveries').update({ status: 'canceled' }).eq('id', cancelId);
    setCancelId(null);
    toast('Delivery canceled', 'info');
    load();
  };

  const locsForWh = (whId: string) => locations.filter((l) => l.warehouse_id === whId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-10" placeholder="Search by reference or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New Delivery</Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ArrowUpFromLine} title="No deliveries found" description="Create a delivery order to record outgoing stock" action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> New Delivery</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{d.reference}</td>
                  <td className="px-4 py-3 text-slate-600">{d.customer_name}</td>
                  <td className="px-4 py-3 text-slate-600">{d.warehouse?.name}</td>
                  <td className="px-4 py-3 text-slate-600">{d.delivery_items?.length ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewDelivery(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Eye className="h-4 w-4" /></button>
                      {d.status !== 'done' && d.status !== 'canceled' && (
                        <button onClick={() => setValidateId(d.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Validate"><CheckCircle className="h-4 w-4" /></button>
                      )}
                      {d.status !== 'done' && d.status !== 'canceled' && (
                        <button onClick={() => setCancelId(d.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Cancel"><X className="h-4 w-4" /></button>
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
        title="New Delivery Order"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => handleSave('draft')} loading={saving}>Save Draft</Button>
            <Button onClick={() => handleSave('done')} loading={saving}>Validate Delivery</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Customer / Destination" required>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="e.g. Acme Corp" />
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
                    {item.product_id && item.location_id && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Available: {getStockAtLoc(item.product_id, item.location_id)}</p>
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

      <Modal open={!!viewDelivery} onClose={() => setViewDelivery(null)} title={`Delivery ${viewDelivery?.reference ?? ''}`} size="lg">
        {viewDelivery && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-400">Customer</p><p className="text-sm font-medium text-slate-700">{viewDelivery.customer_name}</p></div>
              <div><p className="text-xs text-slate-400">Warehouse</p><p className="text-sm font-medium text-slate-700">{viewDelivery.warehouse?.name}</p></div>
              <div><p className="text-xs text-slate-400">Date</p><p className="text-sm text-slate-700">{new Date(viewDelivery.created_at).toLocaleString()}</p></div>
              <div><p className="text-xs text-slate-400">Status</p><StatusBadge status={viewDelivery.status} /></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Items</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Location</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-center">Picked</th><th className="px-3 py-2 text-center">Packed</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewDelivery.delivery_items ?? []).map((item: DeliveryItem) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-slate-700">{item.product?.name}</td>
                        <td className="px-3 py-2 text-slate-600">{item.location?.name}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-700">{item.quantity}</td>
                        <td className="px-3 py-2 text-center">{item.picked ? <PackageCheck className="h-4 w-4 text-emerald-500 inline" /> : <X className="h-4 w-4 text-slate-300 inline" />}</td>
                        <td className="px-3 py-2 text-center">{item.packed ? <PackageCheck className="h-4 w-4 text-emerald-500 inline" /> : <X className="h-4 w-4 text-slate-300 inline" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!validateId} title="Validate delivery?" message="This will decrease stock for all items. Stock cannot go below zero." confirmLabel="Validate" variant="primary" onConfirm={handleValidate} onCancel={() => setValidateId(null)} />
      <ConfirmDialog open={!!cancelId} title="Cancel delivery?" message="This delivery will be marked as canceled." confirmLabel="Cancel Delivery" onConfirm={handleCancel} onCancel={() => setCancelId(null)} />
    </div>
  );
}
