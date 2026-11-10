import { describe, expect, it } from "vitest";
import {
  compareItem, comparableItems, compareProductRating, effectivePrice, fastestRoute, filterRecipes,
  filterStores, inaccuracyReports, isPromoActive, rankStoresForBasket, recurringIssues, storesForRecipe,
  travelMinutes, validatePriceUpdate, type Product, type Recipe, type Report, type Review, type Store,
} from "./nourish";

const NOW = new Date("2026-11-10T12:00:00Z");
const store = (o: Partial<Store> & { id: string }): Store => ({
  name: o.id, vendor_type: "grocery", distance_miles: 1, transit_modes: ["walking"],
  accessibility_flags: [], dietary_stock: [], cuisines: [], budget_friendly: false, ...o,
});
const product = (o: Partial<Product> & { id: string; store_id: string }): Product => ({
  name: "Eggs", category: "dairy", unit: "dozen", current_price: 4, promo_price: null, promo_ends_at: null, ...o,
});

const grocery = store({ id: "g", vendor_type: "grocery", distance_miles: 0.5, transit_modes: ["walking", "bus"], accessibility_flags: ["step_free_entry", "accessible_aisles"], dietary_stock: ["halal"], cuisines: ["American"], budget_friendly: true });
const farm = store({ id: "f", vendor_type: "farmers_market", distance_miles: 1, transit_modes: ["walking", "shuttle"], accessibility_flags: ["step_free_entry"] });
const intl = store({ id: "i", vendor_type: "international_market", distance_miles: 3, transit_modes: ["bus"], dietary_stock: ["halal", "kosher"], cuisines: ["Indian", "Korean"] });
const stores = [grocery, farm, intl];

describe("promotions", () => {
  it("uses the promo price while the promo is active", () => {
    const p = product({ id: "1", store_id: "g", current_price: 4.29, promo_price: 3.49, promo_ends_at: "2026-11-20T00:00:00Z" });
    expect(isPromoActive(p, NOW)).toBe(true);
    expect(effectivePrice(p, NOW)).toBe(3.49);
  });
  it("falls back to the regular price once the promo has expired", () => {
    const p = product({ id: "1", store_id: "g", current_price: 4.29, promo_price: 3.49, promo_ends_at: "2026-11-01T00:00:00Z" });
    expect(effectivePrice(p, NOW)).toBe(4.29);
  });
  it("ignores a promo that is not cheaper than the regular price", () => {
    const p = product({ id: "1", store_id: "g", current_price: 3, promo_price: 3.5 });
    expect(effectivePrice(p, NOW)).toBe(3);
  });
});

describe("price comparison across grocery and farmers' markets (R2, R8)", () => {
  const products = [
    product({ id: "a", store_id: "g", current_price: 4.29, promo_price: 3.49 }),
    product({ id: "b", store_id: "f", current_price: 4.5 }),
    product({ id: "c", store_id: "i", name: "eggs ", current_price: 5 }),
    product({ id: "d", store_id: "g", name: "Milk", current_price: 3.99 }),
  ];
  it("sorts cheapest first and includes farmers' market stands", () => {
    const rows = compareItem("Eggs", products, stores, NOW);
    expect(rows.map((r) => r.store.id)).toEqual(["g", "f", "i"]);
    expect(rows[0].isCheapest).toBe(true);
    expect(rows[0].onPromo).toBe(true);
    expect(rows.some((r) => r.store.vendor_type === "farmers_market")).toBe(true);
  });
  it("computes savings against the most expensive option", () => {
    const rows = compareItem("Eggs", products, stores, NOW);
    expect(rows[0].savingsVsHighest).toBe(1.51);
    expect(rows[2].savingsVsHighest).toBe(0);
  });
  it("reflects an updated price immediately", () => {
    const updated = products.map((p) => (p.id === "b" ? { ...p, current_price: 2.99 } : p));
    expect(compareItem("Eggs", updated, stores, NOW)[0].store.id).toBe("f");
  });
  it("only lists items sold at 2+ stores as comparable", () => {
    expect(comparableItems(products)).toEqual(["Eggs"]);
  });
});

describe("transit & store finder (R10, R11, R15, R16, R13, R14)", () => {
  it("estimates travel time per mode and returns null when unreachable", () => {
    expect(travelMinutes(grocery, "walking")).toBe(10);
    expect(travelMinutes(grocery, "bus")).toBe(12);
    expect(travelMinutes(grocery, "shuttle")).toBeNull();
  });
  it("picks the fastest allowed mode", () => {
    expect(fastestRoute(intl)).toEqual({ mode: "bus", minutes: 22 });
    expect(fastestRoute(intl, ["walking"])).toBeNull();
  });
  it("filters by travel mode (any of the selected)", () => {
    expect(filterStores(stores, { modes: ["shuttle"] }).map((s) => s.id)).toEqual(["f"]);
    expect(filterStores(stores, { modes: ["shuttle", "bus"] }).map((s) => s.id)).toEqual(["g", "f", "i"]);
  });
  it("requires all selected accessibility features", () => {
    expect(filterStores(stores, { accessibility: ["step_free_entry"] }).map((s) => s.id)).toEqual(["g", "f"]);
    expect(filterStores(stores, { accessibility: ["step_free_entry", "accessible_aisles"] }).map((s) => s.id)).toEqual(["g"]);
  });
  it("finds stores stocking religious dietary items and international cuisines", () => {
    expect(filterStores(stores, { dietary: ["kosher"] }).map((s) => s.id)).toEqual(["i"]);
    expect(filterStores(stores, { cuisine: "korean" }).map((s) => s.id)).toEqual(["i"]);
  });
  it("filters budget-friendly stores and by search text", () => {
    expect(filterStores(stores, { budgetOnly: true }).map((s) => s.id)).toEqual(["g"]);
    expect(filterStores(stores, { query: "indian" }).map((s) => s.id)).toEqual(["i"]);
  });
});

