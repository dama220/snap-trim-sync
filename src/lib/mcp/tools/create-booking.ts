import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase-user";

export default defineTool({
  name: "create_booking",
  title: "Create walk-in booking",
  description:
    "Create a booking (walk-in / offline) for one of the signed-in user's salons. Times are ISO 8601.",
  inputSchema: {
    salon_id: z.string().uuid(),
    barber_id: z.string().uuid(),
    service_id: z.string().uuid(),
    customer_name: z.string().min(1).max(200),
    customer_phone: z.string().max(50),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("bookings")
      .insert({
        salon_id: input.salon_id,
        barber_id: input.barber_id,
        service_id: input.service_id,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        start_time: input.start_time,
        end_time: input.end_time,
        source: "walkin",
        status: "confirmed",
      })
      .select()
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Booking created: ${data.id}` }],
      structuredContent: { booking: data },
    };
  },
});
