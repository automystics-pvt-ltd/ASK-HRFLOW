import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

type Props = {
  open: boolean;
  title?: string;
  actionLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (comment: string) => void | Promise<void>;
};

/** Mandatory reason dialog before approve/reject decisions. */
export function ApprovalReasonDialog({
  open,
  title = 'Enter reason',
  actionLabel = 'Confirm',
  onOpenChange,
  onConfirm,
}: Props) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onConfirm(trimmed);
      setComment('');
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setComment('');
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="approval-reason">Reason (required)</Label>
          <Textarea
            id="approval-reason"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Provide a clear reason for this decision"
            rows={4}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !comment.trim()}>
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
