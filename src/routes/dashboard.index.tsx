import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, MessageCircle, Sparkles, User } from "lucide-react";
import { useSalon } from "./dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfDay, addDays, parseISO, addMinutes } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/")({
  component: BookingsToday,
});

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: string;
  source: string;
  service_id: string;
  barber_id: string;
  customer_id: string | null;
};
type Customer = { id: string; visit_count: number; is_regular_override: boolean | null };
type Service = { id: string; name: string; duration_minutes: number };
type Barber = { id: string; name: string };

function BookingsToday() {
  const { salon } = useSalon();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [customers, setCustomers] = useState<Map<string, Customer>>(new Map());
  const [regularThreshold, setRegularThreshold] = useState(3);

  const reload = async () => {
    if (!salon) return;
    const dayStart = startOfDay(parseISO(date)).toISOString();
    const dayEnd = addDays(startOfDay(parseISO(date)), 1).toISOString();
    const [{ data: b }, { data: s }, { data: br }, { data: sa }] = await Promise.all([
      supabase.from("bookings").select("*").eq("salon_id", salon.id).gte("start_time", dayStart).lt("start_time", dayEnd).order("start_time"),
      supabase.from("services").select("id,name,duration_minutes").eq("salon_id", salon.id),
      supabase.from("barbers").select("id,name").eq("salon_id", salon.id),
      supabase.from("salons").select("regular_threshold").eq("id", salon.id).single(),
    ]);
    const bk = (b ?? []) as Booking[];
    setBookings(bk);
    setServices((s ?? []) as Service[]);
    setBarbers((br ?? []) as Barber[]);
    setRegularThreshold((sa as any)?.regular_threshold ?? 3);

    const cIds = bk.map(x => x.customer_id).filter(Boolean) as string[];
    if (cIds.length) {
      const { data: cs } = await supabase.from("customers").select("id,visit_count,is_regular_override").in("id", cIds);
      const m = new Map<string, Customer>();
      (cs ?? []).forEach((c: any) => m.set(c.id, c));
      setCustomers(m);
    } else setCustomers(new Map());
  };

  useEffect(() => { reload(); }, [salon, date]);

  if (!salon) return null;

  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(startOfDay(new Date()), i);
    return { value: format(d, "yyyy-MM-dd"), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEE d MMM") };
  });

  const customerType = (b: Booking): "walkin" | "regular" | "new" => {
    if (b.source === "offline") return "walkin";
    if (!b.customer_id) return "new";
    const c = customers.get(b.customer_id);
    if (!c) return "new";
    if (c.is_regular_override === true) return "regular";
    if (c.is_regular_override === false) return "new";
    return c.visit_count >= regularThreshold ? "regular" : "new";
  };

  const colorFor = (t: string) => t === "regular"
    ? "border-l-teal bg-teal/5"
    : t === "walkin"
    ? "border-l-sunny bg-sunny/10"
    : "border-l-coral bg-coral/5";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">All your appointments in one place.</p>
        </div>
        <NewBookingDialog salonId={salon.id} services={services} barbers={barbers} onCreated={reload} defaultDate={date} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {dateOptions.map((d) => (
          <button key={d.value} onClick={() => setDate(d.value)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${date === d.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}>
            {d.label}
          </button>
        ))}
      </div>

      <Legend />

      <div className="mt-4 space-y-2">
        {bookings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            No bookings for this day yet.
          </div>
        ) : bookings.map((b) => {
          const t = customerType(b);
          const svc = services.find(s => s.id === b.service_id);
          const brb = barbers.find(x => x.id === b.barber_id);
          return (
            <div key={b.id} className={`rounded-2xl border border-l-4 bg-card p-4 shadow-soft ${colorFor(t)}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-16">
                    <div className="font-display font-bold text-lg">{format(parseISO(b.start_time), "HH:mm")}</div>
                    <div className="text-[10px] text-muted-foreground">{format(parseISO(b.end_time), "HH:mm")}</div>
                  </div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {b.customer_name}
                      {t === "regular" && <span className="text-[10px] bg-teal text-teal-foreground px-2 py-0.5 rounded-full font-bold uppercase">⭐ Regular</span>}
                      {t === "walkin" && <span className="text-[10px] bg-sunny text-sunny-foreground px-2 py-0.5 rounded-full font-bold uppercase">Walk-in</span>}
                      {t === "new" && <span className="text-[10px] bg-coral/20 text-coral px-2 py-0.5 rounded-full font-bold uppercase">New</span>}
                      {b.source === "whatsapp" && <MessageCircle className="h-3.5 w-3.5 text-teal" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{svc?.name} · {brb?.name} · {b.customer_phone}</div>
                  </div>
                </div>
                <Select defaultValue={b.status} onValueChange={async (v) => {
                  await supabase.from("bookings").update({ status: v }).eq("id", b.id);
                  reload();
                }}>
                  <SelectTrigger className="w-36 h-9 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending", "confirmed", "completed", "cancelled", "no_show"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-teal" /> Regular</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-coral" /> New</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-sunny" /> Walk-in</span>
    </div>
  );
}

function NewBookingDialog({ salonId, services, barbers, onCreated, defaultDate }: { salonId: string; services: Service[]; barbers: Barber[]; onCreated: () => void; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string>("");
  const [barberId, setBarberId] = useState<string>("");
  const [time, setTime] = useState("10:00");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const svc = services.find(s => s.id === serviceId);
    if (!svc || !barberId || !name || !phone) return toast.error("Fill all fields");
    setSubmitting(true);
    const start = parseISO(`${defaultDate}T${time}`);
    const end = addMinutes(start, svc.duration_minutes);

    const { data: existing } = await supabase.from("customers").select("id,visit_count").eq("salon_id", salonId).eq("phone", phone).maybeSingle();
    let customerId = existing?.id ?? null;
    if (!existing) {
      const { data: c } = await supabase.from("customers").insert({ salon_id: salonId, phone, name, visit_count: 1 }).select("id").single();
      customerId = c?.id ?? null;
    } else {
      await supabase.from("customers").update({ visit_count: (existing.visit_count ?? 0) + 1, name }).eq("id", existing.id);
    }
    const { error } = await supabase.from("bookings").insert({
      salon_id: salonId, customer_id: customerId, barber_id: barberId, service_id: serviceId,
      customer_name: name, customer_phone: phone, start_time: start.toISOString(), end_time: end.toISOString(),
      status: "confirmed", source: "offline",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Walk-in added!");
    setOpen(false); setName(""); setPhone(""); setServiceId(""); setBarberId(""); setTime("10:00");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full shadow-playful"><Plus className="h-4 w-4 mr-1" /> Walk-in / Manual</Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle className="font-display">Add walk-in booking</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Customer name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1.5 rounded-xl" /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1.5 rounded-xl" /></div>
          </div>
          <div><Label>Service</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue placeholder="Pick service" /></SelectTrigger>
              <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Barber</Label>
            <Select value={barberId} onValueChange={setBarberId}>
              <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue placeholder="Pick barber" /></SelectTrigger>
              <SelectContent>{barbers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Time</Label><Input type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-1.5 rounded-xl" /></div>
          <Button onClick={submit} disabled={submitting} size="lg" className="w-full rounded-full shadow-playful">
            {submitting ? "Adding..." : "Add booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
