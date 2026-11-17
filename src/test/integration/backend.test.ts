/**
 * Integration tests: run against the real Lovable Cloud backend using the demo accounts.
 * They verify access rules (who can do what) and the database-side business rules.
 * Every test restores any data it changes.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { compareItem, type Product, type Store } from "@/lib/nourish";

const URL = import.meta.env["VITE_SUPABASE_URL"] as string;
const KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;
const PASSWORD = "Nourish!2026";
const FARM = "11111111-0000-0000-0000-000000000004";
const VALUEMART = "11111111-0000-0000-0000-000000000002";
const PANTRY = "22222222-0000-0000-0000-000000000001";

const make = () => createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
type Client = ReturnType<typeof make>;
async function as(who: string): Promise<Client> {
  const c = make();
  const { error } = await c.auth.signInWithPassword({ email: `demo.${who}@nourishly.app`, password: PASSWORD });
  if (error) throw error;
  return c;
}

const run = URL && KEY ? describe : describe.skip;

run("backend integration", () => {
  let student: Client, student2: Client, vendor: Client, chef: Client, pantry: Client, mod: Client;
  const cleanup: (() => PromiseLike<unknown>)[] = [];

  beforeAll(async () => {
    student = await as("student"); student2 = await as("student2"); vendor = await as("vendor");
    chef = await as("chef"); pantry = await as("pantry_staff"); mod = await as("moderator");
  }, 30000);
  afterAll(async () => {
    for (const fn of cleanup.reverse()) await fn();
  });

  it("anonymous visitors cannot read store data", async () => {
    const anon = createClient<Database>(URL, KEY, { auth: { persistSession: false } });
    const { data } = await anon.from("stores").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("signup assigns roles from the protected roles table", async () => {
    const { data: s } = await student.from("user_roles").select("role");
    expect(s?.map((r) => r.role)).toEqual(["student"]);
    const { data: m } = await mod.from("user_roles").select("role");
    expect(m?.map((r) => r.role).sort()).toEqual(["moderator", "student"]);
  });

  it("students cannot change product prices", async () => {
    const { data: p } = await student.from("products").select("id,current_price").eq("store_id", FARM).limit(1).single();
    const { data } = await student.from("products").update({ current_price: 0.01 }).eq("id", p!.id).select();
    expect(data).toHaveLength(0);
  });

  it("vendors cannot edit stores they don't own", async () => {
    const { data } = await vendor.from("products").update({ current_price: 0.01 }).eq("store_id", VALUEMART).select();
    expect(data).toHaveLength(0);
  });

  it("vendor price/promo updates are reflected in comparisons (R7, R8)", async () => {
    const { data: egg } = await vendor.from("products").select("*").eq("store_id", FARM).eq("name", "Eggs").single();
    cleanup.push(() => vendor.from("products").update({ current_price: egg!.current_price, promo_price: egg!.promo_price, promo_label: egg!.promo_label, promo_ends_at: egg!.promo_ends_at }).eq("id", egg!.id));
    const { error } = await vendor.from("products").update({ current_price: 2.5, promo_price: 1.99, promo_label: "Test", promo_ends_at: new Date(Date.now() + 86400000).toISOString() }).eq("id", egg!.id);
    expect(error).toBeNull();
    const [{ data: products }, { data: stores }] = await Promise.all([
      student.from("products").select("*"), student.from("stores").select("*"),
    ]);
    const rows = compareItem("Eggs", products as unknown as Product[], stores as unknown as Store[]);
    expect(rows[0]!.store.id).toBe(FARM);
    expect(rows[0]!.price).toBe(1.99);
  });

  it("database rejects a promo price that isn't lower than the regular price", async () => {
    const { data: egg } = await vendor.from("products").select("id,current_price").eq("store_id", FARM).eq("name", "Apples").single();
    const { error } = await vendor.from("products").update({ promo_price: Number(egg!.current_price) + 1 }).eq("id", egg!.id);
    expect(error?.message).toMatch(/Promo price must be lower/);
  });

  it("vendors broadcast announcements; students cannot (R1)", async () => {
    const { data, error } = await vendor.from("announcements").insert({ store_id: FARM, title: "Integration test harvest", body: "test" }).select().single();
    expect(error).toBeNull();
    cleanup.push(() => vendor.from("announcements").delete().eq("id", data!.id));
    const { error: e2 } = await student.from("announcements").insert({ store_id: FARM, title: "Fake news", body: "" });
    expect(e2).not.toBeNull();
  });

  it("only the store owner can publicly respond to a review (R5)", async () => {
    const { data: review } = await vendor.from("store_reviews").select("id,owner_response,responded_at").eq("store_id", FARM).limit(1).single();
    const { error: deny } = await student.rpc("respond_to_review", { _review_id: review!.id, _response: "I am not the owner" });
    expect(deny?.message).toMatch(/Only the store owner/);
    const { error } = await vendor.rpc("respond_to_review", { _review_id: review!.id, _response: "Thanks for shopping with us!" });
    expect(error).toBeNull();
    const { data: after } = await student.from("store_reviews").select("owner_response").eq("id", review!.id).single();
    expect(after?.owner_response).toBe("Thanks for shopping with us!");
  });

  it("only chefs can publish tagged recipes (R17, R18)", async () => {
    const me = (await chef.auth.getUser()).data.user!.id;
    const { data, error } = await chef.from("recipes").insert({ chef_id: me, title: "Integration Test Oats", allergen_tags: ["milk"], dietary_tags: ["vegetarian"], religious_compliance: ["kosher"] }).select().single();
    expect(error).toBeNull();
    expect(data!.allergen_tags).toEqual(["milk"]);
    cleanup.push(() => chef.from("recipes").delete().eq("id", data!.id));
    const sid = (await student.auth.getUser()).data.user!.id;
    const { error: e2 } = await student.from("recipes").insert({ chef_id: sid, title: "Student recipe" });
    expect(e2).not.toBeNull();
  });

  it("pantry staff publish posts and events that students can see (R20–R23)", async () => {
    const { data: post, error } = await pantry.from("pantry_posts").insert({ pantry_id: PANTRY, title: "Integration test items", items: ["Beans"] }).select().single();
    expect(error).toBeNull();
    cleanup.push(() => pantry.from("pantry_posts").delete().eq("id", post!.id));
    const { data: seen } = await student.from("pantry_posts").select("id").eq("id", post!.id);
    expect(seen).toHaveLength(1);
    const start = new Date(Date.now() + 86400000);
    const { error: badEvent } = await pantry.from("pantry_events").insert({ pantry_id: PANTRY, title: "Bad", starts_at: start.toISOString(), ends_at: new Date(start.getTime() - 1000).toISOString() });
    expect(badEvent?.message).toMatch(/end after it starts/);
    const { error: studentPost } = await student.from("pantry_posts").insert({ pantry_id: PANTRY, title: "Nope" });
    expect(studentPost).not.toBeNull();
  });

  it("flag → moderator hide → content disappears for students (R24–R26)", async () => {
    const sid = (await student.auth.getUser()).data.user!.id;
    const { data: review } = await student.from("store_reviews").insert({ store_id: VALUEMART, user_id: sid, rating: 1, body: "Integration test rude review" }).select().single();
    cleanup.push(() => student.from("store_reviews").delete().eq("id", review!.id));

    const { error: selfFlag } = await student.from("flagged_reports").insert({ target_type: "store_review", target_id: review!.id, reporter_id: sid, reason: "inappropriate" });
    expect(selfFlag?.message).toMatch(/own content/);

    const s2 = (await student2.auth.getUser()).data.user!.id;
    const { data: report, error } = await student2.from("flagged_reports").insert({ target_type: "store_review", target_id: review!.id, reporter_id: s2, reason: "inappropriate" }).select().single();
    expect(error).toBeNull();
    expect(report!.target_author_id).toBe(sid);

    const { error: notMod } = await student2.rpc("moderate_report", { _report_id: report!.id, _action: "hide" });
    expect(notMod?.message).toMatch(/Moderator access required/);

    const { data: queue } = await mod.from("flagged_reports").select("id").eq("status", "open");
    expect(queue?.map((q) => q.id)).toContain(report!.id);

    const { error: modErr } = await mod.rpc("moderate_report", { _report_id: report!.id, _action: "hide" });
    expect(modErr).toBeNull();
    const { data: visible } = await student2.from("store_reviews").select("id").eq("id", review!.id);
    expect(visible).toHaveLength(0);
    const { data: resolved } = await mod.from("flagged_reports").select("status,resolution").eq("id", report!.id).single();
    expect(resolved).toEqual({ status: "actioned", resolution: "hide" });
  });

  it("students cannot read other people's reports", async () => {
    const { data } = await student2.from("flagged_reports").select("reporter_id");
    const s2 = (await student2.auth.getUser()).data.user!.id;
    expect((data ?? []).every((r) => r.reporter_id === s2)).toBe(true);
  });
});
