import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAccounts, deleteAccount, getMetaConfig } from "@/lib/instagram.functions";
import { FB_OAUTH_DIALOG, META_SCOPES } from "@/lib/meta";
import { Button } from "@/components/ui/button";
import { Instagram, Trash2, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Contas — Agendador de Instagram" }] }),
  component: AccountsPage,
});

function AccountsPage() {
  const qc = useQueryClient();
  const fetchAccounts = useServerFn(listAccounts);
  const fetchConfig = useServerFn(getMetaConfig);
  const removeAccount = useServerFn(deleteAccount);
  const [connecting, setConnecting] = useState(false);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => fetchAccounts(),
  });
  const { data: config } = useQuery({ queryKey: ["meta-config"], queryFn: () => fetchConfig() });

  const startConnect = async () => {
    if (!config?.configured) {
      toast.error("Configure o app da Meta primeiro.");
      return;
    }
    setConnecting(true);
    const redirectUri = `${window.location.origin}/instagram/callback`;
    const state = Math.random().toString(36).slice(2);
    const url =
      `${FB_OAUTH_DIALOG}?client_id=${config.appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(META_SCOPES.join(","))}` +
      `&response_type=code&state=${state}`;

    const popup = window.open(url, "ig-oauth", "width=600,height=720");
    if (!popup) {
      toast.error("Permita pop-ups para conectar sua conta.");
      setConnecting(false);
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "ig-oauth-result") return;
      window.removeEventListener("message", onMessage);
      setConnecting(false);
      if (event.data.success) {
        toast.success(`Conectado: ${event.data.accounts?.join(", ") || "conta"}`);
        qc.invalidateQueries({ queryKey: ["accounts"] });
      } else {
        toast.error(event.data.error || "Falha ao conectar.");
      }
    };
    window.addEventListener("message", onMessage);

    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        window.removeEventListener("message", onMessage);
        setConnecting(false);
      }
    }, 600);
  };

  const handleDelete = async (id: string) => {
    await removeAccount({ data: { id } });
    toast.success("Conta removida.");
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas conectadas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas contas do Instagram Business.</p>
        </div>
        <Button onClick={startConnect} disabled={connecting}>
          <Plus className="mr-2 h-4 w-4" /> {connecting ? "Conectando..." : "Conectar Instagram"}
        </Button>
      </div>

      {config && !config.configured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            O app da Meta ainda não está configurado.{" "}
            <Link to="/setup" className="font-semibold underline">
              Veja o passo a passo
            </Link>{" "}
            para criar seu app e inserir as credenciais.
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Instagram className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma conta conectada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                {a.profile_picture_url ? (
                  <img src={a.profile_picture_url} alt={a.username} className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                    <Instagram className="h-5 w-5 text-muted-foreground" />
                  </span>
                )}
                <div>
                  <p className="font-medium text-foreground">@{a.username ?? a.name ?? "conta"}</p>
                  <p className="text-xs text-muted-foreground">Página: {a.page_name ?? "—"}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
