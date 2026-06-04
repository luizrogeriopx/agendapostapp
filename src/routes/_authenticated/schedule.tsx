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
import { Upload, X, Loader2, CalendarDays, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Agendar — Agendador de Instagram" }] }),
  component: SchedulePage,
});

type MediaItem = { path: string; url: string; isVideo: boolean };

const STRATEGIC_HOURS = [
  { hour: 12, minute: 15 },
  { hour: 18, minute: 30 },
  { hour: 20, minute: 45 },
];

function SchedulePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchAccounts = useServerFn(listAccounts);
  const createPost = useServerFn(createScheduledPost);

  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => fetchAccounts() });

  const [scheduleMode, setScheduleMode] = useState<"individual" | "bulk">("individual");
  const [accountId, setAccountId] = useState("");
  const [postType, setPostType] = useState<PostType>("feed");
  const [caption, setCaption] = useState("");
  
  // Individual Mode State
  const [scheduledAt, setScheduledAt] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  
  // Bulk Mode State
  const [bulkMedia, setBulkMedia] = useState<MediaItem[]>([]);
  const [bulkStartDate, setBulkStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allowMultiple = postType === "carousel" && scheduleMode === "individual";

  const getBulkScheduledDate = (index: number, startDateStr: string) => {
    const baseDate = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
    if (!startDateStr) {
      baseDate.setDate(baseDate.getDate() + 1);
    }
    const date = new Date(baseDate);
    date.setDate(date.getDate() + index);
    const timeSlot = STRATEGIC_HOURS[index % STRATEGIC_HOURS.length];
    date.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
    return date;
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada.");

      const isBulk = scheduleMode === "bulk";
      const toUpload = isBulk ? Array.from(files) : (allowMultiple ? Array.from(files).slice(0, 10) : [files[0]]);

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

      if (isBulk) {
        setBulkMedia((prev) => [...prev, ...uploaded]);
      } else {
        setMedia((prev) => (allowMultiple ? [...prev, ...uploaded].slice(0, 10) : uploaded));
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha no upload.");
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (path: string) => setMedia((m) => m.filter((x) => x.path !== path));
  const removeBulkMedia = (path: string) => setBulkMedia((m) => m.filter((x) => x.path !== path));

  const submitIndividual = async () => {
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

  const submitBulk = async () => {
    if (!accountId) return toast.error("Selecione uma conta.");
    if (bulkMedia.length === 0) return toast.error("Envie ao menos uma mídia.");
    if (!bulkStartDate) return toast.error("Selecione a data de início.");

    setSubmitting(true);
    try {
      const promises = bulkMedia.map((m, idx) => {
        const scheduledTime = getBulkScheduledDate(idx, bulkStartDate).toISOString();
        return createPost({
          data: {
            accountId,
            postType,
            caption: postType === "story" ? "" : caption,
            mediaPaths: [m.path],
            scheduledAt: scheduledTime,
          },
        });
      });

      await Promise.all(promises);
      toast.success(`${bulkMedia.length} publicações agendadas em massa!`);
      qc.invalidateQueries({ queryKey: ["posts"] });
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao agendar em massa.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Criar publicação</h1>
          <p className="text-sm text-muted-foreground">Agende mídias para as suas contas.</p>
        </div>
      </div>

      {/* Alternador de Modos */}
      <div className="flex border-b border-muted">
        <button
          onClick={() => {
            setScheduleMode("individual");
            setBulkMedia([]);
            setMedia([]);
          }}
          className={cn(
            "pb-3 text-sm font-semibold border-b-2 px-4 transition-colors",
            scheduleMode === "individual"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Agendamento Individual
        </button>
        <button
          onClick={() => {
            setScheduleMode("bulk");
            setBulkMedia([]);
            setMedia([]);
            if (postType === "carousel") setPostType("feed");
          }}
          className={cn(
            "pb-3 text-sm font-semibold border-b-2 px-4 transition-colors",
            scheduleMode === "bulk"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Agendamento em Massa (Lote)
        </button>
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
              <Label>Tipo de Post</Label>
              <Select
                value={postType}
                onValueChange={(v) => {
                  setPostType(v as PostType);
                  setMedia([]);
                  setBulkMedia([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(POST_TYPE_LABELS) as PostType[])
                    .filter((t) => !(scheduleMode === "bulk" && t === "carousel")) // Exclude carousel for bulk
                    .map((t) => (
                      <SelectItem key={t} value={t}>
                        {POST_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mídia: Upload Uploader */}
          <div className="space-y-2">
            <Label>
              {scheduleMode === "bulk"
                ? "Mídias para Agendar em Massa"
                : `Mídia ${allowMultiple ? "(2 a 10)" : "(Apenas 1)"}`}
            </Label>
            
            {scheduleMode === "individual" ? (
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
            ) : (
              // Bulk upload layout
              <div className="space-y-3">
                <label className="flex py-8 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:bg-muted">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-primary mb-1" />
                      <span className="text-sm font-medium text-foreground">Selecionar vários arquivos</span>
                      <span className="text-xs text-muted-foreground mt-1">Carregue fotos ou vídeos para distribuir em lote</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept={postType === "reel" ? "video/*" : "image/*,video/*"}
                    multiple
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                    disabled={uploading}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Legenda (Oculto para Stories) */}
          {postType !== "story" && (
            <div className="space-y-2">
              <Label>
                {scheduleMode === "bulk" ? "Legenda Unificada (Aplicada a todos os posts)" : "Legenda"}
              </Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Escreva a legenda..."
                rows={4}
                maxLength={2200}
              />
            </div>
          )}

          {/* Seção Data/Hora do Agendamento */}
          {scheduleMode === "individual" ? (
            <div className="space-y-2">
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data de início da fila</Label>
                <Input
                  type="date"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Previsão do Cronograma em Massa */}
          {scheduleMode === "bulk" && bulkMedia.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <Label className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Eye className="h-4.5 w-4.5 text-primary" /> Cronograma de Agendamento ({bulkMedia.length} posts)
              </Label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {bulkMedia.map((m, idx) => (
                  <div key={m.path} className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-muted border shrink-0">
                        {m.isVideo ? (
                          <video src={m.url} className="h-full w-full object-cover" />
                        ) : (
                          <img src={m.url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Post {idx + 1}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Agendado: <span className="font-semibold text-foreground">{getBulkScheduledDate(idx, bulkStartDate).toLocaleString("pt-BR")}</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/5"
                      onClick={() => removeBulkMedia(m.path)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botão de Envio */}
          {scheduleMode === "individual" ? (
            <Button onClick={submitIndividual} disabled={submitting} className="w-full" size="lg">
              {submitting ? "Agendando..." : "Agendar publicação"}
            </Button>
          ) : (
            <Button
              onClick={submitBulk}
              disabled={submitting || bulkMedia.length === 0}
              className="w-full gap-2"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Agendando em Lote...
                </>
              ) : (
                <>
                  <CalendarDays className="h-5 w-5" /> Agendar {bulkMedia.length} posts em massa
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

