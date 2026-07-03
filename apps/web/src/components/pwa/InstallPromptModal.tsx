'use client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from './usePwaInstall';
import { Share, SquarePlus, MoreVertical } from 'lucide-react';

export function InstallPromptModal() {
  const { open, platform, install, dismiss } = usePwaInstall();

  if (!platform) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Synapse to your home screen</DialogTitle>
          <DialogDescription>
            Install the app for faster access and a full-screen experience.
          </DialogDescription>
        </DialogHeader>

        {platform === 'ios' ? (
          <div className="text-sm space-y-2">
            <p className="flex items-center gap-2">
              1. Tap <Share className="size-4" /> Share in Safari
            </p>
            <p className="flex items-center gap-2">
              2. Tap <SquarePlus className="size-4" /> &quot;Add to Home Screen&quot;
            </p>
          </div>
        ) : null}

        {platform === 'android-manual' ? (
          <div className="text-sm space-y-2">
            <p className="flex items-center gap-2">
              1. Tap <MoreVertical className="size-4" /> menu in your browser
            </p>
            <p>2. Tap &quot;Add to Home screen&quot; or &quot;Install app&quot;</p>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={dismiss}>
            Not now
          </Button>
          {platform === 'android' ? (
            <Button onClick={install}>Install</Button>
          ) : (
            <Button onClick={dismiss}>Got it</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
