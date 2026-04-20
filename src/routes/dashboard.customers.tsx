import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSalon } from "./dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/customers")({
  component: CustomersPage,
});

type Customer = { id: string; name: string | null; phone: string; visit_count: number; is_regular_override: boolean | null };

function CustomersPage() {
  const { salon } = useSalon();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [threshold, setThreshold] = useState(3);

  const load = async () => {
    if (!salon) return;
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("customers").select("*").eq("salon_id", salon.id).order("visit_count", { ascending: false }),
      supabase.from("salons").select("regular_threshold").eq("id", salon.id).single(),
    ]);
    setCustomers((c ?? []) as Customer[]);
    setThreshold((s as any)?.regular_threshold ?? 3);
  };
  useEffect(() => { load(); }, [salon]);

  const setOverride = async (id: string, val: string) => {
    const v = val === "auto" ? null : val === "regular";
    await supabase.from("customers").update({ is_regular_override: v }).eq("id", id);
    load();
    toast.success("Updated");
  };

  if (!salon) return null;
  const isRegular = (c: Customer) =>
    c.is_regular_override === true ? true : c.is_regular_override === false ? false : c.visit_count >= threshold;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-2">Customers</h1>
      <p className="text-sm text-muted-foreground mb-6">Auto-tagged as regular after {threshold} visits. Override anytime.</p>
      <div className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden">
        {customers.length === 0 ? <p className="text-center text-muted-foreground py-12">No customers yet.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Phone</th><th className="text-left p-3">Visits</th><th className="text-left p-3">Tag</th></tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 font-medium">{c.name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{c.phone}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-full text-xs font-bold ${
                      isRegular(c) ? "bg-teal text-teal-foreground" : "bg-coral/20 text-coral"
                    }`}>{c.visit_count}</span>
                  </td>
                  <td className="p-3">
                    <Select value={c.is_regular_override === null ? "auto" : c.is_regular_override ? "regular" : "new"} onValueChange={(v) => setOverride(c.id, v)}>
                      <SelectTrigger className="w-32 h-8 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto ({isRegular(c) ? "regular" : "new"})</SelectItem>
                        <SelectItem value="regular">⭐ Regular</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
