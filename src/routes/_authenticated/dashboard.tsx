import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPosts } from "@/lib/posts.functions";
import { listAccounts } from "@/lib/instagram.functions";
import { POST_TYPE_LABELS, POST_STATUS_LABELS, type PostType } from "@/lib/meta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, Users, Clock } from "lucide-react";

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
  const fetchPosts = useServerFn(listPosts);
  const fetchAccounts = useServerFn(listAccounts);

  const { data: posts = [] } = useQuery({ queryKey: ["posts"], queryFn: () => fetchPosts() });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => fetchAccounts() });

  const upcoming = posts.filter((p: any) => p.status === "scheduled");
  const published = posts.filter((p: any) => p.status === "published");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel</h1>
          <p className="text-sm text-muted-foreground">Visão geral dos seus agendamentos.</p>
        </div>
        <Link to="/schedule">
          <Button>
            <CalendarPlus className="mr-2 h-4 w-4" /> Novo agendamento
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Clock} label="Agendados" value={upcoming.length} />
        <StatCard icon={CalendarPlus} label="Publicados" value={published.length} />
        <StatCard icon={Users} label="Contas conectadas" value={accounts.length} />
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

      <div>
        <h2 className="mb-3 font-semibold text-foreground">Próximas publicações</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma publicação agendada.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.slice(0, 8).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.caption || "(sem legenda)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{p.instagram_accounts?.username ?? "—"} ·{" "}
                    {POST_TYPE_LABELS[p.post_type as PostType]} ·{" "}
                    {new Date(p.scheduled_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Badge variant={statusVariant[p.status]}>{POST_STATUS_LABELS[p.status]}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-5">
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
