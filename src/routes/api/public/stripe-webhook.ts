import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

// POST handler for Stripe Webhooks.
export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!secretKey) {
          console.error("Stripe Secret Key missing in environment.");
          return Response.json({ error: "Stripe not configured on server" }, { status: 500 });
        }

        const stripe = new Stripe(secretKey);

        let event: Stripe.Event;

        try {
          const bodyText = await request.text();
          const sig = request.headers.get("stripe-signature");

          if (webhookSecret && sig) {
            // Secure verification with signature
            event = stripe.webhooks.constructEvent(bodyText, sig, webhookSecret);
          } else {
            // Fallback for development/testing when webhook secret is not set
            console.warn("Stripe webhook received without signature verification. Set STRIPE_WEBHOOK_SECRET in production.");
            event = JSON.parse(bodyText);
          }
        } catch (err: any) {
          console.error(`Webhook signature verification failed: ${err.message}`);
          return Response.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
        }

        console.log(`Received Stripe Webhook Event: ${event.type}`);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Handle the event
        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const metadata = session.metadata || {};
          const userId = metadata.userId;
          const planId = metadata.planId;
          const invoiceId = metadata.invoiceId;

          console.log(`Stripe Checkout Session completed for user: ${userId}, plan: ${planId}, session: ${session.id}`);

          if (userId && planId) {
            // 1. Update user profile subscription plan
            const { error: profileErr } = await supabaseAdmin
              .from("profiles")
              .update({ subscription_plan: planId })
              .eq("id", userId);

            if (profileErr) {
              console.error(`Failed to update profile plan in webhook:`, profileErr.message);
            } else {
              console.log(`Successfully upgraded user ${userId} to plan ${planId} via webhook.`);
            }

            // 2. Update the invoice to paid
            // We can match by metadata.invoiceId or by stripe_session_id
            let query = supabaseAdmin
              .from("user_invoices")
              .update({
                status: "paid",
                paid_at: new Date().toISOString(),
                stripe_invoice_id: typeof session.invoice === "string" ? session.invoice : null,
              });

            if (invoiceId) {
              query = query.eq("id", invoiceId);
            } else {
              query = query.eq("stripe_session_id", session.id);
            }

            const { error: invErr } = await query;
            if (invErr) {
              console.error(`Failed to update invoice in webhook:`, invErr.message);
            } else {
              console.log(`Successfully marked invoice as paid for session ${session.id} via webhook.`);
            }
          }
        }

        return Response.json({ received: true });
      },
    },
  },
});
