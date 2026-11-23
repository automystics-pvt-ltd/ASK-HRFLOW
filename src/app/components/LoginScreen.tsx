import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { CompanyLogo } from './Brand';
import { useAccess } from '../lib/access';
import { useBranding } from '../lib/branding';
import { authApi, ApiError } from '../lib/api';
import {
  Loader2,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Building2,
} from 'lucide-react';

const REMEMBER_EMAIL_KEY = 'hrflow.rememberEmail';

type View = 'login' | 'forgot' | 'reset' | 'forgot-sent';

export function LoginScreen() {
  const { login, authReady } = useAccess();
  const { company, logoUrl } = useBranding();
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [note, setNote] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const companyName = company.name || 'Automystics';
  const legalName = company.legalName || companyName;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken') || params.get('token');
    if (token) {
      setResetToken(token);
      setView('reset');
    }
  }, []);

  const features = useMemo(
    () => [
      'Role-based access with a full permission matrix',
      'Secure sessions with Admin-controlled password recovery',
      'Attendance, leave, payroll, and people workflows in one place',
    ],
    [],
  );

  const submitLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !password) return setError('Enter your work email and password.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid work email address.');
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (rememberMe) localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_EMAIL_KEY);
    } catch {
      /* ignore */
    }
    const r = await login(email.trim(), password, rememberMe);
    if (!r.ok) setError(r.error ?? 'Sign in failed.');
    setBusy(false);
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter the work email on your account.');
    setBusy(true);
    setError('');
    try {
      const res = await authApi.forgotPassword({
        email: email.trim(),
        employeeId: employeeId.trim() || undefined,
        note: note.trim() || undefined,
      });
      setInfo(res.message);
      setView('forgot-sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit request.');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim()) return setError('Reset token is required.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    setBusy(true);
    setError('');
    try {
      const res = await authApi.resetPassword({
        token: resetToken.trim(),
        newPassword,
        confirmPassword,
      });
      setInfo(res.message);
      setView('login');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password.');
    } finally {
      setBusy(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[radial-gradient(ellipse_at_top_right,_var(--accent)_0%,_transparent_50%),linear-gradient(180deg,var(--background),color-mix(in_srgb,var(--primary)_4%,var(--background)))]">
      {/* Brand panel */}
      <aside
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16 text-white"
        style={{
          backgroundImage:
            'linear-gradient(155deg, var(--sidebar-from, #061a52) 0%, var(--brand-secondary, #0a2a7a) 48%, var(--sidebar-accent, #1d6bff) 100%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-10 left-10 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative z-10 space-y-6">
          <CompanyLogo onDark size="xl" className="w-auto object-contain" />
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90 ring-1 ring-white/15">
            <Building2 className="w-3.5 h-3.5" />
            {companyName}
          </div>
        </div>
        <div className="relative z-10 max-w-lg space-y-6">
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight !text-white leading-[1.1]">
            ASK HRFlow
          </h1>
          <p className="text-lg text-white/85 leading-relaxed">
            A premium people operations workspace for {companyName} — attendance, leave, payroll, and performance with enterprise-grade access control.
          </p>
          <ul className="space-y-3">
            {features.map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/55">&copy; {legalName}. All rights reserved.</p>
      </aside>

      {/* Auth panel */}
      <main className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 space-y-4 lg:hidden">
            <CompanyLogo size="lg" className="w-auto object-contain" />
            <div>
              <p className="text-sm font-semibold text-primary">{companyName}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.14em] font-semibold mt-1">ASK HRFlow</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(10,42,122,0.35)] backdrop-blur-sm">
            {view === 'login' && (
              <>
                <div className="mb-6 space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign in</h2>
                  <p className="text-sm text-muted-foreground">Access your secure {companyName} workspace.</p>
                </div>
                <form onSubmit={(ev) => void submitLogin(ev)} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="email">Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="h-11"
                      aria-invalid={Boolean(error && !email)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => {
                          setError('');
                          setInfo('');
                          setView('forgot');
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your password"
                        className="h-11 pr-11"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={rememberMe}
                      onCheckedChange={(v) => setRememberMe(Boolean(v))}
                      aria-label="Remember me"
                    />
                    Remember me on this device
                  </label>
                  {error && (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}
                  {info && (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      {info}
                    </div>
                  )}
                  <Button type="submit" className="w-full h-11" disabled={busy}>
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    Sign in
                  </Button>
                </form>
                <div className="mt-6 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  <p>
                    Demo and temporary credentials are issued only by your system administrator. Passwords are never displayed on this page.
                    {logoUrl ? '' : ''}
                  </p>
                </div>
              </>
            )}

            {view === 'forgot' && (
              <>
                <button
                  type="button"
                  className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
                  onClick={() => {
                    setView('login');
                    setError('');
                  }}
                >
                  <ArrowLeft className="w-4 h-4" /> Back to sign in
                </button>
                <div className="mb-6 space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight">Forgot password</h2>
                  <p className="text-sm text-muted-foreground">
                    Password recovery is Admin-controlled. Submit a request and contact your system administrator — passwords are never shown automatically.
                  </p>
                </div>
                <form onSubmit={(ev) => void submitForgot(ev)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Registered work email</Label>
                    <Input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-id">Employee ID (optional)</Label>
                    <Input id="employee-id" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-note">Note for Admin (optional)</Label>
                    <Input id="forgot-note" value={note} onChange={(e) => setNote(e.target.value)} className="h-11" placeholder="How we can verify your identity" />
                  </div>
                  {error && (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}
                  <Button type="submit" className="w-full h-11" disabled={busy}>
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit reset request
                  </Button>
                </form>
              </>
            )}

            {view === 'forgot-sent' && (
              <div className="space-y-5 text-center py-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold">Request submitted</h2>
                  <p className="text-sm text-muted-foreground">
                    {info ||
                      'Your administrator has been notified. They will verify your identity and provide a temporary password or secure reset link.'}
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setView('login');
                    setInfo('');
                  }}
                >
                  Return to sign in
                </Button>
              </div>
            )}

            {view === 'reset' && (
              <>
                <div className="mb-6 space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight">Set new password</h2>
                  <p className="text-sm text-muted-foreground">Use the secure token from your administrator to create your own password.</p>
                </div>
                <form onSubmit={(ev) => void submitReset(ev)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-token">Reset token</Label>
                    <Input id="reset-token" value={resetToken} onChange={(e) => setResetToken(e.target.value)} className="h-11 font-mono text-xs" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-new">New password</Label>
                    <Input id="reset-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11" required minLength={8} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-confirm">Confirm password</Label>
                    <Input id="reset-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11" required minLength={8} />
                  </div>
                  {error && (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}
                  <Button type="submit" className="w-full h-11" disabled={busy}>
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save new password
                  </Button>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">&copy; {legalName}</p>
        </div>
      </main>
    </div>
  );
}
