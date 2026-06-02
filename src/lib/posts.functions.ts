import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const postSchema = z.object({
  accountId: z.string().uuid(),
  postType: z.enum(["feed", "carousel", "reel", "story"]),
  caption: z.string().max(2200).optional().default(""),
  mediaPaths: z.array(z.string().min(1).max(500)).min(1).max(10),
  scheduledAt: z.string().datetime(),
});

export const createScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => postSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ensure the account belongs to the user
    const { data: account, error: accErr } = await supabase
      .from("instagram_accounts")
      .select("id")
      .eq("id", data.accountId)
      .single();
    if (accErr || !account) throw new Error("Conta do Instagram inválida.");

    if (data.postType === "carousel" && data.mediaPaths.length < 2) {
      throw new Error("Um carrossel precisa de pelo menos 2 mídias.");
    }
    if (data.postType !== "carousel" && data.mediaPaths.length > 1) {
      throw new Error("Este tipo de publicação aceita apenas 1 mídia.");
    }

    const { data: post, error } = await supabase
      .from("scheduled_posts")
      .insert({
        user_id: userId,
        account_id: data.accountId,
        post_type: data.postType,
        caption: data.caption,
        media_urls: data.mediaPaths,
        scheduled_at: data.scheduledAt,
        status: "scheduled",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return post;
  });

export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scheduled_posts")
      .select(
        "id, post_type, caption, media_urls, scheduled_at, status, error_message, published_at, created_at, instagram_accounts(username, name, profile_picture_url)",
      )
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scheduled_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Creates short-lived signed URLs so the UI can preview private media.
export const getPreviewUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ paths: z.array(z.string().min(1).max(500)).max(10) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const result: Record<string, string> = {};
    for (const path of data.paths) {
      const { data: signed } = await context.supabase.storage
        .from("post-media")
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) result[path] = signed.signedUrl;
    }
    return result;
  });
