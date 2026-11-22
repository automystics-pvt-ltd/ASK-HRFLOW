import React from 'react';
import { Switch } from './ui/switch';
import { actions, modules, type Action, type PermissionSet } from '../lib/access';
import { Lock } from 'lucide-react';

export function PermissionMatrix({ perms, onToggle, locked = false }: {
  perms: PermissionSet;
  onToggle: (module: string, action: Action, on: boolean) => void;
  locked?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-medium">Module</th>
            {actions.map((a) => <th key={a} className="p-3 font-medium text-center uppercase text-xs tracking-wider">{a}</th>)}
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <tr key={m.id} className="border-t border-border">
              <td className="p-3">
                <div className="font-medium flex items-center gap-1.5">{m.label}{m.adminOnly && <Lock className="w-3 h-3 text-muted-foreground" aria-label="Admin-sensitive" />}</div>
                <div className="text-xs text-muted-foreground">{m.description}</div>
              </td>
              {actions.map((a) => (
                <td key={a} className="p-3 text-center">
                  <Switch
                    checked={(perms[m.id] ?? []).includes(a)}
                    disabled={locked}
                    aria-label={`${a} ${m.label}`}
                    onCheckedChange={(v) => onToggle(m.id, a, v)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
