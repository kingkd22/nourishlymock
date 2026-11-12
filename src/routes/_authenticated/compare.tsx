import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Chip, EmptyState, PageHeader, toggle } from "@/components/common";
import { productsQuery, storesQuery } from "@/lib/queries";
import { compareItem, comparableItems, formatPrice, rankStoresForBasket, type Product, type Store, type TransitMode } from "@/lib/nourish";
import { TRANSIT_LABELS, VENDOR_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({ meta: [{ title: "Compare prices — Nourish.ly" }, { name: "description", content: "Grocery vs farmers' market prices side by side, with live promotions." }, { property: "og:title", content: "Compare prices — Nourish.ly" }, { property: "og:description", content: "Grocery vs farmers' market prices side by side." }] }),
  component: ComparePage,
});

function ComparePage() {
  const s = useQuery(storesQuery);
  const p = useQuery(productsQuery);
  const stores = (s.data ?? []) as unknown as Store[];
  const products = (p.data ?? []) as unknown as Product[];
  const items = useMemo(() => comparableItems(products), [products]);
  const [basket, setBasket] = useState<string[]>(["Eggs", "Spinach"]);
  const [modes, setModes] = useState<TransitMode[]>(["walking", "bus", "shuttle"]);
  const ranking = useMemo(() => rankStoresForBasket(basket, stores, products, modes), [basket, stores, products, modes]);

  return (
    <>
      <PageHeader eyebrow="Price & promo engine" title="Every price. One view." subtitle="Build a basket and we'll find the cheapest store you can actually get to. Prices update the moment vendors change them." />
      <div className="surface-card mb-8 space-y-5 p-6">
        <div><p className="eyebrow mb-2.5">Your basket</p><div className="flex flex-wrap gap-2">{items.map((i) => <Chip key={i} active={basket.includes(i)} onClick={() => setBasket(toggle(basket, i))}>{i}</Chip>)}</div></div>
        <div><p className="eyebrow mb-2.5">I can travel by</p><div className="flex flex-wrap gap-2">{(["walking", "bus", "shuttle"] as TransitMode[]).map((m) => <Chip key={m} active={modes.includes(m)} onClick={() => setModes(toggle(modes, m))}>{TRANSIT_LABELS[m]}</Chip>)}</div></div>
      </div>

      <h2 className="mb-4 text-2xl font-semibold">Best stores for your basket</h2>
      {basket.length === 0 ? <EmptyState title="Add items to your basket" /> : ranking.length === 0 ? <EmptyState title="No reachable stores carry these items" body="Try another travel mode." /> : (
        <div className="mb-12 grid gap-4 md:grid-cols-3">
          {ranking.slice(0, 3).map((r, i) => (
            <Link key={r.store.id} to="/stores/$storeId" params={{ storeId: r.store.id }} className={`surface-card p-6 ${i === 0 ? "ring-2 ring-primary" : ""}`}>
              {i === 0 && <Badge variant="fresh" className="mb-2"><Trophy className="mr-1 h-3 w-3" />Best match</Badge>}
              <p className="font-semibold">{r.store.name}</p>
              <p className="display-title mt-3 text-4xl">{formatPrice(r.basketCost)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.itemsFound}/{basket.length} items · {TRANSIT_LABELS[r.route!.mode]} {r.route!.minutes} min</p>
              {r.itemsMissing.length > 0 && <p className="mt-2 text-xs text-warning">Missing: {r.itemsMissing.join(", ")}</p>}
            </Link>
          ))}
        </div>
      )}

      <h2 className="mb-4 text-2xl font-semibold">Item by item</h2>
      <div className="space-y-6">
        {(basket.length ? basket : items).map((item) => {
          const rows = compareItem(item, products, stores);
          return (
            <div key={item} className="surface-card overflow-hidden">
              <div className="border-b border-hairline px-6 py-4 font-semibold">{item}</div>
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.product.id} className="border-b border-hairline last:border-0">
                      <td className="px-6 py-3"><p className="font-medium">{r.store.name}</p><p className="text-xs text-muted-foreground">{VENDOR_LABELS[r.store.vendor_type]} · per {r.product.unit}</p></td>
                      <td className="px-3">{r.onPromo && <Badge variant="promo">{r.product.promo_label || "Promo"}</Badge>}</td>
                      <td className="px-6 text-right"><span className={`text-base font-semibold ${r.isCheapest ? "text-primary" : ""}`}>{formatPrice(r.price)}</span>{r.savingsVsHighest > 0 && <p className="text-xs text-muted-foreground">Save {formatPrice(r.savingsVsHighest)}</p>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </>
  );
}
