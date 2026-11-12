import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Clock, MapPin, Sprout } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, FlagButton, StarInput, Stars } from "@/components/common";
import { announcementsQuery, productsQuery, profilesQuery, reviewsQuery, storesQuery } from "@/lib/queries";
import { averageRating, effectivePrice, formatPrice, isPromoActive, travelMinutes, type Product, type Store, type TransitMode } from "@/lib/nourish";
import { ACCESS_LABELS, RELIGIOUS_LABELS, TRANSIT_LABELS, VENDOR_LABELS } from "@/lib/labels";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/stores/$storeId")({
  head: () => ({ meta: [{ title: "Store details — Nourish.ly" }, { name: "description", content: "Prices, sourcing, hours and reviews." }, { property: "og:title", content: "Store details — Nourish.ly" }, { property: "og:description", content: "Prices, sourcing, hours and reviews." }] }),
  component: StorePage,
});

function StorePage() {
  const { storeId } = Route.useParams();
  const stores = useQuery(storesQuery);
  const products = useQuery(productsQuery);
  const reviews = useQuery(reviewsQuery);
  const news = useQuery(announcementsQuery);
  const profiles = useQuery(profilesQuery);
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [productId, setProductId] = useState("");

  const store = stores.data?.find((s) => s.id === storeId);
  if (stores.isLoading) return <div className="surface-card h-60 animate-pulse" />;
  if (!store) return <EmptyState title="Store not found" />;
  const items = (products.data ?? []).filter((p) => p.store_id === storeId) as unknown as Product[];
  const storeReviews = (reviews.data ?? []).filter((r) => r.store_id === storeId && r.status === "visible");
  const name = (id: string) => profiles.data?.find((p) => p.id === id)?.display_name ?? "Student";

  async function submitReview() {
    if (rating < 1) return toast.error("Pick a star rating.");
    const { error } = await supabase.from("store_reviews").insert({ store_id: storeId, user_id: session!.user!.id, rating, body: body.trim().slice(0, 1000), product_id: productId || null });
    if (error) return toast.error(error.message);
    toast.success("Review posted");
    setRating(0); setBody(""); setProductId("");
    qc.invalidateQueries({ queryKey: ["reviews"] });
  }

  return (
    <div className="space-y-8">
      <Link to="/stores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All stores</Link>
      <div className="surface-card p-8">
        <Badge variant={store.vendor_type === "farmers_market" ? "fresh" : "muted"}>{VENDOR_LABELS[store.vendor_type]}</Badge>
        <h1 className="display-title mt-3 text-4xl">{store.name}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{store.description}</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Info title="Location"><MapPin className="h-4 w-4" />{store.address} · {store.distance_miles} mi</Info>
          <Info title="Hours"><Clock className="h-4 w-4" />{store.hours}</Info>
          <Info title="Rating"><Stars value={averageRating(storeReviews)} /> <span>{averageRating(storeReviews) ?? "—"} ({storeReviews.length})</span></Info>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {(["walking", "bus", "shuttle"] as TransitMode[]).map((m) => { const t = travelMinutes(store as unknown as Store, m); return t == null ? null : <Badge key={m} variant="fresh">{TRANSIT_LABELS[m]} · {t} min</Badge>; })}
          {store.accessibility_flags.map((a) => <Badge key={a} variant="info">{ACCESS_LABELS[a]}</Badge>)}
          {store.dietary_stock.map((d) => <Badge key={d} variant="outline">Stocks {RELIGIOUS_LABELS[d] ?? d}</Badge>)}
          {store.cuisines.map((c) => <Badge key={c} variant="muted">{c}</Badge>)}
        </div>
      </div>

      {(news.data ?? []).filter((a) => a.store_id === storeId).map((a) => (
        <div key={a.id} className="surface-card border-l-4 border-primary p-5"><p className="eyebrow">Announcement · {formatDistanceToNow(new Date(a.created_at))} ago</p><p className="mt-1 font-semibold">{a.title}</p><p className="text-muted-foreground">{a.body}</p></div>
      ))}

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Products & sourcing</h2>
        <div className="surface-card divide-y divide-hairline">
          {items.length === 0 && <p className="p-6 text-muted-foreground">No products listed yet.</p>}
          {items.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-medium">{p.name} <span className="text-sm text-muted-foreground">/ {p.unit}</span></p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground"><Sprout className="h-3.5 w-3.5" />{(p as any).origin || "Origin not listed"}{(p as any).producer ? ` · ${(p as any).producer}` : ""}</p>
              </div>
              <div className="text-right">
                {isPromoActive(p) ? (<><Badge variant="promo">{p.promo_label || "Promo"}</Badge><p className="mt-1 text-lg font-semibold">{formatPrice(effectivePrice(p))} <span className="text-sm font-normal text-muted-foreground line-through">{formatPrice(p.current_price)}</span></p></>) : <p className="text-lg font-semibold">{formatPrice(p.current_price)}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Reviews</h2>
        <div className="surface-card mb-4 space-y-3 p-6">
          <p className="font-medium">Write a review</p>
          <StarInput value={rating} onChange={setRating} />
          <select aria-label="Product (optional)" value={productId} onChange={(e) => setProductId(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-surface px-3 text-sm">
            <option value="">Whole store</option>
            {items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Textarea placeholder="How was it?" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button onClick={submitReview}>Post review</Button>
        </div>
        <div className="space-y-3">
          {storeReviews.map((r) => (
            <div key={r.id} className="surface-card p-5">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Stars value={r.rating} /><span className="text-sm font-medium">{name(r.user_id)}</span>{r.product_id && <Badge variant="muted">{items.find((p) => p.id === r.product_id)?.name}</Badge>}</div><FlagButton targetType="store_review" targetId={r.id} authorId={r.user_id} /></div>
              {r.body && <p className="mt-2">{r.body}</p>}
              {r.owner_response && <div className="mt-3 rounded-xl bg-secondary p-3 text-sm"><p className="font-medium">Response from the owner</p><p className="text-muted-foreground">{r.owner_response}</p></div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="eyebrow mb-1">{title}</p><div className="flex items-center gap-1.5 text-sm">{children}</div></div>;
}
