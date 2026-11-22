import React from 'react';
import { Button } from './ui/button';
import { ShieldAlert } from 'lucide-react';
import { moduleLabel } from '../lib/access';

export function AccessRestricted({ module, onBack }: { module: string; onBack: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center"><ShieldAlert className="w-8 h-8" /></div>
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="text-muted-foreground">
          You don’t have permission to open <span className="font-medium text-foreground">{moduleLabel(module)}</span>. Contact your administrator if you believe this is a mistake.
        </p>
        <Button onClick={onBack}>Back to dashboard</Button>
      </div>
    </div>
  );
}
