/**
 * Nourish.ly business logic — pure, framework-free functions.
 * Every rule the UI relies on lives here so it can be unit tested.
 */

export type TransitMode = "walking" | "bus" | "shuttle";
export type VendorType = "grocery" | "farmers_market" | "international_market";

export interface Store {
  id: string;
  name: string;
  vendor_type: string;
  distance_miles: number;
  transit_modes: string[];
  accessibility_flags: string[];
  dietary_stock: string[];
  cuisines: string[];
  budget_friendly: boolean;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  category: string;
  unit: string;
  current_price: number;
  promo_price: number | null;
  promo_label?: string | null;
  promo_ends_at: string | null;
  origin?: string;
  producer?: string;
}

export interface Review {
  id: string;
  store_id: string;
  product_id: string | null;
  rating: number;
  status?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  cuisine: string;
  ingredients: string[];
  allergen_tags: string[];
  dietary_tags: string[];
  religious_compliance: string[];
  est_cost: number;
  minutes: number;
}

export interface Report {
  id: string;
  target_type: string;
  target_id: string;
  recipe_id: string | null;
  target_author_id: string | null;
  reason: string;
  status: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/* ---------- Pricing (R2, R7, R8) ---------- */

/** A promo applies only when it exists, is cheaper, and has not expired. */
export function isPromoActive(p: Product, now: Date = new Date()): boolean {
  if (p.promo_price == null) return false;
  if (Number(p.promo_price) >= Number(p.current_price)) return false;
  if (p.promo_ends_at && new Date(p.promo_ends_at).getTime() <= now.getTime()) return false;
  return true;
}

export function effectivePrice(p: Product, now: Date = new Date()): number {
  return isPromoActive(p, now) ? Number(p.promo_price) : Number(p.current_price);
}

export interface ComparisonRow {
  product: Product;
  store: Store;
  price: number;
  onPromo: boolean;
  savingsVsHighest: number;
  isCheapest: boolean;
}

/** Side-by-side comparison of one item across grocery stores and farmers' market stands. */
export function compareItem(
  itemName: string,
  products: Product[],
  stores: Store[],
  now: Date = new Date(),
): ComparisonRow[] {
  const storeById = new Map(stores.map((s) => [s.id, s]));
  const rows = products
    .filter((p) => norm(p.name) === norm(itemName) && storeById.has(p.store_id))
    .map((p) => ({
      product: p,
      store: storeById.get(p.store_id)!,
      price: effectivePrice(p, now),
      onPromo: isPromoActive(p, now),
    }))
    .sort((a, b) => a.price - b.price || a.store.distance_miles - b.store.distance_miles);
  if (rows.length === 0) return [];
  const highest = Math.max(...rows.map((r) => r.price));
  const lowest = rows[0]!.price;
  return rows.map((r) => ({
    ...r,
    savingsVsHighest: round2(highest - r.price),
    isCheapest: r.price === lowest,
  }));
}

/** Distinct item names that appear in at least `minStores` stores (comparable items). */
export function comparableItems(products: Product[], minStores = 2): string[] {
  const map = new Map<string, { label: string; stores: Set<string> }>();
  for (const p of products) {
    const k = norm(p.name);
    if (!map.has(k)) map.set(k, { label: p.name, stores: new Set() });
    map.get(k)!.stores.add(p.store_id);
  }
  return [...map.values()]
    .filter((v) => v.stores.size >= minStores)
    .map((v) => v.label)
    .sort((a, b) => a.localeCompare(b));
}

/* ---------- Transit & store finder (R9, R10, R11, R13, R14, R15, R16) ---------- */

const SPEED: Record<TransitMode, { minPerMile: number; overhead: number }> = {
  walking: { minPerMile: 20, overhead: 0 },
  bus: { minPerMile: 4, overhead: 10 },
  shuttle: { minPerMile: 4, overhead: 6 },
};

/** Estimated one-way travel minutes, or null if the store isn't reachable by that mode. */
export function travelMinutes(store: Store, mode: TransitMode): number | null {
  if (!store.transit_modes.includes(mode)) return null;
  const s = SPEED[mode];
  return Math.round(store.distance_miles * s.minPerMile + s.overhead);
}

/** Fastest available mode for a store among the allowed modes. */
export function fastestRoute(
  store: Store,
  allowed: TransitMode[] = ["walking", "bus", "shuttle"],
): { mode: TransitMode; minutes: number } | null {
  let best: { mode: TransitMode; minutes: number } | null = null;
  for (const m of allowed) {
    const t = travelMinutes(store, m);
    if (t != null && (!best || t < best.minutes)) best = { mode: m, minutes: t };
  }
  return best;
}

export interface StoreFilters {
  query?: string;
  modes?: TransitMode[]; // reachable by ANY selected mode
  accessibility?: string[]; // must have ALL
  dietary?: string[]; // must stock ALL (halal, kosher)
  cuisine?: string; // must carry this cuisine
  vendorTypes?: string[]; // ANY
  budgetOnly?: boolean;
}

export function filterStores(stores: Store[], f: StoreFilters): Store[] {
  const q = f.query ? norm(f.query) : "";
  return stores.filter((s) => {
    if (q && !norm(s.name).includes(q) && !s.cuisines.some((c) => norm(c).includes(q))) return false;
    if (f.modes?.length && !f.modes.some((m) => s.transit_modes.includes(m))) return false;
    if (f.accessibility?.length && !f.accessibility.every((a) => s.accessibility_flags.includes(a)))
      return false;
    if (f.dietary?.length && !f.dietary.every((d) => s.dietary_stock.includes(d))) return false;
    if (f.cuisine && !s.cuisines.some((c) => norm(c) === norm(f.cuisine!))) return false;
    if (f.vendorTypes?.length && !f.vendorTypes.includes(s.vendor_type)) return false;
    if (f.budgetOnly && !s.budget_friendly) return false;
    return true;
  });
}

export interface StoreRanking {
  store: Store;
  basketCost: number;
  itemsFound: number;
  itemsMissing: string[];
  route: { mode: TransitMode; minutes: number } | null;
}

/**
 * Algorithmic price + transit matching: for a shopping basket, rank reachable stores by
 * coverage (most items found), then basket cost (with live promos), then travel time.
 */
export function rankStoresForBasket(
  basket: string[],
  stores: Store[],
  products: Product[],
  modes: TransitMode[] = ["walking", "bus", "shuttle"],
  now: Date = new Date(),
): StoreRanking[] {
  const items = [...new Set(basket.map(norm).filter(Boolean))];
  return stores
    .map((store) => {
      const route = fastestRoute(store, modes);
      const own = products.filter((p) => p.store_id === store.id);
      let cost = 0;
      const missing: string[] = [];
      for (const item of items) {
        const matches = own.filter((p) => norm(p.name) === item);
        if (matches.length === 0) missing.push(item);
        else cost += Math.min(...matches.map((p) => effectivePrice(p, now)));
      }
      return {
        store,
        basketCost: round2(cost),
        itemsFound: items.length - missing.length,
        itemsMissing: missing,
        route,
      };
    })
    .filter((r) => r.route !== null && r.itemsFound > 0)
    .sort(
      (a, b) =>
        b.itemsFound - a.itemsFound ||
        a.basketCost - b.basketCost ||
        a.route!.minutes - b.route!.minutes,
    );
}

/* ---------- Ratings (R4, R6) ---------- */

export function averageRating(reviews: Pick<Review, "rating">[]): number | null {
  if (reviews.length === 0) return null;
  return round1(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);
}

export interface RatingComparison {
  productAvg: number | null;
  productCount: number;
  peerAvg: number | null;
  peerCount: number;
  delta: number | null;
  verdict: "above" | "below" | "on_par" | "not_enough_data";
}

/** Compare a product's rating to similar products (same name or category) at other stores. */
export function compareProductRating(
  productId: string,
  products: Product[],
  reviews: Review[],
): RatingComparison {
  const target = products.find((p) => p.id === productId);
  const visible = reviews.filter((r) => (r.status ?? "visible") === "visible" && r.product_id);
  const own = visible.filter((r) => r.product_id === productId);
  if (!target) return emptyComparison(own.length);
  const peerIds = new Set(
    products
      .filter(
        (p) =>
          p.id !== productId &&
          p.store_id !== target.store_id &&
          (norm(p.name) === norm(target.name) || p.category === target.category),
      )
      .map((p) => p.id),
  );
  const peers = visible.filter((r) => peerIds.has(r.product_id!));
  const productAvg = averageRating(own);
  const peerAvg = averageRating(peers);
  if (productAvg == null || peerAvg == null) {
    return { productAvg, productCount: own.length, peerAvg, peerCount: peers.length, delta: null, verdict: "not_enough_data" };
  }
  const delta = round1(productAvg - peerAvg);
  const verdict = delta >= 0.3 ? "above" : delta <= -0.3 ? "below" : "on_par";
  return { productAvg, productCount: own.length, peerAvg, peerCount: peers.length, delta, verdict };
}

function emptyComparison(n: number): RatingComparison {
  return { productAvg: null, productCount: n, peerAvg: null, peerCount: 0, delta: null, verdict: "not_enough_data" };
}

/* ---------- Recipes (R12, R17, R18, R19) ---------- */

export interface RecipeFilters {
  query?: string;
  dietary?: string[]; // must have ALL
  religious?: string[]; // must comply with ALL
  excludeAllergens?: string[]; // must contain NONE
  cuisine?: string;
  maxCost?: number;
}

export function filterRecipes<T extends Recipe>(recipes: T[], f: RecipeFilters): T[] {
  const q = f.query ? norm(f.query) : "";
  return recipes.filter((r) => {
    if (
      q &&
      !norm(r.title).includes(q) &&
      !norm(r.cuisine).includes(q) &&
      !r.ingredients.some((i) => norm(i).includes(q))
    )
      return false;
    if (f.dietary?.length && !f.dietary.every((d) => r.dietary_tags.includes(d))) return false;
    if (f.religious?.length && !f.religious.every((d) => r.religious_compliance.includes(d))) return false;
    if (f.excludeAllergens?.length && f.excludeAllergens.some((a) => r.allergen_tags.includes(a))) return false;
    if (f.cuisine && norm(r.cuisine) !== norm(f.cuisine)) return false;
    if (f.maxCost != null && Number(r.est_cost) > f.maxCost) return false;
    return true;
  });
}

/** Stores that carry a recipe's cuisine and its religious-compliance requirements. */
export function storesForRecipe(recipe: Recipe, stores: Store[]): Store[] {
  return stores
    .filter(
      (s) =>
        s.cuisines.some((c) => norm(c) === norm(recipe.cuisine)) &&
        recipe.religious_compliance.every((rc) => s.dietary_stock.includes(rc) || false),
    )
    .sort((a, b) => a.distance_miles - b.distance_miles);
}

/* ---------- Moderation analytics (R27, R28) ---------- */

export interface RecurringIssue {
  key: string;
  kind: "recipe" | "user";
  total: number;
  open: number;
  reasons: Record<string, number>;
}

/** Group reports by recipe and by reported author; anything reported 2+ times is recurring. */
export function recurringIssues(reports: Report[], threshold = 2): RecurringIssue[] {
  const groups = new Map<string, RecurringIssue>();
  const add = (kind: "recipe" | "user", key: string | null, r: Report) => {
    if (!key) return;
    const id = `${kind}:${key}`;
    const g = groups.get(id) ?? { key, kind, total: 0, open: 0, reasons: {} };
    g.total += 1;
    if (r.status === "open") g.open += 1;
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    groups.set(id, g);
  };
  for (const r of reports) {
    add("recipe", r.recipe_id, r);
    add("user", r.target_author_id, r);
  }
  return [...groups.values()]
    .filter((g) => g.total >= threshold)
    .sort((a, b) => b.total - a.total || b.open - a.open);
}

export function inaccuracyReports<T extends Report>(reports: T[]): T[] {
  return reports.filter((r) => r.reason === "inaccurate" && r.target_type === "recipe_feedback");
}

/* ---------- Validation helpers ---------- */

export function validatePriceUpdate(current: number, promo: number | null): string | null {
  if (!Number.isFinite(current) || current < 0) return "Price must be zero or more.";
  if (current > 9999) return "Price looks too high.";
  if (promo != null) {
    if (!Number.isFinite(promo) || promo < 0) return "Promo price must be zero or more.";
    if (promo >= current) return "Promo price must be lower than the regular price.";
  }
  return null;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export const formatPrice = (n: number) => `$${Number(n).toFixed(2)}`;
