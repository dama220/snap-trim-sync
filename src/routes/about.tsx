import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { MessageCircle, Calendar, Users, Scissors, Sparkles } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "How it works — SnipShop" }, { name: "description", content: "How SnipShop helps salons take bookings online, offline, and via WhatsApp." }] }),
  component: About,
});

function About() {
  const steps = [
    { icon: Scissors, title: "Sign up your salon", text: "Create your account and add your services, barbers, and hours in minutes." },
    { icon: MessageCircle, title: "Connect WhatsApp", text: "Hook up your Twilio WhatsApp number — customers can book by chat." },
    { icon: Calendar, title: "Take bookings everywhere", text: "Online, walk-in, or via WhatsApp — they all show up on one calendar." },
    { icon: Users, title: "Recognize regulars", text: "Repeat customers get tagged automatically so your barbers know who's in." },
  ];
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12 flex-1 max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-sunny/30 px-4 py-1.5 text-sm font-semibold text-sunny-foreground mb-4">
            <Sparkles className="h-4 w-4" /> Built for busy salons
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold">How SnipShop works</h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">A complete booking solution for haircut shops — online site, walk-in entry, and WhatsApp bot, all on one dashboard.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-card text-primary-foreground mb-3">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-bold">{i + 1}. {s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-gradient-hero p-8 text-center shadow-playful">
          <h2 className="font-display text-2xl font-bold text-primary-foreground">Ready to get bookings?</h2>
          <Link to="/signup">
            <Button size="lg" variant="secondary" className="mt-4 rounded-full shadow-playful">Create your salon</Button>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
