import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, Search, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Chip, EmptyState, PageHeader, toggle } from "@/components/common";
import { recipesQuery } from "@/lib/queries";
import { filterRecipes, formatPrice } from "@/lib/nourish";
import { ALLERGEN_LABELS, DIETARY_LABELS, RELIGIOUS_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/recipes")({
  head: () => ({ meta: [{ title: "Recipe hub — Nourish.ly" }, { name: "description", content: "Halal, kosher, vegan, gluten-free and allergen-aware recipes for students." }, { property: "og:title", content: "Recipe hub — Nourish.ly" }, { property: "og:description", content: "Inclusive, budget-friendly recipes." }] }),
  component: RecipesPage,
});

function RecipesPage() {
  const { data, isLoading } = useQuery(recipesQuery);
  const [query, setQuery] = useState("");
  const [dietary, setDietary] = useState<string[]>([]);
  const [religious, setReligious] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const list = useMemo(() => filterRecipes(data ?? [], { query, dietary, religious, excludeAllergens: avoid }), [data, query, dietary, religious, avoid]);
  return (
    <>
      <PageHeader eyebrow="Recipe hub" title="Cook what fits you." subtitle="Every recipe is tagged by chefs for allergens, diets and religious rules." />
      <div className="surface-card mb-8 space-y-5 p-6">
        <div className="relative"><Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search recipes, cuisines or ingredients" value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 rounded-full pl-10" /></div>
        <div className="grid gap-5 md:grid-cols-3">
          <div><p className="eyebrow mb-2.5">Diet</p><div className="flex flex-wrap gap-2">{Object.entries(DIETARY_LABELS).map(([k, v]) => <Chip key={k} active={dietary.includes(k)} onClick={() => setDietary(toggle(dietary, k))}>{v}</Chip>)}</div></div>
          <div><p className="eyebrow mb-2.5">Religious</p><div className="flex flex-wrap gap-2">{Object.entries(RELIGIOUS_LABELS).map(([k, v]) => <Chip key={k} active={religious.includes(k)} onClick={() => setReligious(toggle(religious, k))}>{v}</Chip>)}</div></div>
          <div><p className="eyebrow mb-2.5">Avoid allergens</p><div className="flex flex-wrap gap-2">{Object.entries(ALLERGEN_LABELS).map(([k, v]) => <Chip key={k} active={avoid.includes(k)} onClick={() => setAvoid(toggle(avoid, k))}>No {v.toLowerCase()}</Chip>)}</div></div>
        </div>
      </div>
      {isLoading && <div className="surface-card h-40 animate-pulse" />}
      {!isLoading && list.length === 0 && <EmptyState title="No recipes match" body="Try fewer filters." />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <Link key={r.id} to="/recipes/$recipeId" params={{ recipeId: r.id }} className="surface-card flex flex-col p-6 transition-transform hover:-translate-y-0.5">
            <p className="eyebrow">{r.cuisine}</p>
            <h2 className="mt-1 text-xl font-semibold">{r.title}</h2>
            <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{r.description}</p>
            <div className="mt-4 flex gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.minutes} min</span><span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5" />{formatPrice(r.est_cost)}</span></div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.religious_compliance.map((t) => <Badge key={t} variant="info">{RELIGIOUS_LABELS[t] ?? t}</Badge>)}
              {r.dietary_tags.map((t) => <Badge key={t} variant="fresh">{DIETARY_LABELS[t] ?? t}</Badge>)}
              {r.allergen_tags.map((t) => <Badge key={t} variant="danger">Contains {ALLERGEN_LABELS[t]?.toLowerCase() ?? t}</Badge>)}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
