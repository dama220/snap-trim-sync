import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSalon } from "./dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageCircle, Copy } from "lucide-react";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { salon } = useSalon();
  const [form, setForm] = useState({
    name: "", description: "", address: "", city: "", phone: "", whatsapp_number: "",
    opening_time: "09:00", closing_time: "20:00", regular_threshold: 3, image_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!salon) return;
    supabase.from("salons").select("*").eq("id", salon.id).single().then(({ data }) => {
      if (data) setForm({
        name: data.name ?? "", description: data.description ?? "", address: data.address ?? "",
        city: data.city ?? "", phone: data.phone ?? "", whatsapp_number: data.whatsapp_number ?? "",
        opening_time: (data.opening_time ?? "09:00").slice(0,5), closing_time: (data.closing_time ?? "20:00").slice(0,5),
        regular_threshold: data.regular_threshold ?? 3, image_url: data.image_url ?? "",
      });
    });
  }, [salon]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salon) return;
    setSaving(true);
    const { error } = await supabase.from("salons").update(form).eq("id", salon.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved!");
    window.dispatchEvent(new Event("salon-updated"));
  };

  if (!salon) return null;
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/salons/${salon.slug}`;

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold mb-6">Settings</h1>

      <div className="rounded-3xl border border-teal/30 bg-teal/5 p-5 mb-6 shadow-soft">
        <div className="flex items-start gap-3">
          <MessageCircle className="h-5 w-5 text-teal mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold">WhatsApp bot</h3>
            <p className="text-sm text-muted-foreground mt-1">Set your Twilio WhatsApp sender number below. Customers messaging that number will get the booking bot. (You'll connect Twilio in the next setup step.)</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 mb-6 shadow-soft">
        <h3 className="font-semibold mb-2">Your public booking page</h3>
        <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
          <span className="flex-1 truncate">{publicUrl}</span>
          <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copied!"); }}><Copy className="h-4 w-4" /></Button>
        </div>
      </div>

      <form onSubmit={save} className="rounded-3xl border border-border bg-card p-6 shadow-soft space-y-4">
        <div><Label>Salon name</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5 rounded-xl" /></div>
        <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1.5 rounded-xl" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="mt-1.5 rounded-xl" /></div>
          <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1.5 rounded-xl" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1.5 rounded-xl" /></div>
          <div><Label>WhatsApp number (E.164)</Label><Input value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })} className="mt-1.5 rounded-xl" placeholder="+15551234567" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Opens</Label><Input type="time" value={form.opening_time} onChange={e => setForm({ ...form, opening_time: e.target.value })} className="mt-1.5 rounded-xl" /></div>
          <div><Label>Closes</Label><Input type="time" value={form.closing_time} onChange={e => setForm({ ...form, closing_time: e.target.value })} className="mt-1.5 rounded-xl" /></div>
          <div><Label>Regular after N visits</Label><Input type="number" min={1} value={form.regular_threshold} onChange={e => setForm({ ...form, regular_threshold: parseInt(e.target.value || "3") })} className="mt-1.5 rounded-xl" /></div>
        </div>
        <div><Label>Cover image URL</Label><Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className="mt-1.5 rounded-xl" placeholder="https://..." /></div>
        <Button type="submit" disabled={saving} size="lg" className="rounded-full shadow-playful">{saving ? "Saving..." : "Save changes"}</Button>
      </form>
    </div>
  );
}
