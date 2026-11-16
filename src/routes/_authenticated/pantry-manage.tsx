import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, RoleGate } from "@/components/common";
import { pantryQuery } from "@/lib/queries";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/pantry-manage")({
  head: () => ({ meta: [{ title: "Manage pantry — Nourish.ly" }, { name: "description", content: "Publish pantry hours, items and distribution events." }, { property: "og:title", content: "Manage pantry — Nourish.ly" }, { property: "og:description", content: "Pantry staff tools." }] }),
  component: () => <RoleGate roles={["pantry_staff"]}><Manage /></RoleGate>,
});

function Manage() {
  const { data } = useQuery(pantryQuery);
  const qc = useQueryClient();
  const pantry = data?.pantries[0];
  const refresh = () => qc.invalidateQueries({ queryKey: ["pantry"] });
  const [info, setInfo] = useState({ location: "", hours: "", contact: "" });
  useEffect(() => { if (pantry) setInfo({ location: pantry.location, hours: pantry.hours, contact: pantry.contact }); }, [pantry?.id]);
  const [post, setPost] = useState({ title: "", body: "", items: "" });
  const [ev, setEv] = useState({ title: "", details: "", location: "", start: "", end: "" });
  if (!pantry) return <div className="surface-card h-40 animate-pulse" />;

  async function saveInfo() {
    const { error } = await supabase.from("pantries").update({ ...info, updated_at: new Date().toISOString() }).eq("id", pantry!.id);
    if (error) return toast.error(error.message); toast.success("Hours & location published"); refresh();
  }
  async function addPost() {
    if (post.title.trim().length < 2) return toast.error("Add a title.");
    const { error } = await supabase.from("pantry_posts").insert({ pantry_id: pantry!.id, title: post.title.trim(), body: post.body.trim(), items: post.items.split(",").map((s) => s.trim()).filter(Boolean) });
    if (error) return toast.error(error.message); toast.success("Announcement posted"); setPost({ title: "", body: "", items: "" }); refresh();
  }
  async function addEvent() {
    if (ev.title.trim().length < 2 || !ev.start) return toast.error("Add a title and start time.");
    const { error } = await supabase.from("pantry_events").insert({ pantry_id: pantry!.id, title: ev.title.trim(), details: ev.details, location: ev.location, starts_at: new Date(ev.start).toISOString(), ends_at: ev.end ? new Date(ev.end).toISOString() : null });
    if (error) return toast.error(error.message); toast.success("Event published"); setEv({ title: "", details: "", location: "", start: "", end: "" }); refresh();
  }
  async function del(table: "pantry_posts" | "pantry_events", id: string) { await supabase.from(table).delete().eq("id", id); refresh(); }

  return (
    <>
      <PageHeader eyebrow="Pantry staff" title={pantry.name} subtitle="Everything you publish here appears on the student pantry page instantly." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card space-y-3 p-6"><h2 className="text-lg font-semibold">Hours & location</h2><Input aria-label="Location" value={info.location} onChange={(e) => setInfo({ ...info, location: e.target.value })} /><Input aria-label="Hours" value={info.hours} onChange={(e) => setInfo({ ...info, hours: e.target.value })} /><Input aria-label="Contact" value={info.contact} onChange={(e) => setInfo({ ...info, contact: e.target.value })} /><Button onClick={saveInfo}>Publish</Button></div>
        <div className="surface-card space-y-3 p-6"><h2 className="text-lg font-semibold">Available items</h2><Input aria-label="Announcement title" placeholder="Title" value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} /><Textarea placeholder="Details" value={post.body} onChange={(e) => setPost({ ...post, body: e.target.value })} /><Input aria-label="Items" placeholder="Items, comma separated" value={post.items} onChange={(e) => setPost({ ...post, items: e.target.value })} /><Button onClick={addPost}>Post announcement</Button></div>
        <div className="surface-card space-y-3 p-6"><h2 className="text-lg font-semibold">Distribution event</h2><Input aria-label="Event title" placeholder="Title" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} /><Input placeholder="Location" value={ev.location} onChange={(e) => setEv({ ...ev, location: e.target.value })} /><label className="text-xs text-muted-foreground">Starts<Input aria-label="Starts" type="datetime-local" value={ev.start} onChange={(e) => setEv({ ...ev, start: e.target.value })} /></label><label className="text-xs text-muted-foreground">Ends<Input aria-label="Ends" type="datetime-local" value={ev.end} onChange={(e) => setEv({ ...ev, end: e.target.value })} /></label><Textarea placeholder="Details" value={ev.details} onChange={(e) => setEv({ ...ev, details: e.target.value })} /><Button onClick={addEvent}>Publish event</Button></div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">{data!.posts.map((p) => <div key={p.id} className="surface-card flex justify-between p-4"><span>{p.title}</span><Button size="sm" variant="ghost" onClick={() => del("pantry_posts", p.id)}>Remove</Button></div>)}</div>
        <div className="space-y-2">{data!.events.map((e) => <div key={e.id} className="surface-card flex justify-between p-4"><span>{e.title} · {format(new Date(e.starts_at), "MMM d")}</span><Button size="sm" variant="ghost" onClick={() => del("pantry_events", e.id)}>Remove</Button></div>)}</div>
      </div>
    </>
  );
}
