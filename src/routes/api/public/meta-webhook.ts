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
        try {
          const payload = await request.json();
          console.log("Received Meta Webhook Event:", JSON.stringify(payload, null, 2));

          // Ensure it is an instagram object webhook
          if (payload.object !== "instagram") {
            return Response.json({ ok: true, ignored: "non-instagram object" });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
                }
              } catch (dmErr) {
                console.error(`Error sending Direct Message request:`, dmErr);
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
