import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSalon } from "./dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/barbers")({
  component: BarbersPage,
});

type Barber = { id: string; name: string; bio: string | null; is_active: boolean };
type Service = { id: string; name: string };

function BarbersPage() {
  const { salon } = useSalon();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [mappings, setMappings] = useState<Set<string>>(new Set()); // "barber:service"
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  const load = async () => {
    if (!salon) return;
    const [{ data: b }, { data: s }] = await Promise.all([
      supabase.from("barbers").select("*").eq("salon_id", salon.id).order("created_at"),
      supabase.from("services").select("id,name").eq("salon_id", salon.id),
    ]);
    setBarbers((b ?? []) as Barber[]);
    setServices((s ?? []) as Service[]);
    const ids = (b ?? []).map((x: any) => x.id);
    if (ids.length) {
      const { data: bs } = await supabase.from("barber_services").select("*").in("barber_id", ids);
      setMappings(new Set((bs ?? []).map((m: any) => `${m.barber_id}:${m.service_id}`)));
    } else setMappings(new Set());
  };
  useEffect(() => { load(); }, [salon]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salon) return;
    const { error } = await supabase.from("barbers").insert({ salon_id: salon.id, name, bio });
    if (error) return toast.error(error.message);
    setName(""); setBio(""); load(); toast.success("Barber added!");
  };

  const remove = async (id: string) => {
    await supabase.from("barbers").delete().eq("id", id); load();
  };

  const toggle = async (barberId: string, serviceId: string, on: boolean) => {
    if (on) {
      await supabase.from("barber_services").insert({ barber_id: barberId, service_id: serviceId });
    } else {
      await supabase.from("barber_services").delete().eq("barber_id", barberId).eq("service_id", serviceId);
    }
    load();
  };

  if (!salon) return null;
  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-6">Barbers</h1>
      <form onSubmit={add} className="rounded-3xl border border-border bg-card p-5 shadow-soft mb-6 grid sm:grid-cols-3 gap-3">
        <div><Label>Name</Label><Input required value={name} onChange={e => setName(e.target.value)} className="mt-1.5 rounded-xl" /></div>
        <div className="sm:col-span-2"><Label>Bio</Label><Input value={bio} onChange={e => setBio(e.target.value)} className="mt-1.5 rounded-xl" placeholder="Master fader, 10 years experience" /></div>
        <div className="sm:col-span-3"><Button type="submit" className="rounded-full shadow-playful"><Plus className="h-4 w-4 mr-1" /> Add barber</Button></div>
      </form>

      <div className="space-y-3">
        {barbers.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No barbers yet.</p> : barbers.map(b => (
          <div key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold">{b.name}</div>
                {b.bio && <div className="text-xs text-muted-foreground">{b.bio}</div>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
            {services.length > 0 && (
              <div className="border-t border-border pt-3 mt-2">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Services this barber offers</div>
                <div className="flex flex-wrap gap-3">
                  {services.map(s => {
                    const id = `${b.id}:${s.id}`;
                    const checked = mappings.has(id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={(v) => toggle(b.id, s.id, !!v)} />
                        {s.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
