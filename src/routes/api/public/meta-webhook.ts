import { createFileRoute } from "@tanstack/react-router";
import { GRAPH_BASE } from "@/lib/meta";

// GET and POST handlers for Meta Webhooks verification and events processing.
export const Route = createFileRoute("/api/public/meta-webhook")({
  server: {
    handlers: {
      // 1. Handshake verification (GET)
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        // Verification token. Developers configure this in their .env
        const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "agendador_ig_verify_token";

        if (mode === "subscribe" && token === verifyToken) {
          console.log("Meta Webhook handshake verified successfully!");
          return new Response(challenge, { status: 200 });
        }

        console.warn("Meta Webhook verification mismatch. Expected verify token:", verifyToken, "but got:", token);
        return new Response("Forbidden", { status: 403 });
      },

      // 2. Incoming Event Processing (POST)
      POST: async ({ request }) => {
        let payload: any = null;
        try {
          payload = await request.json();
          console.log("Received Meta Webhook Event:", JSON.stringify(payload, null, 2));
        } catch (jsonErr: any) {
          console.error("Failed to parse JSON body:", jsonErr);
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Write payload to database for live debugging
        try {
          await supabaseAdmin
            .from("webhook_logs")
            .insert({ payload });
        } catch (logErr) {
          console.error("Failed to write to webhook_logs:", logErr);
        }

        try {
          // Ensure it is an instagram object webhook
          if (payload.object !== "instagram") {
            return Response.json({ ok: true, ignored: "non-instagram object" });
          }

          for (const entry of payload.entry || []) {
            const igUserId = entry.id; // Instagram Business Account ID
            if (!igUserId) continue;

            // Retrieve page credentials from database
            const { data: account, error: accErr } = await supabaseAdmin
              .from("instagram_accounts")
              .select("id, access_token, page_id")
              .eq("ig_user_id", igUserId)
              .single();

            if (accErr || !account) {
              console.warn(`No connected Instagram account found in database for ig_user_id: ${igUserId}`);
              continue;
            }

            for (const change of entry.changes || []) {
              if (change.field !== "comments") continue;

              const value = change.value;
              if (!value) continue;

              const commentId = value.id;
              const mediaId = value.media?.id;
              const commentText = value.text || "";
              const commenterId = value.from?.id;
              const commenterUsername = value.from?.username;

              if (!commentId || !mediaId || !commenterId) continue;

              // Security: Prevent infinite loops by not responding to comments made by ourselves
              if (commenterId === igUserId) {
                console.log(`Skipping self-comment on media: ${mediaId}`);
                continue;
              }

              // Fetch the active automation rule for this specific media post
              const { data: automation, error: autErr } = await supabaseAdmin
                .from("instagram_automations")
                .select("*")
                .eq("account_id", account.id)
                .eq("media_id", mediaId)
                .eq("is_active", true)
                .maybeSingle();

              if (autErr || !automation) {
                console.log(`No active automation configured for media_id: ${mediaId}`);
                continue;
              }

              // Fetch owner profile to check subscription plan
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("subscription_plan")
                .eq("id", automation.user_id)
                .single();

              const planId = profile?.subscription_plan || "teste";

              if (planId === "agendapro") {
                console.log(`Skipping automation: Owner has 'agendapro' plan which does not support automations.`);
                continue;
              }

              if (planId === "teste") {
                if (automation.reply_count >= 3) {
                  console.log(`Skipping automation: Plano Teste reply limit (3) reached for automation ${automation.id}.`);
                  continue;
                }
              }

              // Check if keyword matches
              const cleanText = commentText.toLowerCase().trim();
              const words = automation.trigger_words || [];

              // Match if no trigger words are set, or if comment text contains any trigger keyword
              const isMatch =
                words.length === 0 ||
                words.some((word) => cleanText.includes(word.toLowerCase().trim()));

              if (!isMatch) {
                console.log(`Comment "${commentText}" does not trigger keywords:`, words);
                continue;
              }

              console.log(
                `Triggering automation ${automation.id} for comment "${commentText}" on post ${mediaId}`
              );

              let repliedSuccessfully = false;

              // 1. Send public reply to the comment
              try {
                const replyRes = await fetch(
                  `${GRAPH_BASE}/${commentId}/replies?message=${encodeURIComponent(
                    automation.comment_reply
                  )}&access_token=${account.access_token}`,
                  { method: "POST" }
                );
                const replyJson = await replyRes.json();
                if (!replyRes.ok) {
                  console.error(`Failed to comment reply back on Instagram:`, replyJson.error);
                } else {
                  console.log(`Successfully replied to comment ${commentId}`);
                  repliedSuccessfully = true;
                }
              } catch (replyErr) {
                console.error(`Error sending comment reply request:`, replyErr);
              }

              // 2. Send private reply via Direct Message (PWA Inbox integration)
              try {
                // Private reply uses the standard Send API endpoint using the Facebook page token
                const dmRes = await fetch(
                  `${GRAPH_BASE}/me/messages?access_token=${account.access_token}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      recipient: {
                        comment_id: commentId,
                      },
                      message: {
                        text: automation.dm_reply,
                      },
                    }),
                  }
                );
                const dmJson = await dmRes.json();
                if (!dmRes.ok) {
                  console.error(`Failed to send Direct Message private reply:`, dmJson.error);
                } else {
                  console.log(`Successfully sent Direct Message reply to commenter ${commenterUsername}`);
                  repliedSuccessfully = true;
                }
              } catch (dmErr) {
                console.error(`Error sending Direct Message request:`, dmErr);
              }

              // Increment counter for Teste plan if execution succeeded
              if (repliedSuccessfully && planId === "teste") {
                await supabaseAdmin
                  .from("instagram_automations")
                  .update({ reply_count: automation.reply_count + 1 })
                  .eq("id", automation.id);
                console.log(`Plano Teste: Incremented reply_count for automation ${automation.id}`);
              }
            }
          }

          return Response.json({ ok: true });
        } catch (e: any) {
          console.error("Webhook processing error:", e);
          return Response.json({ error: e?.message || "Internal Server Error" }, { status: 500 });
        }
      },
    },
  },
});
