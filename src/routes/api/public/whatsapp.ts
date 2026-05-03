import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function twiml(message: string) {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } },
  );
}

type SessionState = {
  step:
    | "start"
    | "choose_salon"
    | "choose_service"
    | "choose_barber"
    | "choose_slot"
    | "ask_name"
    | "confirm";
  salon_id?: string;
  service_id?: string;
  barber_id?: string;
  start_time?: string;
  end_time?: string;
  customer_name?: string;
  options?: Array<{ id: string; label: string }>;
};

async function getSession(phone: string) {
  const { data } = await supabaseAdmin
    .from("whatsapp_sessions")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  return data;
}

async function saveSession(phone: string, state: SessionState) {
  await supabaseAdmin
    .from("whatsapp_sessions")
    .upsert(
      { phone, state: state as never, updated_at: new Date().toISOString() },
      { onConflict: "phone" },
    );
}

async function clearSession(phone: string) {
  await supabaseAdmin.from("whatsapp_sessions").delete().eq("phone", phone);
}

function pickFromOptions(state: SessionState, input: string) {
  const idx = parseInt(input.trim(), 10) - 1;
  if (!state.options || isNaN(idx) || idx < 0 || idx >= state.options.length)
    return null;
  return state.options[idx];
}

async function listSalons() {
  const { data } = await supabaseAdmin
    .from("salons")
    .select("id, name, city")
    .limit(10);
  return data ?? [];
}

async function listServices(salonId: string) {
  const { data } = await supabaseAdmin
    .from("services")
    .select("id, name, price, duration_minutes")
    .eq("salon_id", salonId)
    .eq("is_active", true);
  return data ?? [];
}

async function listBarbers(salonId: string, serviceId: string) {
  const { data } = await supabaseAdmin
    .from("barbers")
    .select("id, name, barber_services!inner(service_id)")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .eq("barber_services.service_id", serviceId);
  return data ?? [];
}

async function nextSlots(
  salonId: string,
  barberId: string,
  durationMinutes: number,
) {
  // Generate 5 next 30-min slots from now within salon hours.
  const { data: salon } = await supabaseAdmin
    .from("salons")
    .select("opening_time, closing_time")
    .eq("id", salonId)
    .single();
  if (!salon) return [];

  const slots: Array<{ start: Date; end: Date }> = [];
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);

  for (let day = 0; day < 3 && slots.length < 5; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    const [oh, om] = salon.opening_time.split(":").map(Number);
    const [ch, cm] = salon.closing_time.split(":").map(Number);
    const open = new Date(date);
    open.setHours(oh, om, 0, 0);
    const close = new Date(date);
    close.setHours(ch, cm, 0, 0);
    let cursor = day === 0 ? new Date(Math.max(now.getTime(), open.getTime())) : open;
    while (cursor.getTime() + durationMinutes * 60000 <= close.getTime() && slots.length < 5) {
      slots.push({
        start: new Date(cursor),
        end: new Date(cursor.getTime() + durationMinutes * 60000),
      });
      cursor = new Date(cursor.getTime() + 30 * 60000);
    }
  }

  // Filter conflicts.
  const { data: bookings } = await supabaseAdmin
    .from("bookings")
    .select("start_time, end_time")
    .eq("barber_id", barberId)
    .neq("status", "cancelled")
    .gte("start_time", new Date().toISOString());
  const conflicts = (bookings ?? []).map((b) => ({
    s: new Date(b.start_time).getTime(),
    e: new Date(b.end_time).getTime(),
  }));
  return slots.filter(
    (sl) =>
      !conflicts.some(
        (c) => sl.start.getTime() < c.e && sl.end.getTime() > c.s,
      ),
  );
}

