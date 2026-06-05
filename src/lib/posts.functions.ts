import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const postSchema = z.object({
  accountId: z.string().uuid(),
  postType: z.enum(["feed", "carousel", "reel", "story"]),
  caption: z.string().max(2200).optional().default(""),
  mediaPaths: z.array(z.string().min(1).max(500)).min(1).max(10),
  scheduledAt: z.string().datetime(),
  userTags: z.array(z.string()).optional(),
  locationId: z.string().optional(),
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
        user_tags: data.userTags ?? [],
        location_id: data.locationId ?? null,
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
        "id, post_type, caption, media_urls, scheduled_at, status, error_message, published_at, created_at, account_id, user_tags, location_id, instagram_accounts(username, name, profile_picture_url)",
      )
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);

    const posts = data ?? [];
    if (posts.length === 0) return [];

    // Collect first path of each post to batch generate signed URLs
    const pathsToSign: string[] = [];
    const pathMap = new Map<string, string>(); // path -> post.id

    for (const post of posts) {
      const mediaList = post.media_urls as string[] | null;
      if (mediaList && mediaList.length > 0) {
        const firstPath = mediaList[0];
        if (firstPath) {
          pathsToSign.push(firstPath);
          pathMap.set(firstPath, post.id);
        }
      }
    }

    if (pathsToSign.length > 0) {
      const { data: signedData, error: signedErr } = await context.supabase.storage
        .from("post-media")
        .createSignedUrls(pathsToSign, 3600);

      if (!signedErr && signedData) {
        const urlMap = new Map<string, string>(); // post.id -> signedUrl
        for (const item of signedData) {
          if (item.signedUrl && item.path) {
            const postId = pathMap.get(item.path);
            if (postId) {
              urlMap.set(postId, item.signedUrl);
            }
          }
        }

        // Attach thumbnailUrl to each post object
        for (const post of posts) {
          (post as any).thumbnailUrl = urlMap.get(post.id) || null;
        }
      }
    }

    return posts;
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scheduled_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        caption: z.string().max(2200).optional().default(""),
        scheduledAt: z.string().datetime(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: post, error } = await supabase
      .from("scheduled_posts")
      .update({
        caption: data.caption,
        scheduled_at: data.scheduledAt,
      })
      .eq("id", data.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return post;
  });

export const publishPostNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publishToInstagram } = await import("@/lib/publish.server");

    // Fetch the post and check ownership
    const { data: post, error: pErr } = await supabaseAdmin
      .from("scheduled_posts")
      .select("id, post_type, caption, media_urls, account_id, user_id, status")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();

    if (pErr || !post) throw new Error("Publicação não encontrada.");
    if (post.status === "published") throw new Error("Esta publicação já foi postada.");

    // Update status to "publishing"
    await supabaseAdmin
      .from("scheduled_posts")
      .update({ status: "publishing" })
      .eq("id", post.id);

    try {
      // Get the Instagram account
      const { data: account, error: accErr } = await supabaseAdmin
        .from("instagram_accounts")
        .select("ig_user_id, access_token")
        .eq("id", post.account_id)
        .single();
      if (accErr || !account) throw new Error("Conta do Instagram não encontrada.");

      // Generate signed URLs for media
      const signedUrls: string[] = [];
      for (const path of post.media_urls as string[]) {
        const { data: signed, error: sErr } = await supabaseAdmin.storage
          .from("post-media")
          .createSignedUrl(path, 3600);
        if (sErr || !signed?.signedUrl) throw new Error("Falha ao gerar URL da mídia.");
        signedUrls.push(signed.signedUrl);
      }

      // Publish to Instagram
      const igMediaId = await publishToInstagram(post as any, account, signedUrls);

      // Update post status to published
      await supabaseAdmin
        .from("scheduled_posts")
        .update({
          status: "published",
          ig_media_id: igMediaId,
          published_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", post.id);

      return { ok: true, igMediaId };
    } catch (e: any) {
      // Revert status to failed
      await supabaseAdmin
        .from("scheduled_posts")
        .update({ status: "failed", error_message: e?.message ?? "Erro desconhecido" })
        .eq("id", post.id);
      throw new Error(e?.message || "Falha ao publicar no Instagram.");
    }
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

