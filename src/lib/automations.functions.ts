import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GRAPH_BASE } from "./meta";

const automationSchema = z.object({
  accountId: z.string().uuid(),
  mediaId: z.string().min(1),
  mediaPermalink: z.string().url().optional(),
  mediaThumbnail: z.string().url().optional(),
  mediaCaption: z.string().optional().default(""),
  triggerWords: z.array(z.string().min(1)).default([]),
  commentReply: z.string().min(1),
  dmReply: z.string().min(1),
  isActive: z.boolean().default(true),
});

// Helper to subscribe a Facebook Page to our app's webhooks.
// Necessary to start receiving comment and message webhooks.
const subscribePageToApp = async (pageId: string, pageToken: string) => {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${pageId}/subscribed_apps?subscribed_fields=feed&access_token=${pageToken}`,
      { method: "POST" }
    );
    const json = await res.json();
    if (!res.ok) {
      console.warn("Meta Webhook subscription warning:", json.error?.message);
    }
    return json.success || false;
  } catch (err) {
    console.error("Meta Webhook subscription error:", err);
    return false;
  }
};

// 1. Lists recent media from the connected Instagram account
export const listInstagramMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ accountId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Fetch the account access token and business account ID
    const { data: account, error: accErr } = await supabase
      .from("instagram_accounts")
      .select("id, ig_user_id, access_token")
      .eq("id", data.accountId)
      .single();

    if (accErr || !account) throw new Error("Conta do Instagram não encontrada.");

    // Call Instagram Graph API to list recent media
    const mediaRes = await fetch(
      `${GRAPH_BASE}/${account.ig_user_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=25&access_token=${account.access_token}`
    );
    const mediaJson = await mediaRes.json();
    if (!mediaRes.ok) {
      throw new Error(mediaJson.error?.message || "Falha ao carregar publicações do Instagram.");
    }

    const items: any[] = mediaJson.data || [];

    // Query our DB to find existing automations for these media items
    const mediaIds = items.map((item) => item.id);
    let automationsMap: Record<string, any> = {};

    if (mediaIds.length > 0) {
      const { data: automations } = await supabase
        .from("instagram_automations")
        .select("*")
        .eq("account_id", data.accountId)
        .in("media_id", mediaIds);

      if (automations) {
        automationsMap = automations.reduce((acc, curr) => {
          acc[curr.media_id] = curr;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Attach automation state to the response
    return items.map((item) => ({
      id: item.id,
      caption: item.caption ?? "",
      mediaType: item.media_type,
      mediaUrl: item.media_url,
      thumbnailUrl: item.thumbnail_url || item.media_url,
      permalink: item.permalink,
      timestamp: item.timestamp,
      automation: automationsMap[item.id] || null,
    }));
  });

// 2. Saves or updates an automation rule for a specific media item
export const saveAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => automationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Verify and retrieve page credentials
    const { data: account, error: accErr } = await supabase
      .from("instagram_accounts")
      .select("id, page_id, access_token")
      .eq("id", data.accountId)
      .single();

    if (accErr || !account) throw new Error("Conta do Instagram não encontrada.");

    // 2. Save automation rule in the database
    const { data: result, error } = await supabase
      .from("instagram_automations")
      .upsert(
        {
          user_id: userId,
          account_id: data.accountId,
          media_id: data.mediaId,
          media_permalink: data.mediaPermalink ?? null,
          media_thumbnail: data.mediaThumbnail ?? null,
          media_caption: data.mediaCaption ?? null,
          trigger_words: data.triggerWords,
          comment_reply: data.commentReply,
          dm_reply: data.dmReply,
          is_active: data.isActive,
        },
        { onConflict: "account_id,media_id" }
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    // 3. Subscribe page to webhooks asynchronously (non-blocking if it warning-fails)
    if (account.page_id && account.access_token) {
      await subscribePageToApp(account.page_id, account.access_token);
    }

    return result;
  });

// 3. Lists all configured automations for the user
export const listAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("instagram_automations")
      .select("*, instagram_accounts(username, name, profile_picture_url)")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

// 4. Deletes a specific automation rule
export const deleteAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("instagram_automations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 5. Retrieves current subscription status of a Page to check for diagnostic connection
export const getPageSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ accountId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: account, error: accErr } = await supabase
      .from("instagram_accounts")
      .select("page_id, access_token")
      .eq("id", data.accountId)
      .single();

    if (accErr || !account || !account.page_id || !account.access_token) {
      throw new Error("Página ou token de acesso não encontrados para esta conta.");
    }

    try {
      const res = await fetch(
        `${GRAPH_BASE}/${account.page_id}/subscribed_apps?access_token=${account.access_token}`
      );
      const json = await res.json();
      return { ok: res.ok, data: json.data || json };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });
