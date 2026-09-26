import { useState } from 'react';
import { Boxes, Mail, Lock, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Field';
import { supabase } from '@/lib/supabase';

export function AuthPage({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('inventory_manager');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast('Welcome back!', 'success');
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role } },
        });
        if (error) throw error;
        toast('Account created! You can now sign in.', 'success');
        setMode('login');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setResetEmailSent(true);
        toast('Reset link sent to your email', 'success');
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: 'recovery',
        });
        if (error) throw error;
        toast('Verified! Please set your new password.', 'success');
        setMode('login');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Boxes className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold">StockSense</span>
          </div>
          <div>
            <h2 className="text-4xl font-bold leading-tight">Inventory Management,<br />Simplified.</h2>
            <p className="mt-4 text-lg text-blue-100 max-w-md">
              Track stock across warehouses, manage receipts, deliveries, transfers, and adjustments — all in one place.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 max-w-md">
              {[
                { label: 'Multi-warehouse', value: 'Track stock by location' },
                { label: 'Real-time ledger', value: 'Every move recorded' },
                { label: 'Low-stock alerts', value: 'Never run out' },
                { label: 'Smart dashboard', value: 'KPIs at a glance' },
              ].map((f) => (
                <div key={f.label} className="rounded-lg bg-white/10 backdrop-blur p-4">
                  <p className="font-semibold text-sm">{f.label}</p>
                  <p className="text-xs text-blue-100 mt-0.5">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-blue-200">© 2026 StockSense. All rights reserved.</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Boxes className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-slate-900">StockSense</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <h1 className="text-2xl font-bold text-slate-900">
              {mode === 'login' && 'Sign in to your account'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'reset' && 'Enter verification code'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {mode === 'login' && 'Enter your credentials to access the dashboard'}
              {mode === 'signup' && 'Start managing your inventory today'}
              {mode === 'forgot' && "Enter your email and we'll send you a reset code"}
              {mode === 'reset' && 'Check your email for the 6-digit OTP code'}
            </p>

            {mode === 'forgot' && resetEmailSent && (
              <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                Reset link sent. Check your email inbox.
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'signup' && (
                <Field label="Full Name" required>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-10"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </Field>
              )}

              <Field label="Email" required>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    className="pl-10"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </Field>

              {(mode === 'login' || mode === 'signup') && (
                <Field label="Password" required>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      className="pl-10 pr-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
              )}

              {mode === 'signup' && (
                <Field label="Role" required>
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="inventory_manager">Inventory Manager</option>
                    <option value="warehouse_staff">Warehouse Staff</option>
                  </Select>
                </Field>
              )}

              {mode === 'reset' && (
                <Field label="OTP Code" required>
                  <Input
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    maxLength={6}
                  />
                </Field>
              )}

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                {mode === 'login' && 'Sign In'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'forgot' && 'Send Reset Link'}
                {mode === 'reset' && 'Verify Code'}
              </Button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm">
              {mode === 'login' && (
                <>
                  <button onClick={() => setMode('forgot')} className="text-blue-600 hover:text-blue-700 font-medium">
                    Forgot password?
                  </button>
                  <p className="text-slate-500">
                    Don't have an account?{' '}
                    <button onClick={() => setMode('signup')} className="text-blue-600 hover:text-blue-700 font-medium">
                      Sign up
                    </button>
                  </p>
                </>
              )}
              {mode === 'signup' && (
                <p className="text-slate-500">
                  Already have an account?{' '}
                  <button onClick={() => setMode('login')} className="text-blue-600 hover:text-blue-700 font-medium">
                    Sign in
                  </button>
                </p>
              )}
              {(mode === 'forgot' || mode === 'reset') && (
                <button onClick={() => setMode('login')} className="text-blue-600 hover:text-blue-700 font-medium">
                  Back to sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
