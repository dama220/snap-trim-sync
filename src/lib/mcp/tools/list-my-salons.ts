import { defineTool } from "@lovable.dev/mcp-js";
import { notAuthenticated, supabaseForUser } from "../supabase-user";

export default defineTool({
  name: "list_my_salons",
  title: "List my salons",
  description:
    "List all salons owned by the signed-in user, with id, name, slug, city, and opening hours.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("salons")
      .select("id, name, slug, city, opening_time, closing_time, whatsapp_number")
      .order("created_at");
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { salons: data ?? [] },
    };
  },
});
