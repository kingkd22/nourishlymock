import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin, Mail, Package } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/common";
import { pantryQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/pantry")({
  head: () => ({ meta: [{ title: "Campus pantry — Nourish.ly" }, { name: "description", content: "Campus food pantry hours, location, available items and upcoming distributions." }, { property: "og:title", content: "Campus pantry — Nourish.ly" }, { property: "og:description", content: "Pantry hours, items and events." }] }),
  component: PantryPage,
});

function PantryPage() {
  const { data, isLoading } = useQuery(pantryQuery);
  if (isLoading) return <div className="surface-card h-60 animate-pulse" />;
  return (
    <>
      <PageHeader eyebrow="Campus pantry" title="Free food, no shame." subtitle="Everything your campus pantry has right now — and what's coming up." />
      {data?.pantries.map((p) => (
        <div key={p.id} className="surface-card mb-8 grid gap-6 bg-foreground p-8 text-background md:grid-cols-3">
          <div className="md:col-span-3"><h2 className="text-2xl font-semibold">{p.name}</h2></div>
          <div className="flex gap-2"><MapPin className="h-5 w-5 shrink-0 opacity-70" />{p.location}</div>
          <div className="flex gap-2"><Clock className="h-5 w-5 shrink-0 opacity-70" />{p.hours}</div>
          <div className="flex gap-2"><Mail className="h-5 w-5 shrink-0 opacity-70" />{p.contact}</div>
        </div>
      ))}
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-2xl font-semibold">Available now</h2>
          {data?.posts.length === 0 && <EmptyState title="No announcements yet" />}
          <div className="space-y-3">{data?.posts.map((post) => (
            <div key={post.id} className="surface-card p-6">
              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.created_at))} ago</p>
              <p className="mt-1 text-lg font-semibold">{post.title}</p>
              {post.body && <p className="text-muted-foreground">{post.body}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">{post.items.map((i) => <Badge key={i} variant="fresh"><Package className="mr-1 h-3 w-3" />{i}</Badge>)}</div>
            </div>
          ))}</div>
        </section>
        <section>
          <h2 className="mb-4 text-2xl font-semibold">Upcoming distributions</h2>
          {data?.events.length === 0 && <EmptyState title="No upcoming events" />}
          <div className="space-y-3">{data?.events.map((e) => (
            <div key={e.id} className="surface-card flex gap-5 p-6">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent text-accent-foreground"><span className="text-xs uppercase">{format(new Date(e.starts_at), "MMM")}</span><span className="text-2xl font-bold">{format(new Date(e.starts_at), "d")}</span></div>
              <div><p className="text-lg font-semibold">{e.title}</p><p className="flex items-center gap-1 text-sm text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(e.starts_at), "EEE p")}{e.ends_at ? ` – ${format(new Date(e.ends_at), "p")}` : ""} · {e.location}</p><p className="mt-1 text-sm">{e.details}</p></div>
            </div>
          ))}</div>
        </section>
      </div>
    </>
  );
}
