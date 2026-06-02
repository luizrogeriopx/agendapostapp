import { createFileRoute } from "@tanstack/react-router";

// Cron endpoint: publishes all scheduled posts whose time has come.
// Called periodically by pg_cron. Public prefix bypasses edge auth; we keep
// the work read/write scoped server-side with the service role.
export const Route = createFileRoute("/api/public/publish-due")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { publishToInstagram } = await import("@/lib/publish.server");

        const nowIso = new Date().toISOString();
        const { data: duePosts, error } = await supabaseAdmin
          .from("scheduled_posts")
          .select("id, post_type, caption, media_urls, account_id, user_id")
          .eq("status", "scheduled")
          .lte("scheduled_at", nowIso)
          .limit(10);

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const results: Array<{ id: string; ok: boolean; error?: string }> = [];

        for (const post of duePosts ?? []) {
          // Lock the post so concurrent runs don't double-publish.
          const { data: locked } = await supabaseAdmin
            .from("scheduled_posts")
            .update({ status: "publishing" })
            .eq("id", post.id)
            .eq("status", "scheduled")
            .select("id")
            .maybeSingle();
          if (!locked) continue;

          try {
            const { data: account, error: accErr } = await supabaseAdmin
              .from("instagram_accounts")
              .select("ig_user_id, access_token")
              .eq("id", post.account_id)
              .single();
            if (accErr || !account) throw new Error("Conta do Instagram não encontrada.");

            // Generate signed URLs the Meta servers can download.
            const signedUrls: string[] = [];
            for (const path of post.media_urls as string[]) {
              const { data: signed, error: sErr } = await supabaseAdmin.storage
                .from("post-media")
                .createSignedUrl(path, 3600);
              if (sErr || !signed?.signedUrl) throw new Error("Falha ao gerar URL da mídia.");
              signedUrls.push(signed.signedUrl);
            }

            const igMediaId = await publishToInstagram(post as any, account, signedUrls);

            await supabaseAdmin
              .from("scheduled_posts")
              .update({
                status: "published",
                ig_media_id: igMediaId,
                published_at: new Date().toISOString(),
                error_message: null,
              })
              .eq("id", post.id);
            results.push({ id: post.id, ok: true });
          } catch (e: any) {
            await supabaseAdmin
              .from("scheduled_posts")
              .update({ status: "failed", error_message: e?.message ?? "Erro desconhecido" })
              .eq("id", post.id);
            results.push({ id: post.id, ok: false, error: e?.message });
          }
        }

        return Response.json({ processed: results.length, results });
      },
    },
  },
});
