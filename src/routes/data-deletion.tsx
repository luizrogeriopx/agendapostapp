import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Instagram, ArrowLeft, Trash2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Instruções de Exclusão de Dados — Agendador IG" },
      {
        name: "description",
        content: "Saiba como remover sua conta e solicitar a exclusão total de seus dados pessoais do Agendador IG.",
      },
    ],
  }),
  component: DataDeletion,
});

function DataDeletion() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-foreground">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Instagram className="h-4.5 w-4.5" />
            </span>
            Agendador IG
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar para o início
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-3xl px-6 py-12 w-full animate-fade-in">
        <div className="rounded-2xl border bg-card p-8 md:p-12 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Exclusão de Dados do Usuário
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Instruções de Conformidade com o Facebook / Meta
              </p>
            </div>
          </div>

          <div className="space-y-6 text-foreground/90 leading-relaxed text-sm">
            <p>
              De acordo com a Lei Geral de Proteção de Dados (LGPD) e as políticas de desenvolvedores da Meta,
              você tem o direito de solicitar a exclusão de todas as informações pessoais vinculadas a aplicativos
              de terceiros instalados na sua conta do Facebook ou Instagram.
            </p>
            <p>
              Oferecemos dois métodos simples para desconectar o aplicativo e solicitar a limpeza total dos seus dados.
            </p>

            <div className="rounded-xl border bg-muted/40 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold mt-0.5">
                  1
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">
                    Opção A: Desconectar e Excluir de Dentro do App (Recomendado)
                  </h3>
                  <p className="text-muted-foreground text-xs mt-1">
                    Você pode gerenciar e remover suas contas diretamente pelo painel:
                  </p>
                  <ol className="list-decimal pl-5 mt-2 space-y-1 text-xs">
                    <li>Faça login no Agendador IG.</li>
                    <li>Navegue até a seção <strong>Contas</strong> no menu lateral.</li>
                    <li>Identifique a conta do Instagram conectada e clique no botão de <strong>Lixeira / Excluir</strong>.</li>
                    <li>Isso removerá imediatamente os tokens de acesso e as postagens vinculadas a essa conta do nosso banco de dados.</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold mt-0.5">
                  2
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">
                    Opção B: Revogar Integração via Configurações do Facebook
                  </h3>
                  <p className="text-muted-foreground text-xs mt-1">
                    Para revogar as permissões concedidas ao nosso app diretamente pelo Facebook:
                  </p>
                  <ol className="list-decimal pl-5 mt-2 space-y-1 text-xs">
                    <li>Acesse a sua conta do Facebook e vá para <strong>Configurações e Privacidade &gt; Configurações</strong>.</li>
                    <li>No menu lateral, clique em <strong>Integrações de Negócios</strong> (Business Integrations).</li>
                    <li>Procure pelo aplicativo <strong>Agendador IG</strong>.</li>
                    <li>Clique em <strong>Remover</strong> ao lado do nome do aplicativo.</li>
                    <li>Marque a opção confirmando a remoção do aplicativo e das permissões de publicação.</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 space-y-3">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <ShieldAlert className="h-5 w-5" />
                <h3>Solicitação de Exclusão Total do Cadastro via Suporte</h3>
              </div>
              <p className="text-xs">
                Se você deseja remover permanentemente o seu cadastro de usuário (login do Google, e-mail de cadastro, logs de atividades
                e todo o histórico de mídia) de nossos servidores, envie um e-mail com a solicitação para:
              </p>
              <div className="font-mono text-center bg-card p-3 rounded-lg border text-sm select-all">
                suporte@agendadorig.com
              </div>
              <p className="text-xs text-muted-foreground">
                Processaremos a sua solicitação em até 48 horas úteis e confirmaremos a exclusão permanente de todos os seus dados
                de nossos backups de forma definitiva.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t bg-card py-6 mt-auto">
        <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Agendador IG. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground">Política de Privacidade</Link>
            <Link to="/terms" className="hover:text-foreground">Termos de Serviço</Link>
            <Link to="/data-deletion" className="hover:text-foreground">Exclusão de Dados</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
