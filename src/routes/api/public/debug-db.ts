import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/debug-db")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { data: accounts } = await supabaseAdmin.from("instagram_accounts").select("*");
          const { data: automations } = await supabaseAdmin.from("instagram_automations").select("*");
          const { data: logs } = await supabaseAdmin.from("webhook_logs").select("*").order("received_at", { ascending: false }).limit(20);

          return Response.json({
            success: true,
            accounts,
            automations,
            logs
          });
        } catch (e: any) {
          return Response.json({ success: false, error: e.message }, { status: 500 });
        }
      }
    }
  }
});
