import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip, PageHeader, RoleGate, toggle } from "@/components/common";
import { recipesQuery } from "@/lib/queries";
import { ALLERGEN_LABELS, DIETARY_LABELS, RELIGIOUS_LABELS } from "@/lib/labels";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/chef")({
  head: () => ({ meta: [{ title: "Chef studio — Nourish.ly" }, { name: "description", content: "Publish recipes tagged with allergens, diets and religious compliance." }, { property: "og:title", content: "Chef studio — Nourish.ly" }, { property: "og:description", content: "Publish inclusive recipes." }] }),
  component: () => <RoleGate roles={["chef"]}><ChefStudio /></RoleGate>,
});

const schema = z.object({
  title: z.string().trim().min(2, "Add a title").max(120),
  cuisine: z.string().trim().min(2, "Add a cuisine").max(40),
  minutes: z.number().int().positive("Time must be positive").max(600),
  servings: z.number().int().positive().max(50),
  est_cost: z.number().min(0).max(500),
  ingredients: z.array(z.string()).min(1, "Add at least one ingredient"),
  steps: z.array(z.string()).min(1, "Add at least one step"),
});

function ChefStudio() {
  const { data: session } = useSession();
  const recipes = useQuery(recipesQuery);
  const qc = useQueryClient();
  const mine = (recipes.data ?? []).filter((r) => r.chef_id === session?.user?.id);
  const [f, setF] = useState({ title: "", description: "", cuisine: "", minutes: "30", servings: "2", cost: "5", ingredients: "", steps: "" });
  const [allergens, setAllergens] = useState<string[]>([]);
  const [diet, setDiet] = useState<string[]>([]);
  const [rel, setRel] = useState<string[]>([]);
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  async function publish() {
    const parsed = schema.safeParse({ title: f.title, cuisine: f.cuisine, minutes: Number(f.minutes), servings: Number(f.servings), est_cost: Number(f.cost), ingredients: lines(f.ingredients), steps: lines(f.steps) });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    const { error } = await supabase.from("recipes").insert({ ...parsed.data, description: f.description.slice(0, 500), chef_id: session!.user!.id, chef_name: session!.name, allergen_tags: allergens, dietary_tags: diet, religious_compliance: rel });
    if (error) { toast.error(error.message); return; }
    toast.success("Recipe published");
    setF({ title: "", description: "", cuisine: "", minutes: "30", servings: "2", cost: "5", ingredients: "", steps: "" }); setAllergens([]); setDiet([]); setRel([]);
    qc.invalidateQueries({ queryKey: ["recipes"] });
  }
  async function remove(id: string) { await supabase.from("recipes").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["recipes"] }); }

  return (
    <>
      <PageHeader eyebrow="Chef studio" title="Share a recipe." subtitle="Tag it carefully — students rely on your allergen and dietary labels." />
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="surface-card space-y-4 p-6">
          <Input aria-label="Title" placeholder="Recipe title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Textarea placeholder="Short description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input aria-label="Cuisine" placeholder="Cuisine" value={f.cuisine} onChange={(e) => setF({ ...f, cuisine: e.target.value })} />
            <Input aria-label="Minutes" type="number" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} />
            <Input aria-label="Servings" type="number" value={f.servings} onChange={(e) => setF({ ...f, servings: e.target.value })} />
            <Input aria-label="Estimated cost" type="number" step="0.01" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
          </div>
          <Textarea aria-label="Ingredients" placeholder="Ingredients — one per line" rows={4} value={f.ingredients} onChange={(e) => setF({ ...f, ingredients: e.target.value })} />
          <Textarea aria-label="Steps" placeholder="Steps — one per line" rows={4} value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} />
          <div><p className="eyebrow mb-2">Contains allergens</p><div className="flex flex-wrap gap-2">{Object.entries(ALLERGEN_LABELS).map(([k, v]) => <Chip key={k} active={allergens.includes(k)} onClick={() => setAllergens(toggle(allergens, k))}>{v}</Chip>)}</div></div>
          <div><p className="eyebrow mb-2">Dietary</p><div className="flex flex-wrap gap-2">{Object.entries(DIETARY_LABELS).map(([k, v]) => <Chip key={k} active={diet.includes(k)} onClick={() => setDiet(toggle(diet, k))}>{v}</Chip>)}</div></div>
          <div><p className="eyebrow mb-2">Religious compliance</p><div className="flex flex-wrap gap-2">{Object.entries(RELIGIOUS_LABELS).map(([k, v]) => <Chip key={k} active={rel.includes(k)} onClick={() => setRel(toggle(rel, k))}>{v}</Chip>)}</div></div>
          <Button size="lg" onClick={publish}>Publish recipe</Button>
        </div>
        <div><h2 className="mb-3 text-xl font-semibold">Your recipes</h2><div className="space-y-2">{mine.map((r) => <div key={r.id} className="surface-card flex items-center justify-between p-4"><Link to="/recipes/$recipeId" params={{ recipeId: r.id }} className="font-medium hover:text-primary">{r.title}</Link><Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Delete</Button></div>)}{mine.length === 0 && <p className="text-muted-foreground">None yet.</p>}</div></div>
      </div>
    </>
  );
}