function fmtSlot(d: Date) {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function handleMessage(fromPhone: string, body: string): Promise<string> {
  const text = body.trim();
  const lower = text.toLowerCase();

  if (["hi", "hello", "start", "menu", "restart"].includes(lower)) {
    await clearSession(fromPhone);
  }

  const session = await getSession(fromPhone);
  const state: SessionState = (session?.state as SessionState) ?? { step: "start" };

  if (state.step === "start") {
    const salons = await listSalons();
    if (salons.length === 0) return "No salons available right now. Please try again later.";
    const options = salons.map((s) => ({ id: s.id, label: `${s.name}${s.city ? ` (${s.city})` : ""}` }));
    await saveSession(fromPhone, { step: "choose_salon", options });
    return `👋 Welcome to BarberBook!\n\nReply with the number of the salon:\n${options.map((o, i) => `${i + 1}. ${o.label}`).join("\n")}`;
  }

  if (state.step === "choose_salon") {
    const choice = pickFromOptions(state, text);
    if (!choice) return "Please reply with a valid number from the list.";
    const services = await listServices(choice.id);
    if (services.length === 0) return "This salon has no services configured. Send 'menu' to start over.";
    const options = services.map((s) => ({
      id: s.id,
      label: `${s.name} — $${s.price} (${s.duration_minutes}min)`,
    }));
    await saveSession(fromPhone, { step: "choose_service", salon_id: choice.id, options });
    return `Great! Pick a service:\n${options.map((o, i) => `${i + 1}. ${o.label}`).join("\n")}`;
  }

  if (state.step === "choose_service") {
    const choice = pickFromOptions(state, text);
    if (!choice) return "Please reply with a valid number from the list.";
    const barbers = await listBarbers(state.salon_id!, choice.id);
    if (barbers.length === 0) return "No barbers available for this service. Send 'menu' to start over.";
    const options = barbers.map((b) => ({ id: b.id, label: b.name }));
    await saveSession(fromPhone, {
      ...state,
      step: "choose_barber",
      service_id: choice.id,
      options,
    });
    return `Pick a barber:\n${options.map((o, i) => `${i + 1}. ${o.label}`).join("\n")}`;
  }

  if (state.step === "choose_barber") {
    const choice = pickFromOptions(state, text);
    if (!choice) return "Please reply with a valid number from the list.";
    const { data: svc } = await supabaseAdmin
      .from("services")
      .select("duration_minutes")
      .eq("id", state.service_id!)
      .single();
    const slots = await nextSlots(state.salon_id!, choice.id, svc?.duration_minutes ?? 30);
    if (slots.length === 0) return "No slots available in the next few days. Send 'menu' to try another barber.";
    const options = slots.map((s) => ({
      id: `${s.start.toISOString()}|${s.end.toISOString()}`,
      label: fmtSlot(s.start),
    }));
    await saveSession(fromPhone, {
      ...state,
      step: "choose_slot",
      barber_id: choice.id,
      options,
    });
    return `Available times:\n${options.map((o, i) => `${i + 1}. ${o.label}`).join("\n")}`;
  }

  if (state.step === "choose_slot") {
    const choice = pickFromOptions(state, text);
    if (!choice) return "Please reply with a valid number from the list.";
    const [start, end] = choice.id.split("|");
    await saveSession(fromPhone, {
      ...state,
      step: "ask_name",
      start_time: start,
      end_time: end,
    });
    return "What's your name?";
  }

  if (state.step === "ask_name") {
    if (text.length < 1 || text.length > 200) return "Please send a valid name.";
    await saveSession(fromPhone, { ...state, step: "confirm", customer_name: text });
    const slotLabel = fmtSlot(new Date(state.start_time!));
    return `Confirm booking for ${text} at ${slotLabel}?\nReply YES to confirm or NO to cancel.`;
  }

  if (state.step === "confirm") {
    if (lower === "yes" || lower === "y") {
      const { error } = await supabaseAdmin.from("bookings").insert({
        salon_id: state.salon_id!,
        barber_id: state.barber_id!,
        service_id: state.service_id!,
        customer_name: state.customer_name!,
        customer_phone: fromPhone,
        start_time: state.start_time!,
        end_time: state.end_time!,
        source: "whatsapp",
        status: "confirmed",
      });
      await clearSession(fromPhone);
      if (error) return `Sorry, I couldn't book that slot: ${error.message}. Send 'menu' to try again.`;
      return `✅ Booked! See you at ${fmtSlot(new Date(state.start_time!))}. Send 'menu' to book again.`;
    }
    if (lower === "no" || lower === "n") {
      await clearSession(fromPhone);
      return "Booking cancelled. Send 'menu' to start over.";
    }
    return "Reply YES to confirm or NO to cancel.";
  }

  await clearSession(fromPhone);
  return "Send 'menu' to start a booking.";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const fromRaw = (form.get("From") || "").toString();
          const body = (form.get("Body") || "").toString();
          // Twilio sends "whatsapp:+15551234567" — normalize to phone.
          const phone = fromRaw.replace(/^whatsapp:/, "").trim();
          if (!phone) return twiml("Missing sender. Try again.");
          const reply = await handleMessage(phone, body);
          return twiml(reply);
        } catch (err) {
          console.error("WhatsApp webhook error:", err);
          return twiml("Something went wrong. Send 'menu' to start over.");
        }
      },
    },
  },
});
