import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, RoleGate, Stars } from "@/components/common";
import { announcementsQuery, productsQuery, profilesQuery, reviewsQuery, storesQuery } from "@/lib/queries";
import { averageRating, compareProductRating, formatPrice, validatePriceUpdate, type Product, type Review } from "@/lib/nourish";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/vendor")({
  head: () => ({ meta: [{ title: "Vendor portal — Nourish.ly" }, { name: "description", content: "Manage prices, promotions, sourcing, announcements and reviews." }, { property: "og:title", content: "Vendor portal — Nourish.ly" }, { property: "og:description", content: "Tools for store owners and market vendors." }] }),
  component: () => <RoleGate roles={["vendor"]}><VendorPortal /></RoleGate>,
});

function VendorPortal() {
  const { data: session } = useSession();
  const stores = useQuery(storesQuery);
  const mine = (stores.data ?? []).filter((s) => s.owner_id === session?.user?.id);
  const [storeId, setStoreId] = useState<string>("");
  const active = mine.find((s) => s.id === storeId) ?? mine[0];
  if (stores.isLoading) return <div className="surface-card h-40 animate-pulse" />;
  return (
    <>
      <PageHeader eyebrow="Vendor portal" title={active?.name ?? "Your stores"} subtitle="Keep prices fresh, tell students what's new, and respond to feedback."
        actions={mine.length > 1 && <select aria-label="Store" value={active?.id} onChange={(e) => setStoreId(e.target.value)} className="h-10 rounded-full border border-input bg-surface px-4 text-sm">{mine.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>} />
      {!active ? <EmptyState title="No stores linked to your account yet" /> : (
        <Tabs defaultValue="prices">
          <TabsList className="mb-6 rounded-full"><TabsTrigger value="prices" className="rounded-full">Prices & sourcing</TabsTrigger><TabsTrigger value="news" className="rounded-full">Announcements</TabsTrigger><TabsTrigger value="reviews" className="rounded-full">Reviews</TabsTrigger><TabsTrigger value="insights" className="rounded-full">Rating insights</TabsTrigger></TabsList>
          <TabsContent value="prices"><Prices storeId={active.id} /></TabsContent>
          <TabsContent value="news"><News storeId={active.id} /></TabsContent>
          <TabsContent value="reviews"><Reviews storeId={active.id} /></TabsContent>
          <TabsContent value="insights"><Insights storeId={active.id} /></TabsContent>
        </Tabs>
      )}
    </>
  );
}

function Prices({ storeId }: { storeId: string }) {
  const { data } = useQuery(productsQuery);
  const items = (data ?? []).filter((p) => p.store_id === storeId);
  const qc = useQueryClient();
  const [n, setN] = useState({ name: "", unit: "each", category: "produce", price: "" });
  async function add() {
    const price = Number(n.price);
    const err = n.name.trim().length < 2 ? "Enter a product name." : validatePriceUpdate(price, null);
    if (err) return toast.error(err);
    const { error } = await supabase.from("products").insert({ store_id: storeId, name: n.name.trim(), unit: n.unit, category: n.category, current_price: price });
    if (error) return toast.error(error.message);
    toast.success("Product added"); setN({ name: "", unit: "each", category: "produce", price: "" });
    qc.invalidateQueries({ queryKey: ["products"] });
  }
  return (
    <div className="space-y-4">
      {items.map((p) => <ProductRow key={p.id} p={p} />)}
      <div className="surface-card grid gap-3 p-5 sm:grid-cols-5">
        <Input placeholder="New product" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} className="sm:col-span-2" />
        <Input placeholder="Unit" value={n.unit} onChange={(e) => setN({ ...n, unit: e.target.value })} />
        <Input placeholder="Price" type="number" step="0.01" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} />
        <Button onClick={add}>Add product</Button>
      </div>
    </div>
  );
}

function ProductRow({ p }: { p: { id: string; name: string; unit: string; current_price: number; promo_price: number | null; promo_label: string | null; promo_ends_at: string | null; origin: string; producer: string } }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ price: String(p.current_price), promo: p.promo_price != null ? String(p.promo_price) : "", label: p.promo_label ?? "", ends: p.promo_ends_at ? p.promo_ends_at.slice(0, 10) : "", origin: p.origin, producer: p.producer });
  async function save() {
    const price = Number(f.price);
    const promo = f.promo === "" ? null : Number(f.promo);
    const err = validatePriceUpdate(price, promo);
    if (err) return toast.error(err);
    const { error } = await supabase.from("products").update({ current_price: price, promo_price: promo, promo_label: promo == null ? null : f.label || "Promo", promo_ends_at: promo == null || !f.ends ? null : new Date(f.ends + "T23:59:59").toISOString(), origin: f.origin.slice(0, 120), producer: f.producer.slice(0, 120) }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`${p.name} updated — comparisons are live`);
    qc.invalidateQueries({ queryKey: ["products"] });
  }
  return (
    <div className="surface-card p-5">
      <div className="mb-3 flex items-center justify-between"><p className="font-semibold">{p.name} <span className="text-sm font-normal text-muted-foreground">/ {p.unit}</span></p><span className="text-sm text-muted-foreground">Now {formatPrice(p.promo_price ?? p.current_price)}</span></div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Field label="Price"><Input aria-label={`${p.name} price`} type="number" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        <Field label="Promo price"><Input aria-label={`${p.name} promo price`} type="number" step="0.01" placeholder="—" value={f.promo} onChange={(e) => setF({ ...f, promo: e.target.value })} /></Field>
        <Field label="Promo label"><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
        <Field label="Promo ends"><Input type="date" value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} /></Field>
        <Field label="Origin"><Input value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })} /></Field>
        <Field label="Producer"><Input value={f.producer} onChange={(e) => setF({ ...f, producer: e.target.value })} /></Field>
        <div className="flex items-end"><Button className="w-full" onClick={save} aria-label={`Save ${p.name}`}>Save</Button></div>
      </div>
    </div>
  );
}
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="space-y-1 text-xs text-muted-foreground"><span>{label}</span>{children}</label>;

