import { createFileRoute, Link, Outlet, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Scissors, Users, Settings, UserSquare2, Plus, LogOut } from "lucide-react";
import { useAuth, slugify } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SnipShop" }, { name: "description", content: "Manage your salon bookings." }] }),
  component: DashboardLayout,
});

export type Salon = { id: string; name: string; slug: string; opening_time: string; closing_time: string; whatsapp_number: string | null };

export const SalonContext = (() => {
  // simple shared store via window event; child routes read via hook
  return null;
})();

export function useSalon() {
  const [salon, setSalon] = useState<Salon | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data } = await supabase.from("salons").select("id,name,slug,opening_time,closing_time,whatsapp_number").eq("owner_id", u.user.id).order("created_at").limit(1).maybeSingle();
      setSalon(data as Salon | null);
      setLoading(false);
    };
    load();
    const h = () => load();
    window.addEventListener("salon-updated", h);
    return () => window.removeEventListener("salon-updated", h);
  }, []);
  return { salon, loading };
}

function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { salon, loading: salonLoading } = useSalon();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || salonLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return null;

  if (!salon) {
    // Onboarding: create first salon
    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreating(true);
      const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from("salons").insert({ name, city, slug, owner_id: user.id });
      setCreating(false);
      if (error) return toast.error(error.message);
      toast.success("Salon created! 🎉");
      window.dispatchEvent(new Event("salon-updated"));
    };
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-hero/5">
        <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-playful border border-border">
          <h1 className="font-display text-2xl font-bold text-center">Set up your salon ✂️</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">Just a name and city to get started.</p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div><Label>Salon name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 rounded-xl" /></div>
            <div><Label>City</Label><Input required value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5 rounded-xl" /></div>
            <Button type="submit" disabled={creating || !name} size="lg" className="w-full rounded-full shadow-playful">{creating ? "Creating..." : "Create salon"}</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-muted/20">
      {/* Sidebar */}
      <aside className="md:w-64 bg-sidebar border-r border-sidebar-border md:min-h-screen">
        <div className="p-5 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-gradient-card flex items-center justify-center shadow-playful">
              <Scissors className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">{salon.name}</span>
          </Link>
        </div>
        <nav className="p-3 space-y-1">
          <NavItem to="/dashboard" icon={Calendar} label="Bookings" exact />
          <NavItem to="/dashboard/services" icon={Scissors} label="Services" />
          <NavItem to="/dashboard/barbers" icon={UserSquare2} label="Barbers" />
          <NavItem to="/dashboard/customers" icon={Users} label="Customers" />
          <NavItem to="/dashboard/settings" icon={Settings} label="Settings" />
        </nav>
        <div className="p-3 border-t border-sidebar-border md:absolute md:bottom-0 md:w-64 bg-sidebar">
          <Link to="/salons/$slug" params={{ slug: salon.slug }} className="block text-xs text-muted-foreground hover:text-foreground mb-2 px-3">View public page →</Link>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, exact }: { to: string; icon: any; label: string; exact?: boolean }) {
  const loc = useLocation();
  const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
  return (
    <Link to={to} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
      active ? "bg-primary/10 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"
    }`}>
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
