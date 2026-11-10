import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Leaf, LogOut, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasAnyRole, useSession, type Role } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const NAV: { to: string; label: string; roles?: Role[] }[] = [
  { to: "/stores", label: "Stores" },
  { to: "/compare", label: "Compare prices" },
  { to: "/recipes", label: "Recipes" },
  { to: "/pantry", label: "Pantry" },
  { to: "/vendor", label: "Vendor portal", roles: ["vendor"] },
  { to: "/chef", label: "Chef studio", roles: ["chef"] },
  { to: "/pantry-manage", label: "Manage pantry", roles: ["pantry_staff"] },
  { to: "/moderation", label: "Moderation", roles: ["moderator", "admin"] },
  { to: "/admin", label: "Insights", roles: ["admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !n.roles || hasAnyRole(data?.roles, n.roles));
  const primaryRole = data?.roles.find((r) => r !== "student") ?? "student";

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="glass-nav sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link to="/stores" className="flex items-center gap-1.5 font-semibold tracking-tight">
            <Leaf className="h-5 w-5 text-primary" /> Nourish.ly
          </Link>
          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {items.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "bg-secondary !text-foreground" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-xs leading-tight sm:block">
              <div className="font-medium">{data?.name}</div>
              <div className="text-muted-foreground">{ROLE_LABELS[primaryRole]}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut /></Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu"><Menu /></Button>
          </div>
        </div>
        <nav className={cn("border-t border-hairline px-5 py-3 lg:hidden", open ? "grid grid-cols-2 gap-1" : "hidden")}>
          {items.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm" activeProps={{ className: "bg-secondary font-medium" }}>
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 md:py-14">{children}</main>
    </div>
  );
}
