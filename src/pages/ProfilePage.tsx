import { useState } from 'react';
import { User as UserIcon, Mail, Phone, Shield, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Field';
import { LoadingSpinner } from '@/components/ui/States';

export function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  if (!profile) return <LoadingSpinner />;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast('Name cannot be empty', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      toast('Failed to update profile', 'error');
    } else {
      await refreshProfile();
      toast('Profile updated successfully');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">
            {profile.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{profile.full_name || 'User'}</h2>
            <p className="text-sm text-slate-500 capitalize">{profile.role.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <h3 className="text-base font-semibold text-slate-900">Profile Information</h3>

        <Field label="Full Name" required>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
        </Field>

        <Field label="Email">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-10" value={user?.email ?? ''} disabled />
          </div>
        </Field>

        <Field label="Phone">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-0100" />
          </div>
        </Field>

        <Field label="Role">
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-10 capitalize" value={profile.role.replace('_', ' ')} disabled />
          </div>
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
