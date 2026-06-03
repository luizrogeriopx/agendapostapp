import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Helper to verify admin permissions on the server
async function ensureAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !profile || profile.role !== "admin") {
    throw new Error("Acesso negado: você não é um administrador do sistema.");
  }
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    return { isAdmin: profile?.role === "admin", role: profile?.role || "user" };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await ensureAdmin(userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch all auth users (to get email and metadata)
    const { data: { users }, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
    if (authErr) throw new Error(authErr.message);

    // 2. Fetch all profiles
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url, role, created_at");
    if (profErr) throw new Error(profErr.message);

    // 3. Fetch Instagram account counts per user
    const { data: igAccounts } = await supabaseAdmin
      .from("instagram_accounts")
      .select("user_id");
    const igCounts: Record<string, number> = {};
    igAccounts?.forEach((x) => {
      igCounts[x.user_id] = (igCounts[x.user_id] || 0) + 1;
    });

    // 4. Fetch Scheduled posts counts per user
    const { data: posts } = await supabaseAdmin
      .from("scheduled_posts")
      .select("user_id, status");
    const postsCounts: Record<string, { scheduled: number; published: number; total: number }> = {};
    posts?.forEach((x) => {
      if (!postsCounts[x.user_id]) {
        postsCounts[x.user_id] = { scheduled: 0, published: 0, total: 0 };
      }
      postsCounts[x.user_id].total += 1;
      if (x.status === "scheduled") postsCounts[x.user_id].scheduled += 1;
      else if (x.status === "published") postsCounts[x.user_id].published += 1;
    });

    // 5. Combine data
    const combinedUsers = profiles.map((profile) => {
      const authUser = users.find((u) => u.id === profile.id);
      return {
        id: profile.id,
        displayName: profile.display_name || authUser?.user_metadata?.name || authUser?.user_metadata?.full_name || "Sem nome",
        email: authUser?.email || "Sem e-mail",
        avatarUrl: profile.avatar_url || authUser?.user_metadata?.avatar_url || "",
        role: profile.role || "user",
        createdAt: profile.created_at,
        igCount: igCounts[profile.id] || 0,
        postsStats: postsCounts[profile.id] || { scheduled: 0, published: 0, total: 0 },
      };
    });

    // Sort: admins first, then by registration date
    return combinedUsers.sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (a.role !== "admin" && b.role === "admin") return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        role: z.enum(["user", "admin"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await ensureAdmin(userId);

    // Prevent removing own admin role to avoid lockout
    if (data.targetUserId === userId) {
      throw new Error("Você não pode revogar o seu próprio cargo de administrador.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.targetUserId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ targetUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await ensureAdmin(userId);

    // Prevent deleting oneself
    if (data.targetUserId === userId) {
      throw new Error("Você não pode excluir a sua própria conta de administrador.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Deleting the user from auth.users will trigger CASCADE delete in profiles,
    // instagram_accounts, and scheduled_posts due to FOREIGN KEY settings.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(error.message);

    return { success: true };
  });