describe("basket ranking with price + transit", () => {
  const products = [
    product({ id: "1", store_id: "g", name: "Eggs", current_price: 4 }),
    product({ id: "2", store_id: "g", name: "Rice", current_price: 6 }),
    product({ id: "3", store_id: "f", name: "Eggs", current_price: 3 }),
    product({ id: "4", store_id: "i", name: "Eggs", current_price: 2 }),
    product({ id: "5", store_id: "i", name: "Rice", current_price: 5 }),
  ];
  it("ranks by items found, then basket cost", () => {
    const r = rankStoresForBasket(["eggs", "rice"], stores, products, ["walking", "bus", "shuttle"], NOW);
    expect(r.map((x) => x.store.id)).toEqual(["i", "g", "f"]);
    expect(r[0].basketCost).toBe(7);
    expect(r[2].itemsMissing).toEqual(["rice"]);
  });
  it("excludes stores the student cannot reach", () => {
    const r = rankStoresForBasket(["eggs", "rice"], stores, products, ["walking"], NOW);
    expect(r.map((x) => x.store.id)).toEqual(["g", "f"]);
  });
});

describe("rating comparison against similar products (R6)", () => {
  const products = [
    product({ id: "p1", store_id: "f", name: "Eggs" }),
    product({ id: "p2", store_id: "g", name: "Eggs" }),
    product({ id: "p3", store_id: "i", name: "Eggs" }),
  ];
  const reviews: Review[] = [
    { id: "r1", store_id: "f", product_id: "p1", rating: 5 },
    { id: "r2", store_id: "f", product_id: "p1", rating: 5 },
    { id: "r3", store_id: "g", product_id: "p2", rating: 3 },
    { id: "r4", store_id: "i", product_id: "p3", rating: 4 },
    { id: "r5", store_id: "i", product_id: "p3", rating: 1, status: "hidden" },
  ];
  it("reports above-average when the product beats its peers, ignoring hidden reviews", () => {
    const c = compareProductRating("p1", products, reviews);
    expect(c.productAvg).toBe(5);
    expect(c.peerAvg).toBe(3.5);
    expect(c.delta).toBe(1.5);
    expect(c.verdict).toBe("above");
  });
  it("says not enough data when there are no reviews", () => {
    expect(compareProductRating("p1", products, []).verdict).toBe("not_enough_data");
  });
});

describe("recipe filters (R12, R19)", () => {
  const r = (o: Partial<Recipe> & { id: string }): Recipe => ({ title: o.id, cuisine: "American", ingredients: [], allergen_tags: [], dietary_tags: [], religious_compliance: [], est_cost: 5, minutes: 20, ...o });
  const recipes = [
    r({ id: "curry", cuisine: "Indian", dietary_tags: ["vegan", "gluten_free"], religious_compliance: ["halal", "kosher"] }),
    r({ id: "tofu", cuisine: "Korean", dietary_tags: ["vegan"], allergen_tags: ["soy", "wheat"], religious_compliance: ["halal"] }),
    r({ id: "noodles", allergen_tags: ["peanuts"], est_cost: 9 }),
  ];
  it("requires every selected dietary tag", () => {
    expect(filterRecipes(recipes, { dietary: ["vegan", "gluten_free"] }).map((x) => x.id)).toEqual(["curry"]);
  });
  it("requires every selected religious rule", () => {
    expect(filterRecipes(recipes, { religious: ["kosher"] }).map((x) => x.id)).toEqual(["curry"]);
  });
  it("excludes recipes containing any avoided allergen", () => {
    expect(filterRecipes(recipes, { excludeAllergens: ["soy", "peanuts"] }).map((x) => x.id)).toEqual(["curry"]);
  });
  it("filters by max cost", () => {
    expect(filterRecipes(recipes, { maxCost: 6 }).map((x) => x.id)).toEqual(["curry", "tofu"]);
  });
  it("maps a recipe to stores carrying its cuisine and compliance", () => {
    expect(storesForRecipe(recipes[0], stores).map((s) => s.id)).toEqual(["i"]);
  });
});

describe("moderation analytics (R27, R28)", () => {
  const rep = (o: Partial<Report> & { id: string }): Report => ({ target_type: "recipe_feedback", target_id: o.id, recipe_id: null, target_author_id: null, reason: "inaccurate", status: "open", ...o });
  const reports = [
    rep({ id: "1", recipe_id: "R1", target_author_id: "U1" }),
    rep({ id: "2", recipe_id: "R1", target_author_id: "U2", status: "actioned" }),
    rep({ id: "3", recipe_id: "R2", target_author_id: "U1", reason: "spam" }),
    rep({ id: "4", target_type: "store_review", target_author_id: "U3", reason: "inappropriate" }),
  ];
  it("flags recipes and users reported two or more times", () => {
    const issues = recurringIssues(reports);
    expect(issues.map((i) => `${i.kind}:${i.key}`).sort()).toEqual(["recipe:R1", "user:U1"]);
    const r1 = issues.find((i) => i.key === "R1")!;
    expect(r1.total).toBe(2);
    expect(r1.open).toBe(1);
  });
  it("lists only inaccurate recipe feedback reports", () => {
    expect(inaccuracyReports(reports).map((r) => r.id)).toEqual(["1", "2"]);
  });
});

describe("vendor price validation (R7)", () => {
  it("rejects promo prices that are not lower than the regular price", () => {
    expect(validatePriceUpdate(4, 4)).toMatch(/lower/);
    expect(validatePriceUpdate(4, 3)).toBeNull();
    expect(validatePriceUpdate(-1, null)).toMatch(/zero/);
  });
});
