import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAccounts } from "@/lib/instagram.functions";
import { createScheduledPost, listPosts } from "@/lib/posts.functions";
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

const STRATEGIC_SLOTS = [
  { startHour: 8, startMinute: 0 },
  { startHour: 12, startMinute: 15 },
  { startHour: 18, startMinute: 30 },
  { startHour: 20, startMinute: 45 },
];

const isSameCategory = (t1: string, t2: string) => {
  if ((t1 === "feed" || t1 === "carousel") && (t2 === "feed" || t2 === "carousel")) return true;
  return t1 === t2;
};

const getBulkScheduledDates = (
  bulkMediaLength: number,
  startDateStr: string,
  postType: PostType,
  accountId: string,
  existingPosts: any[]
): Date[] => {
  const dates: Date[] = [];
  
  const baseDate = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
  if (!startDateStr) {
    baseDate.setDate(baseDate.getDate() + 1);
  }

  const isTimeOccupied = (time: Date) => {
    // 1. Check existing posts from database
    const hasConflictInDb = existingPosts.some((post) => {
      const postAccountId = post.account_id || post.instagram_accounts?.id;
      if (postAccountId !== accountId) return false;
      if (!isSameCategory(post.post_type, postType)) return false;
      if (post.status === "failed") return false;

      const postDate = new Date(post.scheduled_at);
      return (
        postDate.getFullYear() === time.getFullYear() &&
        postDate.getMonth() === time.getMonth() &&
        postDate.getDate() === time.getDate() &&
        postDate.getHours() === time.getHours() &&
        postDate.getMinutes() === time.getMinutes()
      );
    });

    if (hasConflictInDb) return true;

    // 2. Check already assigned in this batch
    const hasConflictInBatch = dates.some((assigned) => {
      return (
        assigned.getFullYear() === time.getFullYear() &&
        assigned.getMonth() === time.getMonth() &&
        assigned.getDate() === time.getDate() &&
        assigned.getHours() === time.getHours() &&
        assigned.getMinutes() === time.getMinutes()
      );
    });

    return hasConflictInBatch;
  };

  for (let i = 0; i < bulkMediaLength; i++) {
    let found = false;
    let dayOffset = i;
    let dayAttempts = 0;

    while (!found && dayAttempts < 365) {
      const candidateDay = new Date(baseDate);
      candidateDay.setDate(candidateDay.getDate() + dayOffset);

      // Cycle strategic slots to distribute posts evenly across day intervals
      const preferredSlotIndex = i % STRATEGIC_SLOTS.length;

      for (let s = 0; s < STRATEGIC_SLOTS.length; s++) {
        const slotIndex = (preferredSlotIndex + s) % STRATEGIC_SLOTS.length;
        const slot = STRATEGIC_SLOTS[slotIndex];

        const slotStart = new Date(candidateDay);
        slotStart.setHours(slot.startHour, slot.startMinute, 0, 0);

        // Within this 15-minute slot, find a free minute (0 to 15)
        for (let m = 0; m <= 15; m++) {
          const candidateTime = new Date(slotStart);
          candidateTime.setMinutes(candidateTime.getMinutes() + m);

          if (!isTimeOccupied(candidateTime)) {
            dates.push(candidateTime);
            found = true;
            break;
          }
        }

        if (found) break;
      }

      if (!found) {
        dayOffset++;
        dayAttempts++;
      }
    }

    if (!found) {
      const fallbackDate = new Date(baseDate);
      fallbackDate.setDate(fallbackDate.getDate() + i);
      const slot = STRATEGIC_SLOTS[i % STRATEGIC_SLOTS.length];
      fallbackDate.setHours(slot.startHour, slot.startMinute, 0, 0);
      dates.push(fallbackDate);
    }
  }

  return dates;
};

function SchedulePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchAccounts = useServerFn(listAccounts);
  const createPost = useServerFn(createScheduledPost);
  const fetchPosts = useServerFn(listPosts);

  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => fetchAccounts() });
  const { data: existingPosts = [] } = useQuery({ queryKey: ["posts"], queryFn: () => fetchPosts() });

  const [scheduleMode, setScheduleMode] = useState<"individual" | "bulk">("individual");
  const [accountId, setAccountId] = useState("");
  const [postType, setPostType] = useState<PostType>("feed");
  const [caption, setCaption] = useState("");
  const [userTagsInput, setUserTagsInput] = useState("");
  const [locationIdInput, setLocationIdInput] = useState("");

  const parseUserTags = (input: string): string[] => {
    return input
      .split(",")
      .map((tag) => tag.replace("@", "").trim())
      .filter((tag) => tag.length > 0);
  };
  
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

  const bulkScheduledDates = useMemo(() => {
    return getBulkScheduledDates(bulkMedia.length, bulkStartDate, postType, accountId, existingPosts);
  }, [bulkMedia.length, bulkStartDate, postType, accountId, existingPosts]);

  const individualConflict = useMemo(() => {
    if (!scheduledAt || !accountId) return false;
    const candidate = new Date(scheduledAt);
    return existingPosts.some((post: any) => {
      const postAccountId = post.account_id || post.instagram_accounts?.id;
      if (postAccountId !== accountId) return false;
      if (!isSameCategory(post.post_type, postType)) return false;
      if (post.status === "failed") return false;

      const postDate = new Date(post.scheduled_at);
      return (
        postDate.getFullYear() === candidate.getFullYear() &&
        postDate.getMonth() === candidate.getMonth() &&
        postDate.getDate() === candidate.getDate() &&
        postDate.getHours() === candidate.getHours() &&
        postDate.getMinutes() === candidate.getMinutes()
      );
    });
  }, [scheduledAt, accountId, postType, existingPosts]);

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

    const userTags = parseUserTags(userTagsInput);

    setSubmitting(true);
    try {
      await createPost({
        data: {
          accountId,
          postType,
          caption,
          mediaPaths: media.map((m) => m.path),
          scheduledAt: new Date(scheduledAt).toISOString(),
          userTags,
          locationId: locationIdInput.trim() || undefined,
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

    const userTags = parseUserTags(userTagsInput);

    setSubmitting(true);
    try {
      const promises = bulkMedia.map((m, idx) => {
        const scheduledTime = bulkScheduledDates[idx].toISOString();
        return createPost({
          data: {
            accountId,
            postType,
            caption: postType === "story" ? "" : caption,
            mediaPaths: [m.path],
            scheduledAt: scheduledTime,
            userTags,
            locationId: locationIdInput.trim() || undefined,
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

          {/* Marcação e Localização (Oculto para Stories) */}
          {postType !== "story" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-sm font-semibold">Marcação de Perfis</Label>
                <Input
                  value={userTagsInput}
                  onChange={(e) => setUserTagsInput(e.target.value)}
                  placeholder="Ex: @iesperancagps, @luizrogeriopaixao"
                />
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Separe os perfis por vírgula. As contas marcadas serão notificadas no post.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-sm font-semibold">ID da Localização (Página Facebook)</Label>
                <Input
                  value={locationIdInput}
                  onChange={(e) => setLocationIdInput(e.target.value)}
                  placeholder="Ex: 256947874165590"
                />
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Insira o ID numérico da Página do Facebook do local.
                </p>
              </div>
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
              {individualConflict && (
                <p className="text-xs text-amber-500 font-medium mt-1">
                  ⚠️ Já existe uma publicação deste tipo agendada para este horário. Escolha outro horário para evitar conflitos.
                </p>
              )}
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
                          Agendado: <span className="font-semibold text-foreground">{bulkScheduledDates[idx]?.toLocaleString("pt-BR")}</span>
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

