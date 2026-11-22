import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { CompanyLogo } from './Brand';
import { useAccess, roleLabels } from '../lib/access';
import { useBranding } from '../lib/branding';
import { Loader2, ShieldCheck, AlertCircle, Shield, Users, User, UserCog } from 'lucide-react';

const demo = [
  { email: 'alvi@automystics.com', role: 'admin' as const, icon: Shield },
  { email: 'priya.nair@automystics.com', role: 'hr' as const, icon: Users },
  { email: 'ananya.manager@automystics.com', role: 'manager' as const, icon: UserCog },
  { email: 'rahul.verma@automystics.com', role: 'employee' as const, icon: User },
];

export function LoginScreen() {
  const { login, authReady } = useAccess();
  const { company } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const legalName = company.legalName || company.name || 'Automystics Technologies Private Limited';

  const submit = async (e?: string, p?: string) => {
    const em = e ?? email, pw = p ?? password;
    if (!em || !pw) return setError('Enter your email and password.');
    setBusy(true); setError('');
    const r = await login(em, pw);
    if (!r.ok) setError(r.error ?? 'Sign in failed.');
    setBusy(false);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-white"
        style={{
          backgroundImage:
            'linear-gradient(145deg, var(--sidebar-from, #061a52) 0%, var(--brand-secondary, #0a2a7a) 45%, var(--sidebar-accent, #1d6bff) 100%)',
        }}
      >
        <CompanyLogo onDark className="w-72 max-h-28 object-contain" />
        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-extrabold tracking-tight !text-white">ASK HRFlow</h1>
          <p className="text-white/80 text-lg">One workspace for people operations: attendance, leave, payroll, hiring and performance, with access tailored to every role.</p>
          <ul className="space-y-2 text-sm text-white/75">
            {['Role-based access with a full permission matrix', 'Location-verified attendance and locked timesheets', 'Complete audit trail of every access change'].map((t) => (
              <li key={t} className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-white/90" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/60">&copy; {legalName}</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden"><CompanyLogo className="w-56 max-h-20 object-contain" /></div>
          <div>
            <h2 className="text-2xl font-bold">Sign in</h2>
            <p className="text-muted-foreground">Access your ASK HRFlow workspace.</p>
          </div>
          <form onSubmit={(ev) => { ev.preventDefault(); void submit(); }} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
            </div>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Sign in
            </Button>
          </form>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Demo accounts (password: demo123)</p>
            <div className="grid gap-2">
              {demo.map((d) => {
                const Icon = d.icon;
                return (
                  <button key={d.email} type="button" onClick={() => void submit(d.email, 'demo123')} disabled={busy}
                    className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-accent/60 transition-colors">
                    <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Continue as {roleLabels[d.role].label}</span>
                      <span className="block text-xs text-muted-foreground truncate">{d.email}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}