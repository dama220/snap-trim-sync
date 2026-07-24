import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase-user";

export default defineTool({
  name: "list_services",
  title: "List services",
  description: "List services for one of the signed-in user's salons.",
  inputSchema: {
    salon_id: z.string().uuid().describe("Salon UUID (from list_my_salons)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ salon_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("services")
      .select("id, name, price, duration_minutes, is_active")
      .eq("salon_id", salon_id);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { services: data ?? [] },
    };
  },
});
