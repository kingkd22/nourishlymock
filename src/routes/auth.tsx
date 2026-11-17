import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Leaf } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/common";
import { ROLE_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined }),
  head: () => ({
    meta: [
      { title: "Sign in — Nourish.ly" },
      { name: "description", content: "Sign in or create your Nourish.ly account." },
      { property: "og:title", content: "Sign in — Nourish.ly" },
      { property: "og:description", content: "Sign in or create your Nourish.ly account." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  name: z.string().trim().max(60).optional(),
});

function safePath(p?: string) {
  if (!p) return "/stores";
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/stores";
  } catch { return "/stores"; }
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, name });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      navigate({ href: safePath(redirect), replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email, password,
        options: { emailRedirectTo: window.location.origin + "/stores", data: { display_name: parsed.data.name, requested_role: role } },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) navigate({ href: "/stores", replace: true });
      else toast.success("Check your email to confirm your account.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-md fade-up">
        <div className="mb-8 text-center">
          <Leaf className="mx-auto h-9 w-9 text-primary" />
          <h1 className="display-title mt-4 text-4xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-muted-foreground">Nourish.ly — eat well on a student budget.</p>
        </div>
        <form onSubmit={submit} className="surface-card space-y-4 p-7">
          {mode === "signup" && (
            <>
              <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-2">
                <Label>I am a…</Label>
                <div className="flex flex-wrap gap-2">
                  {["student", "vendor", "chef", "pantry_staff"].map((r) => (
                    <Chip key={r} active={role === r} onClick={() => setRole(r)}>{ROLE_LABELS[r]}</Chip>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" /></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" /></div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{mode === "signin" ? "Sign in" : "Create account"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to Nourish.ly?" : "Already have an account?"}{" "}
            <button type="button" className="font-medium text-primary" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
