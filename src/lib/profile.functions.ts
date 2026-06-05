import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, type PlanType } from "./plans";
import Stripe from "stripe";

// Helper to initialize Stripe
function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("A chave secreta da Stripe (STRIPE_SECRET_KEY) não está configurada no servidor.");
  }
  return new Stripe(secretKey);
}

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

// 2. Upgrade/Change Plan (Creates Stripe Checkout Session for paid plans)
export const upgradePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        planId: z.enum(["teste", "agendapro", "automacaopro", "premium"]),
        billingCycle: z.enum(["monthly", "yearly"]),
        origin: z.string().url(), // passed from client to generate callback URLs
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch plan details
    const plan = PLANS[data.planId];

    // If Teste (Free) plan, update DB directly
    if (plan.priceMonthly === 0) {
      const { data: updated, error } = await supabase
        .from("profiles")
        .update({ subscription_plan: data.planId })
        .eq("id", userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { success: true, profile: updated };
    }

    // Initialize Stripe and fetch user email
    const stripe = getStripeClient();
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;

    const amount = data.billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
    const interval = data.billingCycle === "monthly" ? "month" : "year";

    // Create Stripe Checkout Session in subscription mode
    const session = await stripe.checkout.sessions.create({
      automatic_payment_methods: {
        enabled: true,
      },
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: plan.name,
              description: `Assinatura do ${plan.name} (${data.billingCycle === "yearly" ? "Anual com 40% OFF" : "Mensal"})`,
            },
            unit_amount: Math.round(amount * 100), // in cents
            recurring: {
              interval: interval as "month" | "year",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer_email: email,
      success_url: `${data.origin}/financial?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/plans`,
      metadata: {
        userId,
        planId: data.planId,
        billingCycle: data.billingCycle,
        amount: String(amount),
      },
    });

    // Create an open invoice in the database mapping to this stripe_session_id
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
        stripe_session_id: session.id,
      });

    if (invoiceErr) {
      console.error("Failed to save invoice reference:", invoiceErr.message);
    }

    return { success: false, stripeUrl: session.url };
  });

// 3. Create One-Time Checkout Session to pay a pending invoice
export const createInvoicePaymentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        invoiceId: z.string().uuid(),
        origin: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch the pending invoice
    const { data: invoice, error: invErr } = await supabase
      .from("user_invoices")
      .select("*")
      .eq("id", data.invoiceId)
      .eq("user_id", userId)
      .eq("status", "open")
      .single();

    if (invErr || !invoice) throw new Error("Fatura pendente não encontrada.");

    const plan = PLANS[invoice.plan_id as PlanType];
    const stripe = getStripeClient();
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;

    // Create Stripe Checkout Session in payment mode (one-time payment)
    const session = await stripe.checkout.sessions.create({
      automatic_payment_methods: {
        enabled: true,
      },
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `Fatura: ${plan.name}`,
              description: `Pagamento da fatura pendente (${invoice.billing_cycle === "yearly" ? "Ciclo Anual" : "Ciclo Mensal"})`,
            },
            unit_amount: Math.round(Number(invoice.amount) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: email,
      success_url: `${data.origin}/financial?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/financial`,
      metadata: {
        userId,
        invoiceId: invoice.id,
        planId: invoice.plan_id,
      },
    });

    // Update the invoice in our DB with this new stripe_session_id
    const { error: updErr } = await supabase
      .from("user_invoices")
      .update({ stripe_session_id: session.id })
      .eq("id", invoice.id);

    if (updErr) {
      console.error("Failed to link Stripe session to invoice:", updErr.message);
    }

    return { stripeUrl: session.url };
  });

// 4. Verify Stripe Checkout Session
export const verifyStripeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ sessionId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const stripe = getStripeClient();

    // 1. Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(data.sessionId);
    if (!session) throw new Error("Sessão da Stripe não encontrada.");

    // 2. If paid, update the database
    if (session.payment_status === "paid") {
      // Find the corresponding invoice in our DB
      const { data: invoice, error: invErr } = await supabase
        .from("user_invoices")
        .select("*")
        .eq("stripe_session_id", data.sessionId)
        .eq("user_id", userId)
        .maybeSingle();

      if (invErr) {
        throw new Error("Erro ao buscar fatura no banco.");
      }

      if (invoice) {
        if (invoice.status === "open") {
          // Update invoice to paid
          const { error: updErr } = await supabase
            .from("user_invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              stripe_invoice_id: typeof session.invoice === "string" ? session.invoice : null,
            })
            .eq("id", invoice.id);

          if (updErr) throw new Error("Erro ao quitar fatura no banco.");

          // Update user's profile active subscription plan
          const { error: profErr } = await supabase
            .from("profiles")
            .update({ subscription_plan: invoice.plan_id })
            .eq("id", userId);

          if (profErr) throw new Error("Erro ao atualizar o plano de assinatura.");
          
          return { success: true, planId: invoice.plan_id, status: "paid" };
        } else {
          return { success: true, planId: invoice.plan_id, status: "already_paid" };
        }
      }
    }

    return { success: false, status: session.payment_status };
  });

// 5. List all invoices for the current user
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
