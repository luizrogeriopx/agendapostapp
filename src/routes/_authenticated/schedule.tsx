import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, X, Loader2, CalendarDays, Eye, Crown, Lock, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PLANS, type PlanType } from "@/lib/plans";
import { getMyProfile } from "@/lib/profile.functions";

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
  startTimeStr: string,
  postType: PostType,
  accountId: string,
  existingPosts: any[]
): Date[] => {
  const dates: Date[] = [];
  
  const baseDate = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
  if (!startDateStr) {
    baseDate.setDate(baseDate.getDate() + 1);
  }

  const [hour, minute] = startTimeStr ? startTimeStr.split(":").map(Number) : [8, 0];
  baseDate.setHours(hour, minute, 0, 0);

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
  const fetchMyProfile = useServerFn(getMyProfile);

  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => fetchAccounts() });
  const { data: existingPosts = [] } = useQuery({ queryKey: ["posts"], queryFn: () => fetchPosts() });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchMyProfile() });

  const activePlanId = (profile?.subscription_plan || "teste") as PlanType;

  const [scheduleMode, setScheduleMode] = useState<"individual" | "bulk">("individual");
  const [accountId, setAccountId] = useState("");
  const [postType, setPostType] = useState<PostType>("feed");
  const [caption, setCaption] = useState("");
  const [userTagsInput, setUserTagsInput] = useState("");

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

  // Recurrence State
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<"day" | "week" | "month">("day");
  const [recurrenceEndType, setRecurrenceEndType] = useState<"indefinite" | "until_date">("indefinite");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

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

    if (isRecurring && recurrenceEndType === "until_date") {
      if (!recurrenceEndDate) {
        return toast.error("Selecione a data de término da repetição.");
      }
      const endDateTime = new Date(recurrenceEndDate + "T23:59:59").getTime();
      const startDateTime = new Date(scheduledAt).getTime();
      if (endDateTime <= startDateTime) {
        return toast.error("A data de término da repetição deve ser posterior à data do agendamento inicial.");
      }
    }

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
          isRecurring,
          recurrenceInterval: isRecurring ? recurrenceInterval : undefined,
          recurrenceEndType: isRecurring ? recurrenceEndType : undefined,
          recurrenceEndDate:
            isRecurring && recurrenceEndType === "until_date"
              ? new Date(recurrenceEndDate + "T23:59:59").toISOString()
              : undefined,
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

    if (isRecurring && recurrenceEndType === "until_date") {
      if (!recurrenceEndDate) {
        return toast.error("Selecione a data de término da repetição.");
      }
      const endDateTime = new Date(recurrenceEndDate + "T23:59:59").getTime();
      const startDateTime = new Date(bulkStartDate + "T00:00:00").getTime();
      if (endDateTime <= startDateTime) {
        return toast.error("A data de término da repetição deve ser posterior à data de início.");
      }
    }

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
            isRecurring,
            recurrenceInterval: isRecurring ? recurrenceInterval : undefined,
            recurrenceEndType: isRecurring ? recurrenceEndType : undefined,
            recurrenceEndDate:
              isRecurring && recurrenceEndType === "until_date"
                ? new Date(recurrenceEndDate + "T23:59:59").toISOString()
                : undefined,
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
            if (activePlanId === "teste") {
              toast.error("O agendamento em massa é um recurso Pro. Faça o upgrade do seu plano!");
              return;
            }
            setScheduleMode("bulk");
            setBulkMedia([]);
            setMedia([]);
            if (postType === "carousel") setPostType("feed");
          }}
          className={cn(
            "pb-3 text-sm font-semibold border-b-2 px-4 transition-colors flex items-center gap-1.5",
            scheduleMode === "bulk"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
            activePlanId === "teste" && "opacity-60 cursor-not-allowed"
          )}
        >
          Agendamento em Massa (Lote)
          {activePlanId === "teste" && <Crown className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
        </button>
      </div>

      {activePlanId === "teste" && existingPosts.length >= 5 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-500 leading-normal flex items-start gap-2.5">
          <Crown className="h-5 w-5 fill-amber-500 shrink-0" />
          <div>
            <p className="font-bold">Limite do Plano Teste Atingido</p>
            <p className="mt-0.5">
              Você atingiu o limite máximo de 5 agendamentos do plano gratuito. Para agendar mais posts, por favor faça o upgrade do seu plano.
            </p>
            <Link to="/plans" className="underline mt-1.5 inline-block font-semibold">
              Fazer Upgrade do Plano
            </Link>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Conecte uma conta do Instagram antes de agendar.
        </div>
      ) : activePlanId === "automacaopro" ? (
        <div className="rounded-2xl border bg-card p-8 text-center max-w-md mx-auto space-y-6 shadow-xs my-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Agendamento de Posts Bloqueado</h2>
            <p className="text-sm text-muted-foreground leading-normal">
              O seu plano atual (**Plano AutomaçãoPró**) é focado exclusivamente em automações de comentários e Direct.
            </p>
          </div>
          <div className="border-t pt-4 border-muted/50">
            <p className="text-xs text-muted-foreground mb-4">
              Para liberar agendamentos de Posts, Reels e Stories ilimitados, altere seu plano.
            </p>
            <Link to="/plans">
              <Button style={{ background: "var(--gradient-brand)" }} className="text-white w-full font-semibold">
                Ver Planos Disponíveis
              </Button>
            </Link>
          </div>
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

          {/* Marcação de Perfis (Oculto para Stories) */}
          {postType !== "story" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-sm font-semibold">
                Marcação de Perfis
                {activePlanId === "teste" && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded-full ml-1.5 uppercase">
                    <Crown className="h-2.5 w-2.5 fill-amber-500" /> Pro
                  </span>
                )}
              </Label>
              <Input
                value={userTagsInput}
                onChange={(e) => setUserTagsInput(e.target.value)}
                placeholder={activePlanId === "teste" ? "Recurso Pro (Indisponível no plano de testes)" : "Ex: @iesperancagps, @luizrogeriopaixao"}
                disabled={activePlanId === "teste"}
                className={activePlanId === "teste" ? "bg-muted/40 cursor-not-allowed opacity-70 border-amber-500/30" : ""}
              />
              <p className="text-[10px] text-muted-foreground leading-normal">
                {activePlanId === "teste" ? (
                  <span className="text-amber-500 font-medium">A marcação de usuários exige o plano AgendaPró ou Premium.</span>
                ) : (
                  "Separe os perfis por vírgula. As contas marcadas serão notificadas no post."
                )}
              </p>
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

          {/* Configuração de Repetição */}
          <div className="rounded-xl border bg-card/60 p-4 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-primary" />
                  <Label htmlFor="repeat-toggle" className="text-sm font-semibold cursor-pointer">
                    Programar repetição
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Repetir este post periodicamente (a cada dia, semana ou mês).
                </p>
              </div>
              <Switch
                id="repeat-toggle"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>

            {isRecurring && (
              <div className="space-y-4 pt-3 border-t border-border/60">
                {/* Intervalo / Frequência */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">Repetir a cada</Label>
                  <Select
                    value={recurrenceInterval}
                    onValueChange={(v) => setRecurrenceInterval(v as "day" | "week" | "month")}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione o intervalo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Dia (Diariamente)</SelectItem>
                      <SelectItem value="week">Semana (Semanalmente)</SelectItem>
                      <SelectItem value="month">Mês (Mensalmente)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Condição de término */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">Término da repetição</Label>
                  <RadioGroup
                    value={recurrenceEndType}
                    onValueChange={(v) => setRecurrenceEndType(v as "indefinite" | "until_date")}
                    className="grid gap-2"
                  >
                    <label
                      htmlFor="end-indefinite"
                      className={cn(
                        "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        recurrenceEndType === "indefinite" ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted/40"
                      )}
                    >
                      <RadioGroupItem value="indefinite" id="end-indefinite" />
                      <div className="text-xs leading-none">
                        <span className="font-medium text-foreground">Indefinido</span>
                        <p className="text-muted-foreground text-[11px] mt-1">Repetir continuamente até que eu cancele manualmente.</p>
                      </div>
                    </label>

                    <label
                      htmlFor="end-until-date"
                      className={cn(
                        "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        recurrenceEndType === "until_date" ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted/40"
                      )}
                    >
                      <RadioGroupItem value="until_date" id="end-until-date" />
                      <div className="text-xs leading-none">
                        <span className="font-medium text-foreground">Data de término programada</span>
                        <p className="text-muted-foreground text-[11px] mt-1">Encerrar automaticamente após uma data específica.</p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                {recurrenceEndType === "until_date" && (
                  <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <Label className="text-xs font-semibold text-foreground">Data final da repetição</Label>
                    <Input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      min={
                        scheduleMode === "individual"
                          ? (scheduledAt ? scheduledAt.slice(0, 10) : undefined)
                          : bulkStartDate
                      }
                      className="bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Após esta data, novos posts não serão mais gerados automaticamente.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

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

