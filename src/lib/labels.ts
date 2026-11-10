export const TRANSIT_LABELS: Record<string, string> = { walking: "Walking", bus: "Bus", shuttle: "Campus shuttle" };
export const ACCESS_LABELS: Record<string, string> = {
  step_free_entry: "Step-free entry",
  accessible_aisles: "Accessible aisles",
  accessible_restroom: "Accessible restroom",
};
export const VENDOR_LABELS: Record<string, string> = {
  grocery: "Grocery store",
  farmers_market: "Farmers' market",
  international_market: "International market",
};
export const DIETARY_LABELS: Record<string, string> = {
  vegan: "Vegan", vegetarian: "Vegetarian", gluten_free: "Gluten-free", dairy_free: "Dairy-free",
};
export const RELIGIOUS_LABELS: Record<string, string> = { halal: "Halal", kosher: "Kosher" };
export const ALLERGEN_LABELS: Record<string, string> = {
  peanuts: "Peanuts", tree_nuts: "Tree nuts", milk: "Milk", eggs: "Eggs", soy: "Soy", wheat: "Wheat", fish: "Fish", shellfish: "Shellfish", sesame: "Sesame",
};
export const ROLE_LABELS: Record<string, string> = {
  student: "Student", vendor: "Store owner / vendor", chef: "Chef", pantry_staff: "Pantry staff", moderator: "Moderator", admin: "Admin",
};
export const REASON_LABELS: Record<string, string> = {
  inappropriate: "Inappropriate", inaccurate: "Inaccurate", spam: "Spam", harassment: "Harassment", other: "Other",
};
export const label = (map: Record<string, string>, k: string) => map[k] ?? k;
