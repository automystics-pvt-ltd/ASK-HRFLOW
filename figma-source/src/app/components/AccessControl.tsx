import React, { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { PermissionMatrix } from './PermissionMatrix';
import { useAccess, roleLabels, departments, type Role, type Action } from '../lib/access';
import { UserPlus, RotateCcw, History, Info } from 'lucide-react';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const result = (err: string | null, ok: string) => (err ? toast.error(err) : toast.success(ok));

export function AccessControl() {
  const a = useAccess();
  const canUpdate = a.can('access', 'update');
  const [selectedId, setSelectedId] = useState(a.users.find((u) => u.role === 'hr')?.id ?? a.users[0].id);
  const [roleTab, setRoleTab] = useState<Role>('hr');
  const [createOpen, setCreateOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; active: boolean } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'employee' as Role, department: 'Engineering' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selected = a.users.find((u) => u.id === selectedId) ?? a.users[0];
  const history = a.audit.filter((e) => e.targetId === selected.id || e.actorId === selected.id);

  const submitUser = () => {
    const er: Record<string, string> = {};
    if (!form.name.trim()) er.name = 'Name is required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = 'Enter a valid email';
    setErrors(er);
    if (Object.keys(er).length) return;
    const err = a.createUser(form);
    result(err, `${form.name} created. Temporary password: demo123`);
    if (!err) { setCreateOpen(false); setForm({ name: '', email: '', role: 'employee', department: 'Engineering' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Access Control</h1>
          <p className="text-muted-foreground">Manage users, roles and granular permissions</p>
        </div>
        {a.can('access', 'create') && (
          <Button className="gap-2 self-start" onClick={() => setCreateOpen(true)}><UserPlus className="w-4 h-4" />Add user</Button>
        )}
      </div>

      {!canUpdate && (
        <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"><Info className="w-4 h-4 mt-0.5" />You have read-only access to this module.</div>
      )}

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="user-perms">User permissions</TabsTrigger>
          <TabsTrigger value="roles">Role templates</TabsTrigger>
          <TabsTrigger value="history">Access history</TabsTrigger>
        </TabsList>

        {/* USERS */}
        <TabsContent value="users">
          <Card className="rounded-xl"><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-muted/50 text-left"><tr>
                {['User', 'Role', 'Department', 'Last login', 'Status'].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {a.users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                    <td className="p-3">
                      <Select value={u.role} disabled={!canUpdate || u.id === a.user?.id} onValueChange={(v) => result(a.setUserRole(u.id, v as Role), `${u.name} is now ${roleLabels[v as Role].label}`)}>
                        <SelectTrigger className="w-32 h-9" aria-label={`Role for ${u.name}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{(Object.keys(roleLabels) as Role[]).map((r) => <SelectItem key={r} value={r}>{roleLabels[r].label}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">{u.department}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{fmt(u.lastLogin)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={u.active} disabled={!canUpdate || u.id === a.user?.id} aria-label={`Active ${u.name}`} onCheckedChange={(v) => setConfirm({ id: u.id, active: v })} />
                        <Badge variant={u.active ? 'default' : 'secondary'}>{u.active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        {/* USER PERMISSIONS */}
        <TabsContent value="user-perms" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle>Individual permissions</CardTitle>
              <div className="flex gap-2 items-center">
                <Select value={selected.id} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-56" aria-label="Select user"><SelectValue /></SelectTrigger>
                  <SelectContent>{a.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} · {roleLabels[u.role].label}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-1" disabled={!canUpdate || selected.role === 'admin' || !selected.permissions}
                  onClick={() => result(a.resetUserPermissions(selected.id), 'Reset to role defaults')}><RotateCcw className="w-3.5 h-3.5" />Reset</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                {selected.role === 'admin' ? 'Admin accounts always have full access and cannot be restricted.'
                  : selected.permissions ? 'This user has custom permissions that override the role template.' : `Following the ${roleLabels[selected.role].label} role template. Any change creates a custom override.`}
              </p>
              <PermissionMatrix
                perms={a.permissionsOf(selected)}
                locked={!canUpdate || selected.role === 'admin'}
                onToggle={(m, ac, on) => result(a.setUserPermission(selected.id, m, ac, on), 'Permission updated')}
              />
              <div>
                <h3 className="font-medium mb-1">Department-based access</h3>
                <p className="text-xs text-muted-foreground mb-3">Limits whose employee data this user can view. Employees see only their own records.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {departments.map((d) => (
                    <label key={d} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={selected.departmentAccess.includes(d)} disabled={!canUpdate || selected.role === 'admin' || selected.role === 'employee'}
                        onCheckedChange={(v) => result(a.setDepartmentAccess(selected.id, d, !!v), 'Department access updated')} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ROLE TEMPLATES */}
        <TabsContent value="roles">
          <Card className="rounded-xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle>Role templates</CardTitle>
              <Tabs value={roleTab} onValueChange={(v) => setRoleTab(v as Role)}>
                <TabsList>{(Object.keys(roleLabels) as Role[]).map((r) => <TabsTrigger key={r} value={r}>{roleLabels[r].label}</TabsTrigger>)}</TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{roleLabels[roleTab].description}. New users inherit this template; users with custom overrides are unaffected.</p>
              <PermissionMatrix
                perms={roleTab === 'admin' ? a.permissionsOf(a.users.find((u) => u.role === 'admin')!) : a.roleTemplates[roleTab]}
                locked={roleTab === 'admin' || a.user?.role !== 'admin'}
                onToggle={(m, ac, on) => result(a.setRoleTemplate(roleTab, m, ac as Action, on), 'Role template updated')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history">
          <Card className="rounded-xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />User access history</CardTitle>
              <Select value={selected.id} onValueChange={setSelectedId}>
                <SelectTrigger className="w-56" aria-label="Select user"><SelectValue /></SelectTrigger>
                <SelectContent>{a.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded for {selected.name} yet.</p> : (
                <ul className="divide-y divide-border">
                  {history.slice(0, 50).map((e) => (
                    <li key={e.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div><span className="font-medium">{e.event}</span><span className="text-muted-foreground"> · {e.detail}</span></div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(e.ts)} · by {e.actorName}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create user */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add user</DialogTitle><DialogDescription>Creates an account that inherits the selected role’s permissions.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="nu-name">Full name <span className="text-destructive">*</span></Label>
              <Input id="nu-name" value={form.name} aria-invalid={!!errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}</div>
            <div className="space-y-2"><Label htmlFor="nu-email">Work email <span className="text-destructive">*</span></Label>
              <Input id="nu-email" type="email" value={form.email} aria-invalid={!!errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(roleLabels) as Role[]).filter((r) => r !== 'admin' || a.user?.role === 'admin').map((r) => <SelectItem key={r} value={r}>{roleLabels[r].label}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={submitUser}>Create user</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate / deactivate confirmation */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.active ? 'Activate' : 'Deactivate'} this account?</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.active ? 'The user will be able to sign in again.' : 'The user will be signed out and unable to sign in until reactivated.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm) result(a.setUserActive(confirm.id, confirm.active), confirm.active ? 'Account activated' : 'Account deactivated'); setConfirm(null); }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
