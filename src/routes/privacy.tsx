import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Instagram, ArrowLeft, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Agendador IG" },
      {
        name: "description",
        content: "Política de Privacidade do Agendador IG. Saiba como gerenciamos e protegemos seus dados.",
      },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
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
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Política de Privacidade
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Última atualização: {new Date().toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          <div className="space-y-6 text-foreground/90 leading-relaxed text-sm">
            <p>
              O <strong>Agendador IG</strong> está empenhado em proteger a sua privacidade. Esta Política de
              Privacidade explica como coletamos, usamos, divulgamos e protegemos as suas informações
              ao utilizar o nosso aplicativo de agendamento de posts para o Instagram.
            </p>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                1. Informações que Coletamos
              </h2>
              <p>
                Para fornecer os serviços de agendamento e publicação automática, coletamos as seguintes
                informações:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Dados de Autenticação:</strong> Usamos o provedor de autenticação Google para registrar
                  sua conta (coletamos apenas seu nome, e-mail e foto de perfil).
                </li>
                <li>
                  <strong>Tokens de Acesso da API do Facebook/Meta:</strong> Quando você vincula suas contas do
                  Instagram Business, recebemos chaves de acesso criptografadas fornecidas pela Meta para realizar as publicações em seu nome.
                </li>
                <li>
                  <strong>Informações de Páginas e Contas:</strong> Nome do perfil, foto do perfil, nome da conta e ID de suas páginas do Facebook e contas do Instagram vinculadas.
                </li>
                <li>
                  <strong>Conteúdo dos Posts:</strong> Imagens, vídeos, textos de legendas e datas/horários que você insere ao agendar suas postagens no sistema.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                2. Como Usamos Suas Informações
              </h2>
              <p>As informações coletadas são usadas exclusivamente para:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Permitir o login seguro no aplicativo.</li>
                <li>Conectar e listar suas contas do Instagram Business autorizadas.</li>
                <li>Agendar e publicar de forma automatizada os seus posts na rede social selecionada na data definida.</li>
                <li>Melhorar e otimizar a experiência geral de uso do sistema.</li>
              </ul>
              <p className="text-muted-foreground italic">
                Nós nunca venderemos ou alugaremos seus dados a terceiros, nem utilizaremos suas contas do Instagram para qualquer outra atividade que não seja a solicitada explicitamente por você.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                3. Compartilhamento de Dados com a Meta (Facebook)
              </h2>
              <p>
                O Agendador IG interage diretamente com a API oficial da Meta (Instagram Graph API). O tráfego de
                dados com a Meta ocorre respeitando as diretrizes de privacidade impostas pela plataforma. Seus tokens
                de acesso e conteúdos agendados são transmitidos de forma segura via HTTPS.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                4. Segurança e Armazenamento de Dados
              </h2>
              <p>
                Nossos bancos de dados e servidores utilizam tecnologias modernas e seguras fornecidas pelo
                Supabase, garantindo a criptografia de tokens e informações pessoais. Adotamos práticas rígidas
                de controle de acesso para garantir que apenas os processos necessários tenham acesso aos tokens da API.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                5. Seus Direitos e Exclusão de Dados
              </h2>
              <p>
                Você tem o controle total sobre seus dados. A qualquer momento, você pode:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Desvincular suas contas do Instagram diretamente no painel interno do aplicativo.
                </li>
                <li>
                  Remover o aplicativo do Agendador IG diretamente das configurações da sua conta do Facebook em "Integrações de Negócios".
                </li>
                <li>
                  Solicitar a exclusão permanente de todos os seus dados armazenados em nossos servidores. Para mais detalhes, acesse nossa página de <Link to="/data-deletion" className="text-primary hover:underline font-medium">Exclusão de Dados</Link>.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                6. Alterações nesta Política
              </h2>
              <p>
                Podemos atualizar esta Política de Privacidade periodicamente. Avisaremos sobre quaisquer mudanças
                relevantes atualizando a data de última modificação no topo desta página.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                7. Contato
              </h2>
              <p>
                Se você tiver alguma dúvida sobre esta Política de Privacidade ou sobre o tratamento de seus dados,
                entre em contato conosco pelo e-mail: <a href="mailto:suporte@agendadorig.com" className="text-primary hover:underline">suporte@agendadorig.com</a>.
              </p>
            </section>
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
