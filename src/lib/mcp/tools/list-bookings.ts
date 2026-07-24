import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase-user";

export default defineTool({
  name: "list_bookings",
  title: "List bookings",
  description:
    "List bookings for one of the signed-in user's salons. Optionally filter by ISO 8601 start/end range.",
  inputSchema: {
    salon_id: z.string().uuid().describe("Salon UUID (from list_my_salons)."),
    from: z
      .string()
      .datetime()
      .optional()
      .describe("Inclusive lower bound on start_time (ISO 8601)."),
    to: z
      .string()
      .datetime()
      .optional()
      .describe("Exclusive upper bound on start_time (ISO 8601)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ salon_id, from, to }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    let q = supabaseForUser(ctx)
      .from("bookings")
      .select(
        "id, customer_name, customer_phone, start_time, end_time, status, source, barber_id, service_id",
      )
      .eq("salon_id", salon_id)
      .order("start_time");
    if (from) q = q.gte("start_time", from);
    if (to) q = q.lt("start_time", to);
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});
