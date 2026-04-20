import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSalon } from "./dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/services")({
  component: ServicesPage,
});

type Service = { id: string; name: string; duration_minutes: number; price: number; description: string | null; is_active: boolean };

function ServicesPage() {
  const { salon } = useSalon();
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("20");

  const load = async () => {
    if (!salon) return;
    const { data } = await supabase.from("services").select("*").eq("salon_id", salon.id).order("created_at");
    setServices((data ?? []) as Service[]);
  };
  useEffect(() => { load(); }, [salon]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salon) return;
    const { error } = await supabase.from("services").insert({
      salon_id: salon.id, name, duration_minutes: parseInt(duration), price: parseFloat(price),
    });
    if (error) return toast.error(error.message);
    setName(""); setDuration("30"); setPrice("20"); load();
    toast.success("Service added!");
  };

  const remove = async (id: string) => {
    await supabase.from("services").delete().eq("id", id); load();
  };

  if (!salon) return null;
  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-6">Services</h1>
      <form onSubmit={add} className="rounded-3xl border border-border bg-card p-5 shadow-soft mb-6 grid sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2"><Label>Name</Label><Input required value={name} onChange={e => setName(e.target.value)} className="mt-1.5 rounded-xl" placeholder="Haircut" /></div>
        <div><Label>Duration (min)</Label><Input type="number" required value={duration} onChange={e => setDuration(e.target.value)} className="mt-1.5 rounded-xl" /></div>
        <div><Label>Price</Label><Input type="number" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} className="mt-1.5 rounded-xl" /></div>
        <div className="sm:col-span-4"><Button type="submit" className="rounded-full shadow-playful"><Plus className="h-4 w-4 mr-1" /> Add service</Button></div>
      </form>

      <div className="space-y-2">
        {services.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No services yet.</p> : services.map(s => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between shadow-soft">
            <div>
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.duration_minutes} min · ${Number(s.price).toFixed(2)}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
