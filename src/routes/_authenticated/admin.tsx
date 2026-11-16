import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, RoleGate } from "@/components/common";
import { profilesQuery, recipesQuery, reportsQuery } from "@/lib/queries";
import { inaccuracyReports, recurringIssues } from "@/lib/nourish";
import { REASON_LABELS } from "@/lib/labels";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin insights — Nourish.ly" }, { name: "description", content: "Track inaccurate recipe feedback and recurring issues." }, { property: "og:title", content: "Admin insights — Nourish.ly" }, { property: "og:description", content: "Admin analytics." }] }),
  component: () => <RoleGate roles={["admin"]}><Admin /></RoleGate>,
});

function Admin() {
  const reports = useQuery(reportsQuery);
  const recipes = useQuery(recipesQuery);
  const profiles = useQuery(profilesQuery);
  const all = reports.data ?? [];
  const inacc = inaccuracyReports(all);
  const issues = recurringIssues(all);
  const recipeName = (id: string | null) => recipes.data?.find((r) => r.id === id)?.title ?? "—";
  const userName = (id: string | null) => profiles.data?.find((p) => p.id === id)?.display_name ?? "Unknown";
  const stat = (label: string, v: number) => <div className="surface-card p-6"><p className="eyebrow">{label}</p><p className="display-title mt-2 text-4xl">{v}</p></div>;

  return (
    <>
      <PageHeader eyebrow="Admin" title="Insights" subtitle="Accuracy tracking and patterns across community reports." />
      <div className="mb-10 grid gap-4 sm:grid-cols-4">{stat("Total reports", all.length)}{stat("Open", all.filter((r) => r.status === "open").length)}{stat("Inaccuracy reports", inacc.length)}{stat("Recurring issues", issues.length)}</div>
      <h2 className="mb-4 text-2xl font-semibold">Recurring issues</h2>
      {issues.length === 0 ? <EmptyState title="No recurring issues" /> : (
        <div className="mb-10 grid gap-4 md:grid-cols-2">{issues.map((i) => (
          <div key={i.kind + i.key} className="surface-card p-6">
            <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><Badge variant={i.kind === "recipe" ? "info" : "promo"}>{i.kind === "recipe" ? "Recipe" : "User"}</Badge></div>
            <p className="mt-2 text-lg font-semibold">{i.kind === "recipe" ? <Link to="/recipes/$recipeId" params={{ recipeId: i.key }} className="hover:text-primary">{recipeName(i.key)}</Link> : userName(i.key)}</p>
            <p className="text-sm text-muted-foreground">{i.total} reports · {i.open} open</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(i.reasons).map(([k, v]) => <Badge key={k} variant="muted">{REASON_LABELS[k]} × {v}</Badge>)}</div>
          </div>
        ))}</div>
      )}
      <h2 className="mb-4 text-2xl font-semibold">Inaccurate recipe feedback</h2>
      {inacc.length === 0 ? <EmptyState title="No inaccuracy reports" /> : (
        <div className="surface-card overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-left"><tr><th className="px-5 py-3">Recipe</th><th className="px-5">Author</th><th className="px-5">Note</th><th className="px-5">Status</th><th className="px-5">Date</th></tr></thead><tbody>
          {inacc.map((r) => <tr key={r.id} className="border-t border-hairline"><td className="px-5 py-3 font-medium">{recipeName(r.recipe_id)}</td><td className="px-5">{userName(r.target_author_id)}</td><td className="px-5 text-muted-foreground">{r.details}</td><td className="px-5"><Badge variant={r.status === "open" ? "promo" : "muted"}>{r.status}</Badge></td><td className="px-5">{format(new Date(r.created_at), "MMM d")}</td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}
