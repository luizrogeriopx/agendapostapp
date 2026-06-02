import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAccounts } from "@/lib/instagram.functions";
import { createScheduledPost } from "@/lib/posts.functions";
import { POST_TYPE_LABELS, type PostType } from "@/lib/meta";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Agendar — Agendador de Instagram" }] }),
  component: SchedulePage,
});

type MediaItem = { path: string; url: string; isVideo: boolean };

function SchedulePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchAccounts = useServerFn(listAccounts);
  const createPost = useServerFn(createScheduledPost);

  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => fetchAccounts() });

  const [accountId, setAccountId] = useState("");
  const [postType, setPostType] = useState<PostType>("feed");
  const [caption, setCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allowMultiple = postType === "carousel";

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada.");

      const toUpload = allowMultiple ? Array.from(files).slice(0, 10) : [files[0]];
      const uploaded: MediaItem[] = [];
      for (const file of toUpload) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("post-media").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw error;
        const { data: signed } = await supabase.storage.from("post-media").createSignedUrl(path, 3600);
        uploaded.push({
          path,
          url: signed?.signedUrl || "",
          isVideo: file.type.startsWith("video"),
        });
      }
      setMedia((prev) => (allowMultiple ? [...prev, ...uploaded].slice(0, 10) : uploaded));
    } catch (e: any) {
      toast.error(e?.message || "Falha no upload.");
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (path: string) => setMedia((m) => m.filter((x) => x.path !== path));

  const submit = async () => {
    if (!accountId) return toast.error("Selecione uma conta.");
    if (media.length === 0) return toast.error("Envie ao menos uma mídia.");
    if (!scheduledAt) return toast.error("Escolha data e hora.");
    if (new Date(scheduledAt).getTime() < Date.now()) return toast.error("Escolha um horário futuro.");

    setSubmitting(true);
    try {
      await createPost({
        data: {
          accountId,
          postType,
          caption,
          mediaPaths: media.map((m) => m.path),
          scheduledAt: new Date(scheduledAt).toISOString(),
        },
      });
      toast.success("Publicação agendada!");
      qc.invalidateQueries({ queryKey: ["posts"] });
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao agendar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nova publicação</h1>
        <p className="text-sm text-muted-foreground">Agende um post, carrossel, reel ou story.</p>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Conecte uma conta do Instagram antes de agendar.
        </div>
      ) : (
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      @{a.username ?? a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={postType}
                onValueChange={(v) => {
                  setPostType(v as PostType);
                  setMedia([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(POST_TYPE_LABELS) as PostType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {POST_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mídia {allowMultiple && <span className="text-muted-foreground">(2 a 10)</span>}</Label>
            <div className="grid grid-cols-3 gap-3">
              {media.map((m) => (
                <div key={m.path} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  {m.isVideo ? (
                    <video src={m.url} className="h-full w-full object-cover" />
                  ) : (
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <button
                    onClick={() => removeMedia(m.path)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {(allowMultiple || media.length === 0) && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:bg-muted">
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span className="mt-1 text-xs">Enviar</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept={postType === "reel" ? "video/*" : "image/*,video/*"}
                    multiple={allowMultiple}
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                  />
                </label>
              )}
            </div>
          </div>

          {postType !== "story" && (
            <div className="space-y-2">
              <Label>Legenda</Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Escreva a legenda..."
                rows={4}
                maxLength={2200}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Data e hora</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
            {submitting ? "Agendando..." : "Agendar publicação"}
          </Button>
        </div>
      )}
    </div>
  );
}
