import { createFileRoute, Link } from "@tanstack/react-router";
import { Scissors, MessageCircle, Calendar, Sparkles, Users, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import heroImg from "@/assets/hero-salon.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SnipShop — Book Your Next Haircut in Seconds" },
      { name: "description", content: "Find local salons, book online or via WhatsApp, and skip the wait. SnipShop is the easiest way to book a haircut." },
      { property: "og:title", content: "SnipShop — Book Your Next Haircut in Seconds" },
      { property: "og:description", content: "Find local salons, book online or via WhatsApp, and skip the wait." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-10" />
        <div className="container mx-auto px-4 py-12 md:py-20 relative">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-sunny/30 px-4 py-1.5 text-sm font-semibold text-sunny-foreground mb-6">
                <Sparkles className="h-4 w-4" /> Now booking — online & WhatsApp
              </div>
              <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight">
                Your next great haircut, <span className="text-primary">one tap</span> away.
              </h1>
              <p className="mt-5 text-lg text-muted-foreground max-w-md">
                Browse local salons, pick your barber and slot, and walk in to a chair waiting just for you.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/salons">
                  <Button size="lg" className="rounded-full shadow-playful">
                    <MapPin className="mr-2 h-4 w-4" /> Find a salon
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="lg" variant="outline" className="rounded-full">
                    <Scissors className="mr-2 h-4 w-4" /> List your salon
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <img
                src={heroImg}
                alt="Friendly barbershop scene with happy customer and barber"
                width={1536}
                height={1024}
                className="rounded-3xl shadow-playful w-full h-auto animate-float"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold">Why salons & customers love it</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Built for everyone — from the busy shopkeeper to the regular getting his usual fade.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: MessageCircle, title: "WhatsApp booking", text: "Customers chat your salon's number and the bot handles the rest.", color: "bg-teal/15 text-teal" },
            { icon: Calendar, title: "Live calendar", text: "Online & offline bookings show up instantly — no double-booking.", color: "bg-coral/15 text-coral" },
            { icon: Users, title: "Smart customer tags", text: "Regulars get a special color so your barbers always know who's in.", color: "bg-sunny/30 text-sunny-foreground" },
          ].map((f, i) => (
            <div key={i} className="rounded-3xl border border-border bg-card p-6 shadow-soft hover:shadow-playful transition">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${f.color} mb-4`}>
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-16">
        <div className="rounded-3xl bg-gradient-hero p-8 md:p-12 text-center shadow-playful">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground">Run a salon? Get your shop online today.</h2>
          <p className="mt-3 text-primary-foreground/90 max-w-xl mx-auto">Free to start. Add your services, barbers, and start taking bookings in minutes.</p>
          <Link to="/signup">
            <Button size="lg" variant="secondary" className="mt-6 rounded-full shadow-playful">Get started — it's free</Button>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
