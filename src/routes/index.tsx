import { createFileRoute, Link } from "@tanstack/react-router";
import { Leaf, Bus, Tag, ChefHat, HeartHandshake, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nourish.ly — Eat well on a student budget" },
      { name: "description", content: "Compare grocery and farmers' market prices, find stores you can reach, inclusive recipes and campus pantry updates." },
      { property: "og:title", content: "Nourish.ly — Eat well on a student budget" },
      { property: "og:description", content: "Smart grocery planning for students: prices, transit, recipes and pantry in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Tag, title: "Real prices, side by side", body: "Grocery stores and farmers' market stands, with live promotions." },
  { icon: Bus, title: "Stores you can actually reach", body: "Filter by walking, bus or campus shuttle — and accessibility needs." },
  { icon: ChefHat, title: "Recipes for every table", body: "Halal, kosher, vegan, gluten-free and allergen-aware cooking." },
  { icon: HeartHandshake, title: "Campus pantry, in your pocket", body: "Hours, fresh arrivals and upcoming food distributions." },
  { icon: ShieldCheck, title: "A trustworthy community", body: "Reviews and feedback are moderated to stay helpful and kind." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="glass-nav sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-5">
          <span className="flex items-center gap-1.5 font-semibold"><Leaf className="h-5 w-5 text-primary" /> Nourish.ly</span>
          <Button asChild size="sm" variant="ink" className="ml-auto"><Link to="/auth" search={{ redirect: undefined }}>Sign in</Link></Button>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-24 text-center md:pt-32">
        <p className="eyebrow fade-up">For students who cook for themselves</p>
        <h1 className="display-title fade-up mt-4 text-5xl md:text-7xl">
          Eat well.<br /><span className="text-gradient-fresh">Spend less.</span>
        </h1>
        <p className="fade-up mx-auto mt-6 max-w-2xl text-xl text-muted-foreground">
          Nourish.ly brings prices, transit, recipes and your campus pantry together — so a tight budget never means going without.
        </p>
        <div className="fade-up mt-10 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth" search={{ redirect: undefined }}>Get started</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth" search={{ redirect: undefined }}>I have an account</Link></Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="surface-card p-7">
            <f.icon className="h-7 w-7 text-primary" />
            <h3 className="mt-5 text-xl font-semibold">{f.title}</h3>
            <p className="mt-2 text-muted-foreground">{f.body}</p>
          </div>
        ))}
        <div className="surface-card flex flex-col justify-center bg-foreground p-7 text-background">
          <p className="display-title text-5xl">23%</p>
          <p className="mt-2 opacity-80">of undergraduates face food insecurity. We're here to help before it gets there.</p>
        </div>
      </section>
    </div>
  );
}
