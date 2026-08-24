import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listPosts, deletePost, updatePost, publishPostNow } from "@/lib/posts.functions";
import { listAccounts } from "@/lib/instagram.functions";
import { POST_TYPE_LABELS, POST_STATUS_LABELS, type PostType } from "@/lib/meta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, Users, Clock, MoreVertical, Pencil, Trash, Play, Loader2, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Agendador de Instagram" }] }),
  component: Dashboard,
});

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "secondary",
  publishing: "default",
  published: "default",
  failed: "destructive",
};

function Dashboard() {
  const qc = useQueryClient();
  const fetchPosts = useServerFn(listPosts);
  const fetchAccounts = useServerFn(listAccounts);
  const removePost = useServerFn(deletePost);
  const editPost = useServerFn(updatePost);
  const publishNow = useServerFn(publishPostNow);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => fetchPosts(),
  });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => fetchAccounts() });

  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurrenceInterval, setEditRecurrenceInterval] = useState<"day" | "week" | "month">("day");
  const [editRecurrenceEndType, setEditRecurrenceEndType] = useState<"indefinite" | "until_date">("indefinite");
  const [editRecurrenceEndDate, setEditRecurrenceEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [filterAccountId, setFilterAccountId] = useState<string>("all");

  const filteredPosts = filterAccountId === "all"
    ? posts
    : posts.filter((p: any) => p.account_id === filterAccountId);

  const upcoming = filteredPosts.filter((p: any) => p.status === "scheduled");
  const history = filteredPosts.filter((p: any) => p.status !== "scheduled");

  const handleDelete = async (id: string) => {
    try {
      await removePost({ data: { id } });
      toast.success("Publicação excluída.");
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao excluir.");
    }
  };

  const handlePublishNow = async (id: string) => {
    setPublishingId(id);
    const toastId = toast.loading("Publicando no Instagram...");
    try {
      await publishNow({ data: { id } });
      toast.success("Publicado com sucesso!", { id: toastId });
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao publicar.", { id: toastId });
      qc.invalidateQueries({ queryKey: ["posts"] });
    } finally {
      setPublishingId(null);
    }
  };

  const startEdit = (post: any) => {
    setEditingPost(post);
    setEditCaption(post.caption || "");
    const date = new Date(post.scheduled_at);
    const ten = (i: number) => (i < 10 ? "0" : "") + i;
    const yyyy = date.getFullYear();
    const mm = ten(date.getMonth() + 1);
    const dd = ten(date.getDate());
    const hh = ten(date.getHours());
    const min = ten(date.getMinutes());
    setEditScheduledAt(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    setEditIsRecurring(post.is_recurring ?? false);
    setEditRecurrenceInterval(post.recurrence_interval || "day");
    setEditRecurrenceEndType(post.recurrence_end_type || "indefinite");
    if (post.recurrence_end_date) {
      const endD = new Date(post.recurrence_end_date);
      setEditRecurrenceEndDate(`${endD.getFullYear()}-${ten(endD.getMonth() + 1)}-${ten(endD.getDate())}`);
    } else {
      setEditRecurrenceEndDate("");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    if (!editScheduledAt) return toast.error("Selecione data e hora.");
    if (editIsRecurring && editRecurrenceEndType === "until_date") {
      if (!editRecurrenceEndDate) {
        return toast.error("Selecione a data de término da repetição.");
      }
      const endDateTime = new Date(editRecurrenceEndDate + "T23:59:59").getTime();
      const startDateTime = new Date(editScheduledAt).getTime();
      if (endDateTime <= startDateTime) {
        return toast.error("A data de término deve ser posterior à data do agendamento.");
      }
    }
    setSaving(true);
    try {
      await editPost({
        data: {
          id: editingPost.id,
          caption: editCaption,
          scheduledAt: new Date(editScheduledAt).toISOString(),
          isRecurring: editIsRecurring,
          recurrenceInterval: editIsRecurring ? editRecurrenceInterval : null,
          recurrenceEndType: editIsRecurring ? editRecurrenceEndType : null,
          recurrenceEndDate:
            editIsRecurring && editRecurrenceEndType === "until_date"
              ? new Date(editRecurrenceEndDate + "T23:59:59").toISOString()
              : null,
        },
      });
      toast.success("Publicação atualizada!");
      setEditingPost(null);
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel</h1>
          <p className="text-sm text-muted-foreground">Visão geral dos seus agendamentos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/accounts">
            <Button variant="outline" className="gap-2">
              <Users className="h-4 w-4" /> Conectar/Gerenciar Contas
            </Button>
          </Link>
          <Link to="/schedule">
            <Button className="gap-2">
              <CalendarPlus className="h-4 w-4" /> Novo agendamento
            </Button>
          </Link>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/50 shadow-2xs">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-foreground">Filtrar por Perfil</h3>
            <p className="text-xs text-muted-foreground">Escolha uma conta para filtrar as estatísticas e publicações.</p>
          </div>
          <Select value={filterAccountId} onValueChange={setFilterAccountId}>
            <SelectTrigger className="w-full sm:w-64 bg-card">
              <SelectValue placeholder="Todas as Contas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Contas</SelectItem>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>
                  @{a.username ?? a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/schedule" className="block hover:no-underline">
          <StatCard
            icon={Clock}
            label="Agendados"
            value={upcoming.length}
            className="hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all"
          />
        </Link>
        <StatCard icon={CalendarPlus} label="Publicados" value={filteredPosts.filter((p: any) => p.status === "published").length} />
        <Link to="/accounts" className="block hover:no-underline">
          <StatCard
            icon={Users}
            label="Contas conectadas"
            value={accounts.length}
            className="hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all"
          />
        </Link>
      </div>

      {accounts.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Você ainda não conectou nenhuma conta do Instagram.
          </p>
          <Link to="/accounts">
            <Button variant="outline" className="mt-3">
              Conectar Instagram
            </Button>
          </Link>
        </div>
      )}

      {/* Próximas publicações */}
      <div>
        <h2 className="mb-3 font-semibold text-foreground">Próximas publicações</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma publicação agendada.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((p: any) => (
              <PostItem
                key={p.id}
                post={p}
                publishingId={publishingId}
                handlePublishNow={handlePublishNow}
                startEdit={startEdit}
                handleDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Histórico */}
      <div>
        <h2 className="mb-3 font-semibold text-foreground">Histórico de publicações</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma publicação no histórico.</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((p: any) => (
              <PostItem
                key={p.id}
                post={p}
                publishingId={publishingId}
                handlePublishNow={handlePublishNow}
                startEdit={startEdit}
                handleDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog para Edição */}
      <Dialog open={editingPost !== null} onOpenChange={(open) => !open && setEditingPost(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar agendamento</DialogTitle>
          </DialogHeader>
          {editingPost && (
            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <Label>Legenda</Label>
                <Textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder="Escreva a legenda..."
                  rows={4}
                  maxLength={2200}
                />
              </div>
              <div className="space-y-2">
                <Label>Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                />
              </div>

              {/* Repetição no Edit */}
              <div className="rounded-xl border bg-muted/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Repeat className="h-3.5 w-3.5 text-primary" />
                      <Label htmlFor="edit-repeat-toggle" className="text-xs font-semibold cursor-pointer">
                        Repetir publicação
                      </Label>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Repetir periodicamente este agendamento.
                    </p>
                  </div>
                  <Switch
                    id="edit-repeat-toggle"
                    checked={editIsRecurring}
                    onCheckedChange={setEditIsRecurring}
                  />
                </div>

                {editIsRecurring && (
                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Repetir a cada</Label>
                      <Select
                        value={editRecurrenceInterval}
                        onValueChange={(v) => setEditRecurrenceInterval(v as "day" | "week" | "month")}
                      >
                        <SelectTrigger className="bg-background h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Dia (Diariamente)</SelectItem>
                          <SelectItem value="week">Semana (Semanalmente)</SelectItem>
                          <SelectItem value="month">Mês (Mensalmente)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Término da repetição</Label>
                      <RadioGroup
                        value={editRecurrenceEndType}
                        onValueChange={(v) => setEditRecurrenceEndType(v as "indefinite" | "until_date")}
                        className="grid gap-1.5"
                      >
                        <label
                          htmlFor="edit-end-indefinite"
                          className={cn(
                            "flex items-center space-x-2 rounded-md border p-2 cursor-pointer transition-colors text-xs",
                            editRecurrenceEndType === "indefinite" ? "border-primary/50 bg-primary/5" : "bg-card"
                          )}
                        >
                          <RadioGroupItem value="indefinite" id="edit-end-indefinite" />
                          <span>Indefinido (Até que eu cancele manualmente)</span>
                        </label>
                        <label
                          htmlFor="edit-end-until-date"
                          className={cn(
                            "flex items-center space-x-2 rounded-md border p-2 cursor-pointer transition-colors text-xs",
                            editRecurrenceEndType === "until_date" ? "border-primary/50 bg-primary/5" : "bg-card"
                          )}
                        >
                          <RadioGroupItem value="until_date" id="edit-end-until-date" />
                          <span>Data de término programada</span>
                        </label>
                      </RadioGroup>
                    </div>

                    {editRecurrenceEndType === "until_date" && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Data final</Label>
                        <Input
                          type="date"
                          value={editRecurrenceEndDate}
                          onChange={(e) => setEditRecurrenceEndDate(e.target.value)}
                          min={editScheduledAt ? editScheduledAt.slice(0, 10) : undefined}
                          className="bg-background h-8 text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPost(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostItem({
  post,
  publishingId,
  handlePublishNow,
  startEdit,
  handleDelete,
}: {
  post: any;
  publishingId: string | null;
  handlePublishNow: (id: string) => void;
  startEdit: (post: any) => void;
  handleDelete: (id: string) => void;
}) {
  const isVideo =
    post.post_type === "reel" ||
    (post.media_urls?.[0] &&
      /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(post.media_urls[0]));

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
        {post.thumbnailUrl ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
            {isVideo ? (
              <video src={post.thumbnailUrl} className="h-full w-full object-cover" preload="metadata" />
            ) : (
              <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground text-[10px] font-bold uppercase">
            {post.post_type.substring(0, 4)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="truncate text-sm font-medium text-foreground">
              {post.caption || <span className="text-muted-foreground italic">(sem legenda)</span>}
            </p>
            {post.is_recurring && (
              <Badge variant="outline" className="gap-1 border-primary/40 text-primary bg-primary/5 text-[10px] font-medium py-0 px-1.5 shrink-0">
                <Repeat className="h-2.5 w-2.5 shrink-0" />
                {post.recurrence_interval === "day" && "Diário"}
                {post.recurrence_interval === "week" && "Semanal"}
                {post.recurrence_interval === "month" && "Mensal"}
                {post.recurrence_end_type === "until_date" && post.recurrence_end_date
                  ? ` • Até ${new Date(post.recurrence_end_date).toLocaleDateString("pt-BR")}`
                  : " • Indefinido"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            @{post.instagram_accounts?.username ?? "—"} ·{" "}
            {POST_TYPE_LABELS[post.post_type as PostType]} ·{" "}
            {new Date(post.scheduled_at).toLocaleString("pt-BR")}
          </p>
          {post.error_message && (
            <p className="text-xs text-destructive mt-1 font-medium bg-destructive/5 px-2 py-0.5 rounded border border-destructive/10 inline-block">
              Erro: {post.error_message}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge variant={statusVariant[post.status]}>{POST_STATUS_LABELS[post.status]}</Badge>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {publishingId === post.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {post.status !== "published" && (
              <DropdownMenuItem
                onClick={() => handlePublishNow(post.id)}
                disabled={publishingId !== null}
                className="gap-2"
              >
                <Play className="h-3.5 w-3.5 text-green-600" /> Publicar agora
              </DropdownMenuItem>
            )}
            {post.status === "scheduled" && (
              <DropdownMenuItem
                onClick={() => startEdit(post)}
                disabled={publishingId !== null}
                className="gap-2"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => handleDelete(post.id)}
              disabled={publishingId !== null}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash className="h-3.5 w-3.5" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: any;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}


