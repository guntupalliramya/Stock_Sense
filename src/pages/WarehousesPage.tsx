import { useEffect, useState, useCallback } from 'react';
import { Warehouse as WHIcon, Plus, Edit2, Trash2, MapPin, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner, EmptyState } from '@/components/ui/States';
import type { Warehouse, Location } from '@/types';

export function WarehousesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [whModalOpen, setWhModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [whForm, setWhForm] = useState({ name: '', code: '', address: '' });
  const [savingWh, setSavingWh] = useState(false);
  const [deleteWhId, setDeleteWhId] = useState<string | null>(null);

  const [locModalOpen, setLocModalOpen] = useState(false);
  const [locForWh, setLocForWh] = useState<Warehouse | null>(null);
  const [locForm, setLocForm] = useState({ name: '', code: '' });
  const [savingLoc, setSavingLoc] = useState(false);
  const [deleteLocId, setDeleteLocId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [whRes, locRes] = await Promise.all([
      supabase.from('warehouses').select('*').order('name'),
      supabase.from('locations').select('*, warehouse:warehouses(*)').order('code'),
    ]);
    setWarehouses(whRes.data as Warehouse[]);
    setLocations(locRes.data as Location[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreateWh = () => {
    setEditingWh(null);
    setWhForm({ name: '', code: '', address: '' });
    setWhModalOpen(true);
  };

  const openEditWh = (w: Warehouse) => {
    setEditingWh(w);
    setWhForm({ name: w.name, code: w.code, address: w.address });
    setWhModalOpen(true);
  };

  const handleSaveWh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whForm.name.trim() || !whForm.code.trim()) { toast('Name and code are required', 'error'); return; }
    setSavingWh(true);
    const payload = { name: whForm.name.trim(), code: whForm.code.trim().toUpperCase(), address: whForm.address.trim() };
    if (editingWh) {
      const { error } = await supabase.from('warehouses').update(payload).eq('id', editingWh.id);
      if (error) { toast(error.code === '23505' ? 'Code already exists' : 'Failed to update', 'error'); }
      else { toast('Warehouse updated'); setWhModalOpen(false); load(); }
    } else {
      const { error } = await supabase.from('warehouses').insert(payload);
      if (error) { toast(error.code === '23505' ? 'Code already exists' : 'Failed to create', 'error'); }
      else { toast('Warehouse created'); setWhModalOpen(false); load(); }
    }
    setSavingWh(false);
  };

  const handleDeleteWh = async () => {
    if (!deleteWhId) return;
    const { error } = await supabase.from('warehouses').delete().eq('id', deleteWhId);
    setDeleteWhId(null);
    if (error) { toast('Cannot delete — warehouse has related records', 'error'); }
    else { toast('Warehouse deleted'); load(); }
  };

  const openCreateLoc = (w: Warehouse) => {
    setLocForWh(w);
    setLocForm({ name: '', code: '' });
    setLocModalOpen(true);
  };

  const handleSaveLoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locForWh) return;
    if (!locForm.name.trim() || !locForm.code.trim()) { toast('Name and code are required', 'error'); return; }
    setSavingLoc(true);
    const { error } = await supabase.from('locations').insert({
      warehouse_id: locForWh.id,
      name: locForm.name.trim(),
      code: locForm.code.trim().toUpperCase(),
    });
    if (error) { toast(error.code === '23505' ? 'Location code exists in this warehouse' : 'Failed to create location', 'error'); }
    else { toast('Location added'); setLocModalOpen(false); load(); }
    setSavingLoc(false);
  };

  const handleDeleteLoc = async () => {
    if (!deleteLocId) return;
    const { error } = await supabase.from('locations').delete().eq('id', deleteLocId);
    setDeleteLocId(null);
    if (error) { toast('Cannot delete — location has stock or transactions', 'error'); }
    else { toast('Location deleted'); load(); }
  };

  const locsByWh = (whId: string) => locations.filter((l) => l.warehouse_id === whId);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage warehouses and their storage locations</p>
        <Button onClick={openCreateWh}><Plus className="h-4 w-4" /> Add Warehouse</Button>
      </div>

      {warehouses.length === 0 ? (
        <EmptyState icon={WHIcon} title="No warehouses yet" description="Add your first warehouse to start managing stock locations" action={<Button onClick={openCreateWh}><Plus className="h-4 w-4" /> Add Warehouse</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {warehouses.map((w) => (
            <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <WHIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{w.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{w.code}</p>
                    {w.address && <p className="text-sm text-slate-500 mt-1">{w.address}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditWh(w)} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteWhId(w.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Locations ({locsByWh(w.id).length})</p>
                  <button onClick={() => openCreateLoc(w)} className="text-xs font-medium text-blue-600 hover:text-blue-700">+ Add</button>
                </div>
                <div className="space-y-1.5">
                  {locsByWh(w.id).map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{l.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{l.code}</p>
                        </div>
                      </div>
                      <button onClick={() => setDeleteLocId(l.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  {locsByWh(w.id).length === 0 && <p className="text-xs text-slate-400 py-2 text-center">No locations yet</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={whModalOpen}
        onClose={() => setWhModalOpen(false)}
        title={editingWh ? 'Edit Warehouse' : 'Add Warehouse'}
        footer={
          <>
            <Button variant="outline" onClick={() => setWhModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWh} loading={savingWh} form="wh-form" type="submit">Save</Button>
          </>
        }
      >
        <form id="wh-form" onSubmit={handleSaveWh} className="space-y-4">
          <Field label="Warehouse Name" required>
            <Input value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} placeholder="e.g. Main Warehouse" />
          </Field>
          <Field label="Code" required>
            <Input value={whForm.code} onChange={(e) => setWhForm({ ...whForm, code: e.target.value })} placeholder="e.g. WH-001" className="font-mono" disabled={!!editingWh} />
          </Field>
          <Field label="Address">
            <Input value={whForm.address} onChange={(e) => setWhForm({ ...whForm, address: e.target.value })} placeholder="Optional address" />
          </Field>
        </form>
      </Modal>

      <Modal
        open={locModalOpen}
        onClose={() => setLocModalOpen(false)}
        title={`Add Location to ${locForWh?.name ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setLocModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLoc} loading={savingLoc} form="loc-form" type="submit">Add Location</Button>
          </>
        }
      >
        <form id="loc-form" onSubmit={handleSaveLoc} className="space-y-4">
          <Field label="Location Name" required>
            <Input value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} placeholder="e.g. Rack A, Zone 1" />
          </Field>
          <Field label="Code" required>
            <Input value={locForm.code} onChange={(e) => setLocForm({ ...locForm, code: e.target.value })} placeholder="e.g. WH1-RA" className="font-mono" />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteWhId} title="Delete warehouse?" message="All locations in this warehouse will also be deleted. This cannot be undone." confirmLabel="Delete" onConfirm={handleDeleteWh} onCancel={() => setDeleteWhId(null)} />
      <ConfirmDialog open={!!deleteLocId} title="Delete location?" message="This location will be removed. Stock records may prevent deletion." confirmLabel="Delete" onConfirm={handleDeleteLoc} onCancel={() => setDeleteLocId(null)} />
    </div>
  );
}
