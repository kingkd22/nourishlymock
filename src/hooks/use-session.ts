import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "student" | "vendor" | "chef" | "pantry_staff" | "moderator" | "admin";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return { user: null, roles: [] as Role[], name: "" };
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      ]);
      return {
        user,
        roles: (roles ?? []).map((r) => r.role as Role),
        name: profile?.display_name ?? user.email ?? "",
      };
    },
    staleTime: 60_000,
  });
}

export function hasAnyRole(roles: Role[] | undefined, wanted: Role[]) {
  return !!roles?.some((r) => wanted.includes(r));
}
