import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock, Scissors, Phone, MessageCircle, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMinutes, addDays, startOfDay, parseISO } from "date-fns";

export const Route = createFileRoute("/salons/$slug")({
  head: () => ({ meta: [{ title: "Book — SnipShop" }, { name: "description", content: "Book your haircut online." }] }),
  component: SalonDetail,
});

type Salon = { id: string; name: string; slug: string; description: string | null; city: string | null; address: string | null; phone: string | null; whatsapp_number: string | null; image_url: string | null; opening_time: string; closing_time: string; };
type Service = { id: string; name: string; duration_minutes: number; price: number; description: string | null };
type Barber = { id: string; name: string; avatar_url: string | null; bio: string | null };
type Booking = { start_time: string; end_time: string; barber_id: string };

function SalonDetail() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barberServices, setBarberServices] = useState<Array<{ barber_id: string; service_id: string }>>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("salons").select("*").eq("slug", slug).maybeSingle();
      if (!s) return;
      setSalon(s as Salon);
      const [svc, brb, bs] = await Promise.all([
        supabase.from("services").select("*").eq("salon_id", s.id).eq("is_active", true),
        supabase.from("barbers").select("*").eq("salon_id", s.id).eq("is_active", true),
        supabase.from("barber_services").select("*").in("barber_id", []),
      ]);
      setServices((svc.data as Service[]) ?? []);
      setBarbers((brb.data as Barber[]) ?? []);
      // refetch barber_services with proper barber ids
      const barberIds = (brb.data ?? []).map((b: any) => b.id);
      if (barberIds.length) {
        const { data: bs2 } = await supabase.from("barber_services").select("*").in("barber_id", barberIds);
        setBarberServices(bs2 ?? []);
      } else {
        setBarberServices([]);
      }
      void bs;
    })();
  }, [slug]);

  // Fetch bookings for selected date+barber
  useEffect(() => {
    if (!salon || !barberId) return;
    const dayStart = startOfDay(parseISO(date)).toISOString();
    const dayEnd = addDays(startOfDay(parseISO(date)), 1).toISOString();
    supabase.from("bookings").select("start_time,end_time,barber_id")
      .eq("salon_id", salon.id).eq("barber_id", barberId)
      .gte("start_time", dayStart).lt("start_time", dayEnd)
      .neq("status", "cancelled")
      .then(({ data }) => setBookings((data as Booking[]) ?? []));
  }, [salon, barberId, date]);

  const service = services.find((s) => s.id === serviceId) ?? null;

  const eligibleBarbers = useMemo(() => {
    if (!serviceId) return barbers;
    const ids = new Set(barberServices.filter((x) => x.service_id === serviceId).map((x) => x.barber_id));
    // If no mapping yet, allow all barbers
    return ids.size === 0 ? barbers : barbers.filter((b) => ids.has(b.id));
  }, [serviceId, barbers, barberServices]);

  const slots = useMemo(() => {
    if (!salon || !service) return [];
    const open = parseISO(`${date}T${salon.opening_time}`);
    const close = parseISO(`${date}T${salon.closing_time}`);
    const out: { start: Date; end: Date; available: boolean }[] = [];
    let cur = open;
    while (addMinutes(cur, service.duration_minutes) <= close) {
      const end = addMinutes(cur, service.duration_minutes);
      const conflict = bookings.some((b) => {
        const bs = parseISO(b.start_time);
        const be = parseISO(b.end_time);
        return cur < be && end > bs;
      });
      const isPast = cur < new Date();
      out.push({ start: cur, end, available: !conflict && !isPast });
      cur = addMinutes(cur, service.duration_minutes);
    }
    return out;
  }, [salon, service, date, bookings]);

  const dateOptions = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(startOfDay(new Date()), i);
      return { value: format(d, "yyyy-MM-dd"), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEE d MMM") };
    });
  }, []);

  async function submit() {
    if (!salon || !service || !barberId || !slot) return;
    setSubmitting(true);
    const start = parseISO(slot);
    const end = addMinutes(start, service.duration_minutes);

    // Upsert customer
    const { data: existing } = await supabase.from("customers").select("id,visit_count").eq("salon_id", salon.id).eq("phone", phone).maybeSingle();
    let customerId = existing?.id ?? null;
    if (!existing) {
      const { data: created } = await supabase.from("customers").insert({ salon_id: salon.id, phone, name, visit_count: 1 }).select("id").single();
      customerId = created?.id ?? null;
    } else {
      await supabase.from("customers").update({ visit_count: (existing.visit_count ?? 0) + 1, name }).eq("id", existing.id);
    }

    const { error } = await supabase.from("bookings").insert({
      salon_id: salon.id,
      customer_id: customerId,
      barber_id: barberId,
      service_id: service.id,
      customer_name: name,
      customer_phone: phone,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "confirmed",
      source: "online",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Booked! See you soon ✂️");
    navigate({ to: "/salons/$slug", params: { slug }, search: {} });
    setStep(1); setServiceId(null); setBarberId(null); setSlot(null); setName(""); setPhone("");
  }

  if (!salon) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="container mx-auto px-4 py-20 flex-1 text-center text-muted-foreground">Loading salon...</main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Salon header */}
        <div className="bg-gradient-hero/10 border-b border-border">
          <div className="container mx-auto px-4 py-8 grid md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2">
              <h1 className="font-display text-3xl md:text-4xl font-bold">{salon.name}</h1>
              {salon.description && <p className="mt-2 text-muted-foreground">{salon.description}</p>}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {(salon.city || salon.address) && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {salon.address ?? salon.city}</span>}
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {salon.opening_time.slice(0,5)} – {salon.closing_time.slice(0,5)}</span>
                {salon.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {salon.phone}</span>}
                {salon.whatsapp_number && <span className="flex items-center gap-1 text-teal"><MessageCircle className="h-4 w-4" /> WhatsApp ready</span>}
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden shadow-playful aspect-video bg-gradient-card">
              {salon.image_url ? <img src={salon.image_url} alt={salon.name} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><Scissors className="h-12 w-12 text-primary-foreground/80" /></div>}
            </div>
          </div>
        </div>

        {/* Booking flow */}
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Stepper step={step} />

          {step === 1 && (
            <Section title="Pick a service">
              {services.length === 0 ? <Empty text="No services available yet." /> : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {services.map((s) => (
                    <button key={s.id} onClick={() => { setServiceId(s.id); setStep(2); }}
                      className={`text-left rounded-2xl border p-4 transition hover:border-primary hover:shadow-playful ${serviceId === s.id ? "border-primary shadow-playful" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{s.name}</h3>
                          {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{s.duration_minutes} min</p>
                        </div>
                        <span className="font-display font-bold text-primary">${Number(s.price).toFixed(0)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          )}

          {step === 2 && (
            <Section title="Pick a barber" onBack={() => setStep(1)}>
              {eligibleBarbers.length === 0 ? <Empty text="No barbers available." /> : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {eligibleBarbers.map((b) => (
                    <button key={b.id} onClick={() => { setBarberId(b.id); setStep(3); }}
                      className={`flex items-center gap-3 rounded-2xl border p-4 transition hover:border-primary hover:shadow-playful ${barberId === b.id ? "border-primary shadow-playful" : "border-border"}`}>
                      <div className="h-12 w-12 rounded-full bg-gradient-card flex items-center justify-center text-primary-foreground font-bold overflow-hidden">
                        {b.avatar_url ? <img src={b.avatar_url} alt={b.name} className="h-full w-full object-cover" /> : b.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold">{b.name}</h3>
                        {b.bio && <p className="text-xs text-muted-foreground line-clamp-1">{b.bio}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          )}

          {step === 3 && (
            <Section title="Pick a date & slot" onBack={() => setStep(2)}>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {dateOptions.map((d) => (
                  <button key={d.value} onClick={() => { setDate(d.value); setSlot(null); }}
                    className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${date === d.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              {slots.length === 0 ? <Empty text="Salon closed today." /> : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((s) => {
                    const iso = s.start.toISOString();
                    return (
                      <button key={iso} disabled={!s.available} onClick={() => { setSlot(iso); setStep(4); }}
                        className={`rounded-xl px-3 py-2 text-sm font-medium border transition ${
                          !s.available ? "bg-muted text-muted-foreground line-through cursor-not-allowed border-border"
                          : slot === iso ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary hover:shadow-soft"
                        }`}>
                        {format(s.start, "HH:mm")}
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {step === 4 && (
            <Section title="Your details" onBack={() => setStep(3)}>
              <div className="rounded-2xl bg-muted p-4 mb-4 text-sm">
                <strong>{service?.name}</strong> with <strong>{barbers.find((b) => b.id === barberId)?.name}</strong><br />
                {slot && format(parseISO(slot), "EEEE d MMMM, HH:mm")}
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="bn">Name</Label>
                  <Input id="bn" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="bp">Phone</Label>
                  <Input id="bp" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 rounded-xl" />
                </div>
                <Button onClick={submit} disabled={submitting || !name || !phone} size="lg" className="w-full rounded-full shadow-playful mt-2">
                  {submitting ? "Booking..." : <><Check className="mr-2 h-4 w-4" /> Confirm booking</>}
                </Button>
              </div>
            </Section>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Service", "Barber", "Slot", "Confirm"];
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {labels.map((l, i) => {
        const n = i + 1;
        const active = n === step, done = n < step;
        return (
          <div key={l} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
              done ? "bg-teal text-teal-foreground" : active ? "bg-primary text-primary-foreground shadow-playful" : "bg-muted text-muted-foreground"
            }`}>{done ? <Check className="h-4 w-4" /> : n}</div>
            <span className={`text-xs font-medium hidden sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}>{l}</span>
            {n < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children, onBack }: { title: string; children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {onBack && <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-muted-foreground py-8 text-sm">{text}</p>;
}
