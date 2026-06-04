import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAccounts } from "@/lib/instagram.functions";
import {
  listInstagramMedia,
  saveAutomation,
  deleteAutomation,
  getPageSubscription,
} from "@/lib/automations.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Send,
  Trash2,
  Settings2,
  CheckCircle2,
  Power,
  Loader2,
  Sparkles,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({ meta: [{ title: "Automações — Agendador de Instagram" }] }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const qc = useQueryClient();
  const fetchAccounts = useServerFn(listAccounts);
  const fetchMedia = useServerFn(listInstagramMedia);
  const saveRule = useServerFn(saveAutomation);
  const removeRule = useServerFn(deleteAutomation);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => fetchAccounts(),
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [activeMedia, setActiveMedia] = useState<any | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const fetchSubscription = useServerFn(getPageSubscription);

  const handleDiagnose = async () => {
    if (!selectedAccountId) return;
    setDiagnosing(true);
    try {
      const res = await fetchSubscription({ data: { accountId: selectedAccountId } });
      if (res.ok) {
        toast.info("Status de conexão do Webhook: " + JSON.stringify(res.data, null, 2));
      } else {
        toast.error("Erro no diagnóstico: " + JSON.stringify(res.error || res.data));
      }
    } catch (e: any) {
      toast.error("Falha ao diagnosticar: " + e.message);
    } finally {
      setDiagnosing(false);
    }
  };

  // Form states
  const [triggerWords, setTriggerWords] = useState("");
  const [commentReply, setCommentReply] = useState("");
  const [dmReply, setDmReply] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch recent posts for the selected account
  const { data: mediaItems = [], isLoading: loadingMedia } = useQuery({
    queryKey: ["instagram-media", selectedAccountId],
    queryFn: () => fetchMedia({ data: { accountId: selectedAccountId } }),
    enabled: !!selectedAccountId,
  });

  const openConfig = (item: any) => {
    setActiveMedia(item);
    if (item.automation) {
      setTriggerWords((item.automation.trigger_words || []).join(", "));
      setCommentReply(item.automation.comment_reply || "");
      setDmReply(item.automation.dm_reply || "");
      setIsActive(item.automation.is_active);
    } else {
      setTriggerWords("");
      setCommentReply("");
      setDmReply("");
      setIsActive(true);
    }
  };

  const handleSave = async () => {
    if (!selectedAccountId || !activeMedia) return;
    if (!commentReply.trim()) return toast.error("Preencha a resposta do comentário.");
    if (!dmReply.trim()) return toast.error("Preencha a mensagem do direct.");

    setSaving(true);
    try {
      const wordsArray = triggerWords
        .split(",")
        .map((w) => w.trim())
        .filter((w) => w.length > 0);

      await saveRule({
        data: {
          accountId: selectedAccountId,
          mediaId: activeMedia.id,
          mediaPermalink: activeMedia.permalink,
          mediaThumbnail: activeMedia.thumbnailUrl,
          mediaCaption: activeMedia.caption,
          triggerWords: wordsArray,
          commentReply: commentReply.trim(),
          dmReply: dmReply.trim(),
          isActive,
        },
      });

      toast.success("Automação salva com sucesso!");
      qc.invalidateQueries({ queryKey: ["instagram-media", selectedAccountId] });
      setActiveMedia(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar automação.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeMedia?.automation?.id) return;
    setDeleting(true);
    try {
      await removeRule({ data: { id: activeMedia.automation.id } });
      toast.success("Automação removida.");
      qc.invalidateQueries({ queryKey: ["instagram-media", selectedAccountId] });
      setActiveMedia(null);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao remover.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary animate-pulse" /> Automações de Comentários
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure respostas automáticas em comentários e envie links diretos via Direct no Instagram.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Conecte uma conta do Instagram nas configurações antes de gerenciar automações.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Seletor de Contas */}
          <div className="rounded-xl border bg-card p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Selecione o perfil do Instagram</Label>
              <p className="text-xs text-muted-foreground">Mostraremos as últimas publicações deste perfil.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch sm:items-center">
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Escolher Perfil" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      @{a.username ?? a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccountId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiagnose}
                  disabled={diagnosing}
                  className="gap-1.5"
                >
                  {diagnosing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Diagnosticando...
                    </>
                  ) : (
                    <>
                      <Settings2 className="h-3.5 w-3.5" /> Testar Conexão
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Lista de publicações */}
          {selectedAccountId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Publicações Recentes</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    qc.invalidateQueries({ queryKey: ["instagram-media", selectedAccountId] });
                    toast.success("Lista de publicações atualizada!");
                  }}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Atualizar
                </Button>
              </div>

              {loadingMedia ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : mediaItems.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                  Nenhuma publicação encontrada no Instagram.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {mediaItems.map((item: any) => {
                    const isVideo = item.mediaType === "VIDEO" || item.mediaType === "REELS";
                    const isAutoActive = item.automation?.is_active;

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border bg-card p-4 flex gap-4 hover:shadow-xs transition-shadow relative overflow-hidden"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                          {isVideo ? (
                            <video src={item.mediaUrl} className="h-full w-full object-cover" preload="metadata" />
                          ) : (
                            <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>

                        {/* Caption & Status */}
                        <div className="flex flex-col justify-between flex-1 min-w-0">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">
                              {new Date(item.timestamp).toLocaleDateString("pt-BR")}
                            </p>
                            <p className="text-sm font-medium text-foreground line-clamp-2">
                              {item.caption || <span className="text-muted-foreground italic">(sem legenda)</span>}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-muted/50">
                            <Badge variant={isAutoActive ? "default" : "secondary"} className="text-xs">
                              {isAutoActive ? "Automação Ativa" : "Sem Automação"}
                            </Badge>
                            <Button size="xs" variant="outline" className="gap-1" onClick={() => openConfig(item)}>
                              <Settings2 className="h-3 w-3" /> Configurar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Configuração de Automação */}
      <Dialog open={activeMedia !== null} onOpenChange={(open) => !open && setActiveMedia(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" /> Configurar Automação
            </DialogTitle>
            <DialogDescription>
              Responda a comentários e envie mensagens privadas via Direct automaticamente para este post.
            </DialogDescription>
          </DialogHeader>

          {activeMedia && (
            <div className="space-y-4 py-3">
              {/* Resumo do Post */}
              <div className="flex gap-3 items-center rounded-lg border bg-muted/30 p-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {activeMedia.mediaType === "VIDEO" ? (
                    <video src={activeMedia.mediaUrl} className="h-full w-full object-cover" preload="metadata" />
                  ) : (
                    <img src={activeMedia.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground line-clamp-1">
                    {activeMedia.caption || "(sem legenda)"}
                  </p>
                  <a
                    href={activeMedia.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary hover:underline inline-flex items-center mt-0.5 gap-0.5 font-medium"
                  >
                    Ver no Instagram <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>

              {/* Gatilho (Palavras Chave) */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1">
                  Palavras-chave ativadoras
                </Label>
                <Input
                  value={triggerWords}
                  onChange={(e) => setTriggerWords(e.target.value)}
                  placeholder="Ex: quero, preço, link, valor"
                />
                <p className="text-[11px] text-muted-foreground">
                  Separe por vírgulas. Deixe em branco para responder a **todos** os comentários recebidos.
                </p>
              </div>

              {/* Resposta do Comentário */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" /> Resposta nos comentários
                </Label>
                <Textarea
                  value={commentReply}
                  onChange={(e) => setCommentReply(e.target.value)}
                  placeholder="Escreva a resposta pública do comentário..."
                  rows={2}
                  maxLength={1000}
                />
                <p className="text-[11px] text-muted-foreground">
                  Esta resposta será publicada publicamente abaixo do comentário da pessoa.
                </p>
              </div>

              {/* Resposta por Direct */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Send className="h-4 w-4 text-muted-foreground" /> Mensagem por Direct (Privada)
                </Label>
                <Textarea
                  value={dmReply}
                  onChange={(e) => setDmReply(e.target.value)}
                  placeholder="Escreva a mensagem privada a ser enviada no Direct..."
                  rows={3}
                  maxLength={2000}
                />
                <p className="text-[11px] text-muted-foreground">
                  Enviada de forma 100% privada para o direct do usuário que fez o comentário (Private Reply).
                </p>
              </div>

              {/* Status Ativo */}
              {activeMedia.automation && (
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs font-semibold text-muted-foreground">Status da Automação</span>
                  <Button
                    size="xs"
                    variant={isActive ? "default" : "secondary"}
                    className="gap-1"
                    onClick={() => setIsActive(!isActive)}
                  >
                    <Power className="h-3 w-3" /> {isActive ? "Ativa" : "Desativada"}
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between items-center w-full">
            {activeMedia?.automation ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/5 shrink-0"
                onClick={handleDelete}
                disabled={deleting || saving}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4.5 w-4.5" />}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="ghost"
                onClick={() => setActiveMedia(null)}
                disabled={saving || deleting}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || deleting} className="gap-1.5">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Salvar Automação
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
