import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GRAPH_BASE } from "./meta";

// Returns whether the Meta app is configured and exposes the public App ID.
export const getMetaConfig = createServerFn({ method: "GET" }).handler(async () => {
  const appId = process.env.META_APP_ID ?? "";
  const hasSecret = !!process.env.META_APP_SECRET;
  return { appId, configured: !!appId && hasSecret };
});

// Exchanges the OAuth code for a long-lived token and stores all
// Instagram Business accounts linked to the user's Facebook Pages.
export const connectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        code: z.string().min(1).max(2000),
        redirectUri: z.string().url().max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("O app da Meta ainda não foi configurado (App ID / App Secret).");
    }

    // 1. Code -> short-lived token
    const tokenRes = await fetch(
      `${GRAPH_BASE}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}` +
        `&redirect_uri=${encodeURIComponent(data.redirectUri)}&code=${encodeURIComponent(data.code)}`,
    );
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error?.message || "Falha ao trocar o código de autorização.");
    }

    // 2. Short-lived -> long-lived token (~60 days)
    const longRes = await fetch(
      `${GRAPH_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}` +
        `&client_secret=${appSecret}&fb_exchange_token=${tokenJson.access_token}`,
    );
    const longJson = await longRes.json();
    const userToken = longJson.access_token || tokenJson.access_token;
    const expiresIn = longJson.expires_in || 60 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3. List pages + their linked Instagram Business accounts
    const pagesRes = await fetch(
      `${GRAPH_BASE}/me/accounts?fields=name,id,access_token,` +
        `instagram_business_account{id,username,name,profile_picture_url}&access_token=${userToken}`,
    );
    const pagesJson = await pagesRes.json();
    if (!pagesRes.ok) {
      throw new Error(pagesJson.error?.message || "Falha ao buscar páginas do Facebook.");
    }

    const pages: any[] = pagesJson.data || [];
    const igPages = pages.filter((p) => p.instagram_business_account);

    if (igPages.length === 0) {
      throw new Error(
        "Nenhuma conta Instagram Business encontrada. Vincule sua conta Instagram a uma Página do Facebook.",
      );
    }

    const { supabase, userId } = context;
    const rows = igPages.map((p) => ({
      user_id: userId,
      ig_user_id: p.instagram_business_account.id,
      username: p.instagram_business_account.username ?? null,
      name: p.instagram_business_account.name ?? null,
      profile_picture_url: p.instagram_business_account.profile_picture_url ?? null,
      page_id: p.id,
      page_name: p.name ?? null,
      access_token: p.access_token,
      token_expires_at: expiresAt,
    }));

    const { error } = await supabase
      .from("instagram_accounts")
      .upsert(rows, { onConflict: "user_id,ig_user_id" });
    if (error) throw new Error(error.message);

    return { connected: rows.length, accounts: rows.map((r) => r.username || r.name) };
  });

// Lists the user's connected Instagram accounts (without exposing tokens).
export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("instagram_accounts")
      .select("id, ig_user_id, username, name, profile_picture_url, page_name, token_expires_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("instagram_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
