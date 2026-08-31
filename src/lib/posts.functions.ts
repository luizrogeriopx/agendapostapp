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
  isRecurring: z.boolean().optional().default(false),
  recurrenceInterval: z.enum(["day", "week", "month"]).optional().nullable(),
  recurrenceEndType: z.enum(["indefinite", "until_date"]).optional().nullable(),
  recurrenceEndDate: z.string().optional().nullable(),
});

export function calculateNextRecurrenceDate(baseDate: Date, interval: "day" | "week" | "month"): Date {
  const next = new Date(baseDate.getTime());
  if (interval === "day") {
    next.setDate(next.getDate() + 1);
  } else if (interval === "week") {
    next.setDate(next.getDate() + 7);
  } else if (interval === "month") {
    const currentDay = next.getDate();
    next.setMonth(next.getMonth() + 1);
    if (next.getDate() !== currentDay) {
      next.setDate(0);
    }
  }
  return next;
}

export async function scheduleNextRecurrence(
  post: {
    id?: string;
    user_id: string;
    account_id: string;
    post_type: string;
    caption: string | null;
    media_urls: string[];
    scheduled_at: string;
    user_tags?: string[];
    location_id?: string | null;
    is_recurring?: boolean | null;
    recurrence_interval?: string | null;
    recurrence_end_type?: string | null;
    recurrence_end_date?: string | null;
  },
  supabaseClient: any,
) {
  if (!post.is_recurring || !post.recurrence_interval) {
    return null;
  }

  const interval = post.recurrence_interval as "day" | "week" | "month";
  if (!["day", "week", "month"].includes(interval)) {
    return null;
  }

  let nextDate = calculateNextRecurrenceDate(new Date(post.scheduled_at), interval);
  while (nextDate.getTime() <= Date.now()) {
    nextDate = calculateNextRecurrenceDate(nextDate, interval);
  }

  if (post.recurrence_end_type === "until_date" && post.recurrence_end_date) {
    const endDate = new Date(post.recurrence_end_date);
    if (nextDate.getTime() > endDate.getTime()) {
      return null;
    }
  }

  const { data: newPost, error } = await supabaseClient
    .from("scheduled_posts")
    .insert({
      user_id: post.user_id,
      account_id: post.account_id,
      post_type: post.post_type,
      caption: post.caption,
      media_urls: post.media_urls,
      scheduled_at: nextDate.toISOString(),
      status: "scheduled",
      user_tags: post.user_tags ?? [],
      location_id: post.location_id ?? null,
      is_recurring: true,
      recurrence_interval: post.recurrence_interval,
      recurrence_end_type: post.recurrence_end_type,
      recurrence_end_date: post.recurrence_end_date,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao agendar próxima repetição:", error);
    return null;
  }

  return newPost;
}

export const createScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => postSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch user profile and check active plan
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_plan")
      .eq("id", userId)
      .single();
    
    const planId = profile?.subscription_plan || "teste";

    if (planId === "automacaopro") {
      throw new Error("O seu plano atual (AutomaçãoPró) não inclui suporte a agendamento de postagens. Faça o upgrade de seu plano!");
    }

    if (planId === "teste") {
      // 1. Tagging restriction
      if (data.userTags && data.userTags.length > 0) {
        throw new Error("Marcação de perfis está disponível apenas no Plano AgendaPró ou Premium.");
      }

      // 2. Max 5 scheduled posts total restriction
      const { count, error: countErr } = await supabase
        .from("scheduled_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (countErr) throw new Error("Erro ao validar limite do plano.");
      if (count !== null && count >= 5) {
        throw new Error("Limite do Plano Teste atingido: você pode criar no máximo 5 agendamentos. Faça o upgrade para liberar agendamentos ilimitados!");
      }
    }

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

    const insertPayload: any = {
      user_id: userId,
      account_id: data.accountId,
      post_type: data.postType,
      caption: data.caption,
      media_urls: data.mediaPaths,
      scheduled_at: data.scheduledAt,
      status: "scheduled",
      user_tags: data.userTags ?? [],
      location_id: data.locationId ?? null,
    };

    if (data.isRecurring) {
      insertPayload.is_recurring = true;
      insertPayload.recurrence_interval = data.recurrenceInterval ?? "day";
      insertPayload.recurrence_end_type = data.recurrenceEndType ?? "indefinite";
      insertPayload.recurrence_end_date =
        data.recurrenceEndType === "until_date" ? data.recurrenceEndDate ?? null : null;
    } else {
      insertPayload.is_recurring = false;
      insertPayload.recurrence_interval = null;
      insertPayload.recurrence_end_type = null;
      insertPayload.recurrence_end_date = null;
    }

    let { data: post, error } = await supabase
      .from("scheduled_posts")
      .insert(insertPayload)
      .select()
      .single();

    if (error && (error.message?.includes("is_recurring") || error.message?.includes("schema cache"))) {
      if (!data.isRecurring) {
        delete insertPayload.is_recurring;
        delete insertPayload.recurrence_interval;
        delete insertPayload.recurrence_end_type;
        delete insertPayload.recurrence_end_date;
        const retry = await supabase
          .from("scheduled_posts")
          .insert(insertPayload)
          .select()
          .single();
        post = retry.data;
        error = retry.error;
      } else {
        throw new Error(
          "As colunas de repetição precisam ser criadas no Supabase. Por favor, execute a migração SQL no SQL Editor do Supabase.",
        );
      }
    }

    if (error) throw new Error(error.message);
    return post;
  });

export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let { data, error } = await context.supabase
      .from("scheduled_posts")
      .select(
        "id, post_type, caption, media_urls, scheduled_at, status, error_message, published_at, created_at, account_id, user_tags, location_id, is_recurring, recurrence_interval, recurrence_end_type, recurrence_end_date, instagram_accounts(username, name, profile_picture_url)",
      )
      .order("scheduled_at", { ascending: true });

    if (error && (error.message?.includes("is_recurring") || error.message?.includes("schema cache"))) {
      const fallback = await context.supabase
        .from("scheduled_posts")
        .select(
          "id, post_type, caption, media_urls, scheduled_at, status, error_message, published_at, created_at, account_id, user_tags, location_id, instagram_accounts(username, name, profile_picture_url)",
        )
        .order("scheduled_at", { ascending: true });
      data = (fallback.data ?? null) as typeof data;
      error = fallback.error;
    }

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
        isRecurring: z.boolean().optional(),
        recurrenceInterval: z.enum(["day", "week", "month"]).optional().nullable(),
        recurrenceEndType: z.enum(["indefinite", "until_date"]).optional().nullable(),
        recurrenceEndDate: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const updateData: any = {
      caption: data.caption,
      scheduled_at: data.scheduledAt,
    };
    if (data.isRecurring !== undefined) {
      updateData.is_recurring = data.isRecurring;
      updateData.recurrence_interval = data.isRecurring ? data.recurrenceInterval ?? "day" : null;
      updateData.recurrence_end_type = data.isRecurring ? data.recurrenceEndType ?? "indefinite" : null;
      updateData.recurrence_end_date =
        data.isRecurring && data.recurrenceEndType === "until_date"
          ? data.recurrenceEndDate ?? null
          : null;
    }
    const { data: post, error } = await supabase
      .from("scheduled_posts")
      .update(updateData)
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
      .select("id, post_type, caption, media_urls, account_id, user_id, status, user_tags, location_id, scheduled_at, is_recurring, recurrence_interval, recurrence_end_type, recurrence_end_date")
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

      // Schedule next recurrence if configured
      await scheduleNextRecurrence(post as any, supabaseAdmin);

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

