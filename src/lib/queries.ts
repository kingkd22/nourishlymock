import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const must = <T,>(r: { data: T | null; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

export const storesQuery = queryOptions({ queryKey: ["stores"], queryFn: async () => must(await supabase.from("stores").select("*").order("distance_miles")) });
export const productsQuery = queryOptions({ queryKey: ["products"], queryFn: async () => must(await supabase.from("products").select("*").order("name")) });
export const reviewsQuery = queryOptions({ queryKey: ["reviews"], queryFn: async () => must(await supabase.from("store_reviews").select("*").order("created_at", { ascending: false })) });
export const announcementsQuery = queryOptions({ queryKey: ["announcements"], queryFn: async () => must(await supabase.from("announcements").select("*, stores(name, vendor_type)").order("created_at", { ascending: false })) });
export const recipesQuery = queryOptions({ queryKey: ["recipes"], queryFn: async () => must(await supabase.from("recipes").select("*").order("created_at", { ascending: false })) });
export const feedbackQuery = (recipeId: string) => queryOptions({ queryKey: ["feedback", recipeId], queryFn: async () => must(await supabase.from("recipe_feedback").select("*").eq("recipe_id", recipeId).order("created_at", { ascending: false })) });
export const pantryQuery = queryOptions({
  queryKey: ["pantry"],
  queryFn: async () => {
    const [p, posts, events] = await Promise.all([
      supabase.from("pantries").select("*"),
      supabase.from("pantry_posts").select("*").order("created_at", { ascending: false }),
      supabase.from("pantry_events").select("*").gte("starts_at", new Date(Date.now() - 86400000).toISOString()).order("starts_at"),
    ]);
    return { pantries: must(p), posts: must(posts), events: must(events) };
  },
});
export const reportsQuery = queryOptions({ queryKey: ["reports"], queryFn: async () => must(await supabase.from("flagged_reports").select("*").order("created_at", { ascending: false })) });
export const profilesQuery = queryOptions({ queryKey: ["profiles"], queryFn: async () => must(await supabase.from("profiles").select("id, display_name")) });
