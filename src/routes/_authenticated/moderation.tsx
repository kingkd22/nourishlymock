import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip, EmptyState, PageHeader, RoleGate } from "@/components/common";
import { profilesQuery, reportsQuery } from "@/lib/queries";
import { REASON_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/moderation")({
  head: () => ({ meta: [{ title: "Moderation — Nourish.ly" }, { name: "description", content: "Review flagged ratings and recipe feedback." }, { property: "og:title", content: "Moderation — Nourish.ly" }, { property: "og:description", content: "Moderator review queue." }] }),
  component: () => <RoleGate roles={["moderator", "admin"]}><Queue /></RoleGate>,
});

function useTargets() {
  return useQuery({
    queryKey: ["report-targets"],
    queryFn: async () => {
      const [a, b] = await Promise.all([supabase.from("store_reviews").select("id, body, rating, status"), supabase.from("recipe_feedback").select("id, body, rating, status")]);
      const m = new Map<string, { body: string; rating: number; status: string }>();
      [...(a.data ?? []), ...(b.data ?? [])].forEach((x) => m.set(x.id, x));
      return m;
    },
  });
}

function Queue() {
  const reports = useQuery(reportsQuery);
  const targets = useTargets();
  const profiles = useQuery(profilesQuery);
  const qc = useQueryClient();
  const [status, setStatus] = useState("open");
  const list = (reports.data ?? []).filter((r) => r.status === status);
  const who = (id: string | null) => profiles.data?.find((p) => p.id === id)?.display_name ?? "Unknown";

  async function act(id: string, action: "hide" | "remove" | "dismiss") {
    const { error } = await supabase.rpc("moderate_report", { _report_id: id, _action: action });
    if (error) { toast.error(error.message); return; }
    toast.success(action === "dismiss" ? "Report dismissed" : `Content ${action === "hide" ? "hidden" : "removed"}`);
    qc.invalidateQueries();
  }

  return (
    <>
      <PageHeader eyebrow="Moderation" title="Review queue" subtitle="Flagged store ratings and recipe feedback from the community." />
      <div className="mb-6 flex gap-2">{["open", "actioned", "dismissed"].map((s) => <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s.charAt(0).toUpperCase() + s.slice(1)} ({(reports.data ?? []).filter((r) => r.status === s).length})</Chip>)}</div>
      {list.length === 0 && <EmptyState title="Nothing here" body="The queue is clear." />}
      <div className="space-y-3">
        {list.map((r) => {
          const t = targets.data?.get(r.target_id);
          return (
            <div key={r.id} className="surface-card p-6">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={r.reason === "inaccurate" ? "info" : "danger"}>{REASON_LABELS[r.reason]}</Badge>
                <Badge variant="muted">{r.target_type === "store_review" ? "Store review" : "Recipe feedback"}</Badge>
                <span className="text-muted-foreground">Reported by {who(r.reporter_id)} · {formatDistanceToNow(new Date(r.created_at))} ago</span>
                {r.resolution && <Badge variant="outline">{r.resolution}</Badge>}
              </div>
              <blockquote className="mt-3 rounded-xl bg-secondary p-4">“{t?.body ?? "Content unavailable"}” <span className="block text-xs text-muted-foreground">— {who(r.target_author_id)} · {t?.rating}★ · {t?.status}</span></blockquote>
              {r.details && <p className="mt-2 text-sm text-muted-foreground">Reporter note: {r.details}</p>}
              {r.status === "open" && <div className="mt-4 flex gap-2"><Button size="sm" variant="ink" onClick={() => act(r.id, "hide")}>Hide</Button><Button size="sm" variant="destructive" onClick={() => act(r.id, "remove")}>Remove</Button><Button size="sm" variant="secondary" onClick={() => act(r.id, "dismiss")}>Dismiss</Button></div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
