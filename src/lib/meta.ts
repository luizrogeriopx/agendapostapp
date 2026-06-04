// Shared Meta / Instagram Graph API constants (client-safe — no secrets here).
export const GRAPH_VERSION = "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const FB_OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

// Permissions required to list pages and publish to Instagram Business accounts.
export const META_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
];

export type PostType = "feed" | "carousel" | "reel" | "story";

export const POST_TYPE_LABELS: Record<PostType, string> = {
  feed: "Post (Feed)",
  carousel: "Carrossel",
  reel: "Reels",
  story: "Story",
};

export const POST_STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Falhou",
};
