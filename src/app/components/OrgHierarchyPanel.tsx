import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Loader2, Network, Users } from 'lucide-react';
import { approvalsApi, employeesApi, ApiError } from '../lib/api';
import { useAccess } from '../lib/access';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

type Emp = {
  id: number;
  userId: string | null;
  name: string;
  email: string;
  department: string;
  position: string;
  designation: string | null;
  managerUserId: string | null;
  managerName: string | null;
  role: string | null;
  status: string;
  reports?: Emp[];
};

function TreeNode({ node, depth = 0 }: { node: Emp; depth?: number }) {
  return (
    <div className="space-y-2" style={{ marginLeft: depth ? Math.min(depth, 6) * 12 : 0 }}>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm bg-card">
        <span className="font-medium">{node.name}</span>
        <Badge variant="secondary">{node.role || '—'}</Badge>
        <span className="text-muted-foreground text-xs">
          {node.position || '—'} · {node.department || '—'}
        </span>
        {node.managerName ? (
          <span className="text-xs text-muted-foreground">Reports to {node.managerName}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Top of tree</span>
        )}
      </div>
      {(node.reports || []).map((c) => (
        <TreeNode key={c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export function OrgHierarchyPanel() {
  const { role, can } = useAccess();
  const [tree, setTree] = useState<Emp[]>([]);
  const [flat, setFlat] = useState<Emp[]>([]);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [managerUserId, setManagerUserId] = useState<string>('none');
  const [saving, setSaving] = useState(false);

  const canEdit = can('employees', 'update') && (role === 'admin' || role === 'hr');

  const load = () => {
    setLoading(true);
    void Promise.all([
      employeesApi.hierarchy(),
      approvalsApi.history({ limit: 40 }).catch(() => ({ history: [] })),
    ])
      .then(([h, hist]) => {
        setTree((h.tree ?? []) as Emp[]);
        setFlat((h.employees ?? []) as Emp[]);
        setHistory(hist.history ?? []);
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load hierarchy'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const managers = flat.filter((e) => e.userId && (e.role === 'manager' || e.role === 'admin' || e.role === 'hr'));

  const onSelectEmployee = (id: string) => {
    setSelectedId(id);
    const emp = flat.find((e) => String(e.id) === id);
    const current = emp?.managerUserId && managers.some((m) => m.userId === emp.managerUserId)
      ? emp.managerUserId
      : emp?.managerUserId || 'none';
    setManagerUserId(current === emp?.userId ? 'none' : current || 'none');
  };

  const saveManager = async () => {
    if (!selectedId) return;
    const emp = flat.find((e) => String(e.id) === selectedId);
    if (!emp) return;
    if (managerUserId !== 'none' && managerUserId === emp.userId) {
      toast.error('An employee cannot report to themselves');
      return;
    }
    setSaving(true);
    try {
      const mgr = managers.find((m) => m.userId === managerUserId);
      // Send only manager fields — server coalesces the rest so salary is never wiped
      await employeesApi.update(selectedId, {
        managerUserId: managerUserId === 'none' ? null : managerUserId,
        manager: mgr?.name ?? null,
      });
      toast.success('Reporting manager updated');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border border-border rounded-xl">
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="w-5 h-5" />
            Organization hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tree.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees found.</p>
          ) : (
            tree.map((n) => <TreeNode key={n.id} node={n} />)
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Card className="border border-border rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5" />
              Change reporting manager
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={selectedId} onValueChange={onSelectEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {flat.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                      {e.managerName ? ` → ${e.managerName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Manager</Label>
              <Select value={managerUserId} onValueChange={setManagerUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager</SelectItem>
                  {managers
                    .filter((m) => {
                      const emp = flat.find((e) => String(e.id) === selectedId);
                      return !emp?.userId || m.userId !== emp.userId;
                    })
                    .map((m) => (
                      <SelectItem key={m.userId!} value={m.userId!}>
                        {m.name} ({m.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={!selectedId || saving} onClick={() => void saveManager()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save reporting line
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5" />
            Approval history (team / org)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approval history yet.</p>
          ) : (
            history.map((h) => (
              <div key={String(h.id)} className="flex flex-wrap justify-between gap-2 border rounded-lg p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {String(h.requesterName)} · {String(h.moduleKey)} #{String(h.entityId)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {String(h.status)}
                    {h.lastActorName ? ` · by ${String(h.lastActorName)}` : ''}
                    {h.lastComment ? ` · “${String(h.lastComment)}”` : ''}
                  </p>
                </div>
                <Badge variant="secondary">{String(h.department || '—')}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
