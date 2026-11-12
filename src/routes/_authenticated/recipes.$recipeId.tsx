import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Clock, MapPin, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, FlagButton, StarInput, Stars } from "@/components/common";
import { feedbackQuery, profilesQuery, recipesQuery, storesQuery } from "@/lib/queries";
import { averageRating, formatPrice, storesForRecipe, type Store } from "@/lib/nourish";
import { ALLERGEN_LABELS, DIETARY_LABELS, RELIGIOUS_LABELS } from "@/lib/labels";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/recipes/$recipeId")({
  head: () => ({ meta: [{ title: "Recipe — Nourish.ly" }, { name: "description", content: "Ingredients, steps, tags and where to shop." }, { property: "og:title", content: "Recipe — Nourish.ly" }, { property: "og:description", content: "Ingredients, steps, tags and where to shop." }] }),
  component: RecipePage,
});

function RecipePage() {
  const { recipeId } = Route.useParams();
  const recipes = useQuery(recipesQuery);
  const stores = useQuery(storesQuery);
  const feedback = useQuery(feedbackQuery(recipeId));
  const profiles = useQuery(profilesQuery);
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const r = recipes.data?.find((x) => x.id === recipeId);
  if (recipes.isLoading) return <div className="surface-card h-60 animate-pulse" />;
  if (!r) return <EmptyState title="Recipe not found" />;
  const visible = (feedback.data ?? []).filter((f) => f.status === "visible");
  const where = storesForRecipe(r, (stores.data ?? []) as unknown as Store[]);

  async function submit() {
    if (rating < 1) return toast.error("Pick a star rating.");
    const { error } = await supabase.from("recipe_feedback").insert({ recipe_id: recipeId, user_id: session!.user!.id, rating, body: body.trim().slice(0, 1000) });
    if (error) return toast.error(error.message);
    toast.success("Thanks for the feedback");
    setRating(0); setBody("");
    qc.invalidateQueries({ queryKey: ["feedback", recipeId] });
  }

  return (
    <div className="space-y-8">
      <Link to="/recipes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All recipes</Link>
      <div className="surface-card p-8">
        <p className="eyebrow">{r.cuisine} · by {r.chef_name}</p>
        <h1 className="display-title mt-2 text-4xl md:text-5xl">{r.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{r.description}</p>
        <div className="mt-5 flex flex-wrap gap-5 text-sm"><span className="flex items-center gap-1"><Clock className="h-4 w-4" />{r.minutes} min</span><span className="flex items-center gap-1"><Users className="h-4 w-4" />{r.servings} servings</span><span className="flex items-center gap-1"><Wallet className="h-4 w-4" />~{formatPrice(r.est_cost)}</span><span className="flex items-center gap-1"><Stars value={averageRating(visible)} />{visible.length}</span></div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {r.religious_compliance.map((t) => <Badge key={t} variant="info">{RELIGIOUS_LABELS[t] ?? t}</Badge>)}
          {r.dietary_tags.map((t) => <Badge key={t} variant="fresh">{DIETARY_LABELS[t] ?? t}</Badge>)}
          {r.allergen_tags.length === 0 ? <Badge variant="muted">No major allergens</Badge> : r.allergen_tags.map((t) => <Badge key={t} variant="danger">Contains {ALLERGEN_LABELS[t]?.toLowerCase() ?? t}</Badge>)}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <div className="surface-card p-6"><h2 className="mb-3 text-xl font-semibold">Ingredients</h2><ul className="space-y-2">{r.ingredients.map((i) => <li key={i} className="border-b border-hairline pb-2 last:border-0">{i}</li>)}</ul></div>
        <div className="surface-card p-6"><h2 className="mb-3 text-xl font-semibold">Steps</h2><ol className="space-y-3">{r.steps.map((s, i) => <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{i + 1}</span>{s}</li>)}</ol></div>
      </div>
      <div className="surface-card p-6">
        <h2 className="mb-3 text-xl font-semibold">Where to find ingredients</h2>
        {where.length === 0 ? <p className="text-muted-foreground">Most grocery stores will carry these.</p> : (
          <div className="flex flex-wrap gap-3">{where.map((s) => <Link key={s.id} to="/stores/$storeId" params={{ storeId: s.id }} className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm hover:bg-accent"><MapPin className="h-4 w-4" />{s.name} · {s.distance_miles} mi</Link>)}</div>
        )}
      </div>
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Feedback</h2>
        <div className="surface-card mb-4 space-y-3 p-6"><StarInput value={rating} onChange={setRating} /><Textarea placeholder="Did you make it? How did it go?" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} /><Button onClick={submit}>Post feedback</Button></div>
        <div className="space-y-3">{visible.map((f) => (
          <div key={f.id} className="surface-card p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Stars value={f.rating} /><span className="text-sm font-medium">{profiles.data?.find((p) => p.id === f.user_id)?.display_name ?? "Student"}</span></div><FlagButton targetType="recipe_feedback" targetId={f.id} authorId={f.user_id} /></div>{f.body && <p className="mt-2">{f.body}</p>}</div>
        ))}</div>
      </section>
    </div>
  );
}
