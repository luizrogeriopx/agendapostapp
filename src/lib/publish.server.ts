// Server-only Instagram publishing logic. Imported by the cron route handler.
import { GRAPH_BASE } from "./meta";

type Account = { ig_user_id: string; access_token: string };
type Post = {
  id: string;
  post_type: string;
  caption: string | null;
  media_urls: string[];
};

async function graphPost(path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${GRAPH_BASE}/${path}`, { method: "POST", body });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Graph API error em ${path}`);
  }
  return json;
}

async function waitForContainer(containerId: string, token: string) {
  // Reels/videos are processed asynchronously; poll until FINISHED.
  for (let i = 0; i < 20; i++) {
    const res = await fetch(
      `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${token}`,
    );
    const json = await res.json();
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") throw new Error("Falha no processamento da mídia pela Meta.");
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Tempo esgotado aguardando o processamento da mídia.");
}

function isVideo(url: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

export async function publishToInstagram(
  post: Post,
  account: Account,
  signedUrls: string[],
): Promise<string> {
  const igId = account.ig_user_id;
  const token = account.access_token;
  const caption = post.caption ?? "";

  let creationId: string;

  if (post.post_type === "carousel") {
    // Create each child container, then a parent carousel container.
    const childIds: string[] = [];
    for (const url of signedUrls) {
      const params: Record<string, string> = { is_carousel_item: "true", access_token: token };
      if (isVideo(url)) {
        params.media_type = "VIDEO";
        params.video_url = url;
      } else {
        params.image_url = url;
      }
      const child = await graphPost(`${igId}/media`, params);
      if (isVideo(url)) await waitForContainer(child.id, token);
      childIds.push(child.id);
    }
    const parent = await graphPost(`${igId}/media`, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
      access_token: token,
    });
    creationId = parent.id;
  } else {
    const url = signedUrls[0];
    const params: Record<string, string> = { access_token: token, caption };

    if (post.post_type === "reel") {
      params.media_type = "REELS";
      params.video_url = url;
    } else if (post.post_type === "story") {
      params.media_type = "STORIES";
      if (isVideo(url)) params.video_url = url;
      else params.image_url = url;
      delete params.caption; // Stories don't support captions
    } else {
      // feed
      if (isVideo(url)) {
        params.media_type = "REELS"; // single video posts go to Reels
        params.video_url = url;
      } else {
        params.image_url = url;
      }
    }

    const container = await graphPost(`${igId}/media`, params);
    if (isVideo(url) || post.post_type === "reel") {
      await waitForContainer(container.id, token);
    }
    creationId = container.id;
  }

  const published = await graphPost(`${igId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  return published.id as string;
}
