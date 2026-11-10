import { useState, type ReactNode } from "react";
import { Star, Flag, Lock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { REASON_LABELS } from "@/lib/labels";
import { hasAnyRole, useSession, type Role } from "@/hooks/use-session";

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between fade-up">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display-title text-4xl md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-all",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

export function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function Stars({ value, size = 14 }: { value: number | null; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value == null ? "No rating" : `${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={cn(value != null && i <= Math.round(value) ? "fill-warning text-warning" : "text-border")} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => onChange(i)}>
          <Star className={cn("h-6 w-6 transition-colors", i <= value ? "fill-warning text-warning" : "text-border")} />
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="surface-card px-6 py-14 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {body && <p className="mt-1 text-muted-foreground">{body}</p>}
    </div>
  );
}

export function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { data, isLoading } = useSession();
  if (isLoading) return <div className="h-40 animate-pulse surface-card" />;
  if (!hasAnyRole(data?.roles, roles))
    return (
      <div className="surface-card mx-auto max-w-lg px-8 py-14 text-center">
        <Lock className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
        <p className="text-xl font-semibold">This area is for {roles.join(" or ").replace("_", " ")} accounts</p>
        <p className="mt-2 text-muted-foreground">Sign in with an account that has this role to continue.</p>
      </div>
    );
  return <>{children}</>;
}

export function FlagButton({ targetType, targetId, authorId, invalidate }: { targetType: "store_review" | "recipe_feedback"; targetId: string; authorId: string; invalidate?: unknown[] }) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("inappropriate");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (!session?.user || session.user.id === authorId) return null;
  const reasons = targetType === "recipe_feedback" ? ["inappropriate", "inaccurate", "spam", "harassment", "other"] : ["inappropriate", "spam", "harassment", "other"];
  async function submit() {
    setBusy(true);
    const { error } = await supabase.from("flagged_reports").insert({ target_type: targetType, target_id: targetId, reporter_id: session!.user!.id, reason, details: details.trim().slice(0, 500) });
    setBusy(false);
    if (error) {
      toast.error(error.code === "23505" ? "You've already reported this." : error.message);
      return;
    }
    toast.success("Thanks — a moderator will review it.");
    setOpen(false);
    setDetails("");
    if (invalidate) qc.invalidateQueries({ queryKey: invalidate });
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive" aria-label="Report">
        <Flag className="h-3.5 w-3.5" /> Report
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Report this {targetType === "store_review" ? "review" : "feedback"}</DialogTitle>
            <DialogDescription>Reports are private. Moderators will hide anything that breaks the community guidelines.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {reasons.map((r) => (
                <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{REASON_LABELS[r]}</Chip>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="flag-details">Details (optional)</Label>
              <Textarea id="flag-details" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What's wrong with it?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={submit}>Submit report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
