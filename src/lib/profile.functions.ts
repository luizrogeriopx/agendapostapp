import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, type PlanType } from "./plans";

// 1. Get the current user's profile
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, role, subscription_plan, created_at")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      throw new Error("Perfil de usuário não encontrado.");
    }

    return profile;
  });

// 2. Upgrade/Change the active subscription plan
export const upgradePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        planId: z.enum(["teste", "agendapro", "automacaopro", "premium"]),
        billingCycle: z.enum(["monthly", "yearly"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Update the profile subscription plan
    const { data: updatedProfile, error: updateErr } = await supabase
      .from("profiles")
      .update({ subscription_plan: data.planId })
      .eq("id", userId)
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);

    // 2. If it's a paid plan, generate a mock invoice
    const plan = PLANS[data.planId];
    if (plan.priceMonthly > 0) {
      const amount = data.billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
      const dueDays = 7;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      const { error: invoiceErr } = await supabase
        .from("user_invoices")
        .insert({
          user_id: userId,
          plan_id: data.planId,
          billing_cycle: data.billingCycle,
          amount: amount,
          status: "open",
          due_date: dueDate.toISOString(),
        });

      if (invoiceErr) {
        console.error("Failed to create mock invoice:", invoiceErr);
      }
    }

    return updatedProfile;
  });

// 3. List all invoices for the current user
export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: invoices, error } = await supabase
      .from("user_invoices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return invoices ?? [];
  });

// 4. Pay a pending invoice (marks it as paid)
export const payInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: updatedInvoice, error } = await supabase
      .from("user_invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", data.invoiceId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updatedInvoice;
  });
