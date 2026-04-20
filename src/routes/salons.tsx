import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, MapPin, Clock, Scissors } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/salons")({
  head: () => ({ meta: [{ title: "Browse salons — SnipShop" }, { name: "description", content: "Find a salon near you and book your next haircut." }] }),
  component: SalonsPage,
});

type Salon = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  address: string | null;
  image_url: string | null;
  opening_time: string;
  closing_time: string;
};

function SalonsPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("salons").select("id,name,slug,description,city,address,image_url,opening_time,closing_time").order("created_at", { ascending: false })
      .then(({ data }) => { setSalons(data ?? []); setLoading(false); });
  }, []);

  const filtered = salons.filter(s =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.city ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold">Find your salon</h1>
          <p className="mt-2 text-muted-foreground">Browse local shops and book a slot in seconds.</p>
        </div>

        <div className="max-w-xl mx-auto relative mb-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or city..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-11 h-12 rounded-full shadow-soft" />
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Scissors className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{salons.length === 0 ? "No salons listed yet — be the first!" : "No matches for that search."}</p>
            {salons.length === 0 && (
              <Link to="/signup" className="mt-4 inline-block text-primary font-semibold hover:underline">List your salon →</Link>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((s) => (
              <Link key={s.id} to="/salons/$slug" params={{ slug: s.slug }}
                className="group rounded-3xl bg-card border border-border shadow-soft hover:shadow-playful overflow-hidden transition">
                <div className="aspect-video bg-gradient-card relative overflow-hidden">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Scissors className="h-12 w-12 text-primary-foreground/80" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-display text-xl font-bold group-hover:text-primary transition">{s.name}</h3>
                  {s.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {s.city ?? s.address ?? "—"}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {s.opening_time.slice(0,5)} – {s.closing_time.slice(0,5)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
