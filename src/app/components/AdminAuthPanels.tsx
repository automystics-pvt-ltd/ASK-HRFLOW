import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { authApi, ApiError } from '../lib/api';
import { useAccess, roleLabels } from '../lib/access';
import { KeyRound, RefreshCw, ShieldAlert, UserCog } from 'lucide-react';

type ResetRequest = Awaited<ReturnType<typeof authApi.listPasswordResets>>['requests'][number];
type DemoAccount = Awaited<ReturnType<typeof authApi.listDemoAccounts>>['accounts'][number];

export function AdminAuthPanels() {
  const { user } = useAccess();
  const isAdmin = user?.role === 'admin';
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [demos, setDemos] = useState<DemoAccount[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ label: string; value: string } | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [pr, da] = await Promise.all([authApi.listPasswordResets(), authApi.listDemoAccounts()]);
      setRequests(pr.requests);
      setDemos(da.accounts);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load auth management data');
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) return null;

  const approve = async (id: string, mode: 'temporary' | 'link') => {
    setBusyId(id);
    try {
      const res = await authApi.approvePasswordReset(id, { mode });
      if (res.temporaryPassword) {
        setRevealed({ label: 'Temporary password (copy now — shown once)', value: res.temporaryPassword });
      } else if (res.resetToken) {
        const link = `${window.location.origin}/?resetToken=${encodeURIComponent(res.resetToken)}`;
        setRevealed({ label: 'Secure reset link (copy now — shown once)', value: link });
      }
      toast.success(res.message);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    setBusyId(id);
    try {
      await authApi.rejectPasswordReset(id, 'Rejected by administrator');
      toast.success('Request rejected');
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  };

  const rotateDemo = async (id: string) => {
    setBusyId(id);
    try {
      const res = await authApi.resetDemoCredentials(id);
      setRevealed({
        label: `Temporary password for ${res.email} (copy now — shown once)`,
        value: res.temporaryPassword,
      });
      toast.success(res.message);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not rotate credentials');
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      {revealed && (
        <Card className="rounded-xl border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              {revealed.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input readOnly value={revealed.value} className="font-mono text-sm" onFocus={(e) => e.target.select()} />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(revealed.value);
                  toast.success('Copied to clipboard');
                }}
              >
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRevealed(null)}>
                Dismiss
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Passwords are hashed at rest and never retrievable later. Share this value securely out-of-band.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Password reset requests
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Admin-controlled recovery. Verify identity before issuing temporary credentials or a reset link.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => void load()}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
          {pending.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                    {r.employeeId ? ` · Employee ID ${r.employeeId}` : ''}
                  </p>
                  {r.requesterNote && <p className="text-sm mt-1 text-muted-foreground">{r.requesterNote}</p>}
                </div>
                <Badge>Pending</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busyId === r.id} onClick={() => void approve(r.id, 'temporary')}>
                  Issue temporary password
                </Button>
                <Button size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => void approve(r.id, 'link')}>
                  Issue reset link
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => void reject(r.id)}>
                  Reject
                </Button>
              </div>
            </div>
          ))}
          {requests.filter((r) => r.status !== 'pending').length > 0 && (
            <div className="pt-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Recent history</Label>
              <ul className="mt-2 space-y-2">
                {requests
                  .filter((r) => r.status !== 'pending')
                  .slice(0, 8)
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm border-t border-border pt-2">
                      <span className="truncate">
                        {r.email} · {r.status}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : ''}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" />
            Demo account credentials
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Admin-only. Generate temporary access for product demos. Passwords are never stored in readable form and are not shown to HR, Managers, or Employees.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50 text-left">
              <tr>
                {['Account', 'Role', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="p-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demos.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.email}</div>
                  </td>
                  <td className="p-3">{roleLabels[d.role as keyof typeof roleLabels]?.label ?? d.role}</td>
                  <td className="p-3">
                    <Badge variant={d.active ? 'default' : 'secondary'}>{d.active ? 'Active' : 'Inactive'}</Badge>
                    {d.mustChangePassword && (
                      <Badge variant="outline" className="ml-2">
                        Must change password
                      </Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => void rotateDemo(d.id)}>
                        Generate temporary password
                      </Button>
                      {d.active ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === d.id || d.id === user?.id}
                          onClick={() =>
                            void authApi
                              .deactivateDemoAccount(d.id)
                              .then(() => load())
                              .then(() => toast.success('Demo account deactivated'))
                              .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed'))
                          }
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === d.id}
                          onClick={() =>
                            void authApi
                              .activateDemoAccount(d.id)
                              .then(() => load())
                              .then(() => toast.success('Demo account activated'))
                              .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed'))
                          }
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
