import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Package, Plus, Search, Edit2, Trash2, Eye, Tag, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input, Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable } from '@/components/ui/DataTable';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import { StockStatusBadge, getStockStatus } from '@/components/ui/Badges';
import type { Product, Category, Warehouse, Location, StockLevel } from '@/types';

interface ProductFormData {
  name: string;
  sku: string;
  category_id: string;
  uom: string;
  reorder_level: string;
  description: string;
  is_active: boolean;
}

const emptyForm: ProductFormData = {
  name: '', sku: '', category_id: '', uom: 'Pieces', reorder_level: '10', description: '', is_active: true,
};

export function ProductsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', description: '' });
  const [savingCat, setSavingCat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [prodRes, catRes, whRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(*), stock_levels(*, location:locations(*, warehouse:warehouses(*)))').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('warehouses').select('*, locations(*)').order('name'),
    ]);
    setProducts(prodRes.data as Product[]);
    setCategories(catRes.data as Category[]);
    setWarehouses(whRes.data as Warehouse[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stockTotals = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const total = (p.stock_levels ?? []).reduce((s, sl) => s + Number(sl.quantity), 0);
      map.set(p.id, total);
    });
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') list = list.filter((p) => p.category_id === categoryFilter);
    if (stockFilter !== 'all') {
      list = list.filter((p) => {
        const total = stockTotals.get(p.id) ?? 0;
        const status = getStockStatus(total, p.reorder_level);
        return status === stockFilter;
      });
    }
    return list;
  }, [products, search, categoryFilter, stockFilter, stockTotals]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku, category_id: p.category_id ?? '', uom: p.uom,
      reorder_level: String(p.reorder_level), description: p.description, is_active: p.is_active,
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Product name is required';
    if (!form.sku.trim()) e.sku = 'SKU is required';
    const reorder = Number(form.reorder_level);
    if (isNaN(reorder) || reorder < 0) e.reorder_level = 'Reorder level must be a non-negative number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category_id: form.category_id || null,
      uom: form.uom.trim(),
      reorder_level: Number(form.reorder_level),
      description: form.description.trim(),
      is_active: form.is_active,
    };

    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) {
        toast(error.code === '23505' ? 'SKU already exists' : 'Failed to update product', 'error');
      } else {
        toast('Product updated successfully');
        setModalOpen(false);
        load();
      }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) {
        toast(error.code === '23505' ? 'SKU already exists' : 'Failed to create product', 'error');
      } else {
        toast('Product created successfully');
        setModalOpen(false);
        load();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('products').delete().eq('id', deleteId);
    setDeleteId(null);
    if (error) {
      toast('Cannot delete product — it may be referenced by transactions', 'error');
    } else {
      toast('Product deleted');
      load();
    }
  };

  const handleAddCategory = async () => {
    if (!newCat.name.trim()) { toast('Category name required', 'error'); return; }
    setSavingCat(true);
    const { error } = await supabase.from('categories').insert({ name: newCat.name.trim(), description: newCat.description.trim() });
    setSavingCat(false);
    if (error) {
      toast(error.code === '23505' ? 'Category already exists' : 'Failed to create category', 'error');
    } else {
      toast('Category added');
      setNewCat({ name: '', description: '' });
      setCatModalOpen(false);
      load();
    }
  };

  const columns = [
    {
      key: 'name', header: 'Product Name',
      render: (p: Product) => (
        <div>
          <p className="font-medium text-slate-800">{p.name}</p>
          <p className="text-xs text-slate-400">{p.uom}</p>
        </div>
      ),
    },
    { key: 'sku', header: 'SKU', render: (p: Product) => <span className="font-mono text-xs text-slate-600">{p.sku}</span> },
    { key: 'category', header: 'Category', render: (p: Product) => <span className="text-slate-600">{p.category?.name ?? '—'}</span> },
    {
      key: 'stock', header: 'Current Stock',
      render: (p: Product) => <span className="font-semibold text-slate-700">{stockTotals.get(p.id) ?? 0}</span>,
    },
    {
      key: 'reorder', header: 'Reorder Level',
      render: (p: Product) => <span className="text-slate-500">{p.reorder_level}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (p: Product) => <StockStatusBadge status={getStockStatus(stockTotals.get(p.id) ?? 0, p.reorder_level)} />,
    },
    {
      key: 'actions', header: 'Actions', className: 'text-right',
      render: (p: Product) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setViewProduct(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition" title="View">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition" title="Edit">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteId(p.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-10" placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="max-w-[180px]">
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="max-w-[160px]">
            <option value="all">All Stock</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatModalOpen(true)}>
            <Tag className="h-4 w-4" /> Categories
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={search ? 'Try adjusting your search or filters' : 'Start by adding your first product'}
          action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Product</Button>}
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Product' : 'Add Product'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} form="product-form" type="submit">Save</Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Product Name" required error={errors.name}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Steel Rods" />
            </Field>
            <Field label="SKU / Code" required error={errors.sku}>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. SKU-001" className="font-mono" />
            </Field>
            <Field label="Category">
              <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">— Select —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Unit of Measure" required>
              <Input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} placeholder="e.g. Pieces, Kg, Liters" />
            </Field>
            <Field label="Reorder Level" required error={errors.reorder_level}>
              <Input type="number" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
            </Field>
            <Field label="Active">
              <Select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional product description" />
          </Field>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewProduct} onClose={() => setViewProduct(null)} title="Product Details" size="lg">
        {viewProduct && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-400">Name</p><p className="font-medium text-slate-800">{viewProduct.name}</p></div>
              <div><p className="text-xs text-slate-400">SKU</p><p className="font-mono text-sm text-slate-700">{viewProduct.sku}</p></div>
              <div><p className="text-xs text-slate-400">Category</p><p className="text-slate-700">{viewProduct.category?.name ?? '—'}</p></div>
              <div><p className="text-xs text-slate-400">Unit of Measure</p><p className="text-slate-700">{viewProduct.uom}</p></div>
              <div><p className="text-xs text-slate-400">Reorder Level</p><p className="text-slate-700">{viewProduct.reorder_level}</p></div>
              <div><p className="text-xs text-slate-400">Total Stock</p><p className="font-semibold text-slate-800">{stockTotals.get(viewProduct.id) ?? 0}</p></div>
            </div>
            {viewProduct.description && (
              <div><p className="text-xs text-slate-400 mb-1">Description</p><p className="text-sm text-slate-600">{viewProduct.description}</p></div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Stock by Location</p>
              {(viewProduct.stock_levels ?? []).length === 0 ? (
                <p className="text-sm text-slate-400">No stock recorded at any location</p>
              ) : (
                <div className="space-y-2">
                  {(viewProduct.stock_levels ?? []).map((sl: StockLevel) => (
                    <div key={sl.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{sl.location?.warehouse?.name} — {sl.location?.name}</p>
                        <p className="text-xs text-slate-400">{sl.location?.code}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-700">{sl.quantity}</span>
                        <StockStatusBadge status={getStockStatus(Number(sl.quantity), viewProduct.reorder_level)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Category Modal */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="Manage Categories"
        footer={<Button variant="outline" onClick={() => setCatModalOpen(false)}>Close</Button>}
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="New category name" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
            <Button onClick={handleAddCategory} loading={savingCat}>Add</Button>
          </div>
          <div className="space-y-1.5">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-700">{c.name}</p>
                  {c.description && <p className="text-xs text-slate-400">{c.description}</p>}
                </div>
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No categories yet</p>}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete product?"
        message="This will also delete all stock level records for this product. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