function News({ storeId }: { storeId: string }) {
  const { data } = useQuery(announcementsQuery);
  const qc = useQueryClient();
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  async function post() {
    if (title.trim().length < 2) return toast.error("Add a title.");
    const { error } = await supabase.from("announcements").insert({ store_id: storeId, title: title.trim().slice(0, 120), body: body.trim().slice(0, 1000) });
    if (error) return toast.error(error.message);
    toast.success("Broadcast sent to students"); setTitle(""); setBody("");
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }
  async function remove(id: string) { await supabase.from("announcements").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["announcements"] }); }
  return (
    <div className="space-y-4">
      <div className="surface-card space-y-3 p-6"><Input placeholder="e.g. Fresh strawberries this Saturday" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /><Textarea placeholder="Details" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} /><Button onClick={post}>Broadcast</Button></div>
      {(data ?? []).filter((a) => a.store_id === storeId).map((a) => <div key={a.id} className="surface-card flex justify-between gap-4 p-5"><div><p className="font-semibold">{a.title}</p><p className="text-muted-foreground">{a.body}</p></div><Button variant="ghost" size="sm" onClick={() => remove(a.id)}>Delete</Button></div>)}
    </div>
  );
}

function Reviews({ storeId }: { storeId: string }) {
  const { data } = useQuery(reviewsQuery);
  const profiles = useQuery(profilesQuery);
  const list = (data ?? []).filter((r) => r.store_id === storeId && r.status === "visible");
  if (list.length === 0) return <EmptyState title="No reviews yet" />;
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">Average {averageRating(list)} from {list.length} reviews</p>{list.map((r) => <ReviewRow key={r.id} r={r} who={profiles.data?.find((p) => p.id === r.user_id)?.display_name ?? "Student"} />)}</div>;
}
function ReviewRow({ r, who }: { r: { id: string; rating: number; body: string; owner_response: string | null }; who: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState(r.owner_response ?? "");
  async function respond() {
    const { error } = await supabase.rpc("respond_to_review", { _review_id: r.id, _response: text });
    if (error) return toast.error(error.message);
    toast.success("Public response posted"); qc.invalidateQueries({ queryKey: ["reviews"] });
  }
  return (
    <div className="surface-card space-y-3 p-5">
      <div className="flex items-center gap-2"><Stars value={r.rating} /><span className="text-sm font-medium">{who}</span>{r.owner_response && <Badge variant="fresh">Responded</Badge>}</div>
      <p>{r.body}</p>
      <Textarea aria-label="Public response" placeholder="Write a public response" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
      <Button size="sm" variant="soft" onClick={respond}>{r.owner_response ? "Update response" : "Respond publicly"}</Button>
    </div>
  );
}

function Insights({ storeId }: { storeId: string }) {
  const p = useQuery(productsQuery); const r = useQuery(reviewsQuery);
  const products = (p.data ?? []) as unknown as Product[]; const reviews = (r.data ?? []) as unknown as Review[];
  const own = products.filter((x) => x.store_id === storeId);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {own.map((x) => {
        const c = compareProductRating(x.id, products, reviews);
        const tone = c.verdict === "above" ? "fresh" : c.verdict === "below" ? "danger" : "muted";
        const text = { above: "Above similar items", below: "Below similar items", on_par: "On par with similar items", not_enough_data: "Not enough reviews yet" }[c.verdict];
        return (
          <div key={x.id} className="surface-card p-6">
            <div className="flex items-center justify-between"><p className="font-semibold">{x.name}</p><Badge variant={tone}>{text}</Badge></div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div><p className="eyebrow">Your rating</p><p className="display-title text-3xl">{c.productAvg ?? "—"}</p><p className="text-xs text-muted-foreground">{c.productCount} reviews</p></div>
              <div><p className="eyebrow">Similar products</p><p className="display-title text-3xl">{c.peerAvg ?? "—"}</p><p className="text-xs text-muted-foreground">{c.peerCount} reviews elsewhere</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
