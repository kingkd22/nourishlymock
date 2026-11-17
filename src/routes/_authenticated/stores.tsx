import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Clock, Search, Footprints, Bus, BusFront, Accessibility, Megaphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Chip, EmptyState, PageHeader, Stars, toggle } from "@/components/common";
import { announcementsQuery, reviewsQuery, storesQuery } from "@/lib/queries";
import { averageRating, fastestRoute, filterStores, travelMinutes, type Store, type TransitMode } from "@/lib/nourish";
import { ACCESS_LABELS, RELIGIOUS_LABELS, TRANSIT_LABELS, VENDOR_LABELS } from "@/lib/labels";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/stores")({
  head: () => ({ meta: [{ title: "Store finder — Nourish.ly" }, { name: "description", content: "Find grocery stores and farmers' markets you can reach by foot, bus or shuttle." }, { property: "og:title", content: "Store finder — Nourish.ly" }, { property: "og:description", content: "Find reachable, accessible, budget-friendly stores." }] }),
  component: StoresPage,
});

export const MODE_ICON = { walking: Footprints, bus: Bus, shuttle: BusFront } as const;
const CUISINES = ["Indian", "Chinese", "Korean", "Mexican", "Middle Eastern", "Mediterranean"];

function StoresPage() {
  const stores = useQuery(storesQuery);
  const reviews = useQuery(reviewsQuery);
  const news = useQuery(announcementsQuery);
  const [query, setQuery] = useState("");
  const [modes, setModes] = useState<TransitMode[]>([]);
  const [access, setAccess] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [budget, setBudget] = useState(false);

  const list = useMemo(() => {
    const all = (stores.data ?? []) as unknown as Store[];
    return filterStores(all, { query, modes, accessibility: access, dietary, ...(cuisine ? { cuisine } : {}), vendorTypes: types, budgetOnly: budget });
  }, [stores.data, query, modes, access, dietary, cuisine, types, budget]);

  return (
    <>
      <PageHeader eyebrow="Store finder" title="Find food you can reach." subtitle="Filter by how you get around, accessibility needs, and what you cook." />
      {news.data && news.data.length > 0 && (
        <div className="mb-8 flex gap-3 overflow-x-auto pb-2">
          {news.data.slice(0, 6).map((a) => (
            <Link key={a.id} to="/stores/$storeId" params={{ storeId: a.store_id }} className="surface-card min-w-[280px] max-w-[320px] p-5 transition-transform hover:-translate-y-0.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Megaphone className="h-3.5 w-3.5 text-primary" />{a.stores?.name} · {formatDistanceToNow(new Date(a.created_at))} ago</div>
              <p className="mt-2 font-semibold">{a.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
            </Link>
          ))}
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-6">
          <div className="relative"><Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search stores or cuisines" value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 rounded-full bg-surface pl-10" /></div>
          <Group title="Getting there">{(["walking", "bus", "shuttle"] as TransitMode[]).map((m) => <Chip key={m} active={modes.includes(m)} onClick={() => setModes(toggle(modes, m))}>{TRANSIT_LABELS[m]}</Chip>)}</Group>
          <Group title="Accessibility">{Object.keys(ACCESS_LABELS).map((a) => <Chip key={a} active={access.includes(a)} onClick={() => setAccess(toggle(access, a))}>{ACCESS_LABELS[a]}</Chip>)}</Group>
          <Group title="Stocks">{Object.keys(RELIGIOUS_LABELS).map((d) => <Chip key={d} active={dietary.includes(d)} onClick={() => setDietary(toggle(dietary, d))}>{RELIGIOUS_LABELS[d]}</Chip>)}<Chip active={budget} onClick={() => setBudget(!budget)}>Budget-friendly</Chip></Group>
          <Group title="International ingredients">{CUISINES.map((c) => <Chip key={c} active={cuisine === c} onClick={() => setCuisine(cuisine === c ? "" : c)}>{c}</Chip>)}</Group>
          <Group title="Type">{Object.keys(VENDOR_LABELS).map((t) => <Chip key={t} active={types.includes(t)} onClick={() => setTypes(toggle(types, t))}>{VENDOR_LABELS[t]}</Chip>)}</Group>
        </aside>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{list.length} store{list.length === 1 ? "" : "s"}</p>
          {stores.isLoading && <div className="surface-card h-40 animate-pulse" />}
          {!stores.isLoading && list.length === 0 && <EmptyState title="No stores match" body="Try removing a filter." />}
          {list.map((s) => {
            const full = stores.data!.find((x) => x.id === s.id)!;
            const avg = averageRating((reviews.data ?? []).filter((r) => r.store_id === s.id && r.status === "visible"));
            const best = fastestRoute(s, modes.length ? modes : undefined);
            return (
              <Link key={s.id} to="/stores/$storeId" params={{ storeId: s.id }} className="surface-card block p-6 transition-transform hover:-translate-y-0.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={s.vendor_type === "farmers_market" ? "fresh" : s.vendor_type === "international_market" ? "info" : "muted"}>{VENDOR_LABELS[s.vendor_type]}</Badge>
                      {s.budget_friendly && <Badge variant="promo">Budget pick</Badge>}
                    </div>
                    <h2 className="mt-2 text-xl font-semibold">{s.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{full.address} · {s.distance_miles} mi</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{full.hours}</span>
                    </div>
                  </div>
                  <div className="text-right"><Stars value={avg} /><p className="text-xs text-muted-foreground">{avg == null ? "No reviews" : `${avg} average`}</p></div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(["walking", "bus", "shuttle"] as TransitMode[]).map((m) => {
                    const t = travelMinutes(s, m);
                    if (t == null) return null;
                    const Icon = MODE_ICON[m];
                    return <span key={m} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${best?.mode === m ? "bg-accent text-accent-foreground" : "bg-secondary"}`}><Icon className="h-3.5 w-3.5" />{t} min</span>;
                  })}
                  {s.accessibility_flags.length > 0 && <span className="flex items-center gap-1 rounded-full bg-info-soft px-2.5 py-1 text-xs text-info"><Accessibility className="h-3.5 w-3.5" />{s.accessibility_flags.map((a) => ACCESS_LABELS[a]).join(" · ")}</span>}
                  {s.dietary_stock.map((d) => <Badge key={d} variant="outline">{RELIGIOUS_LABELS[d] ?? d}</Badge>)}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="eyebrow mb-2.5">{title}</p><div className="flex flex-wrap gap-2">{children}</div></div>;
}
