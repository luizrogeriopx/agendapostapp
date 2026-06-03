import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Instagram, ArrowLeft, FileText } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Serviço — Agendador IG" },
      {
        name: "description",
        content: "Termos de Serviço do Agendador IG. Regras e diretrizes para o uso do nosso aplicativo.",
      },
    ],
  }),
  component: TermsOfService,
});

function TermsOfService() {
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
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Termos de Serviço
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Última atualização: {new Date().toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          <div className="space-y-6 text-foreground/90 leading-relaxed text-sm">
            <p>
              Bem-vindo ao <strong>Agendador IG</strong>! Ao se cadastrar e utilizar nosso aplicativo,
              você concorda com estes Termos de Serviço. Leia-os atentamente antes de usar a plataforma.
            </p>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                1. Descrição do Serviço
              </h2>
              <p>
                O Agendador IG é uma ferramenta baseada na web que permite aos usuários agendar a publicação automática
                de mídias (fotos, vídeos, carrosséis, reels e stories) em contas do Instagram do tipo Business conectadas.
                O serviço depende diretamente da disponibilidade e das APIs oficiais fornecidas pela Meta Platforms, Inc.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                2. Cadastro e Acesso à Conta
              </h2>
              <p>
                Para utilizar o serviço, você precisa autenticar-se usando uma conta Google válida e possuir contas do
                Instagram Business devidamente vinculadas a uma Página do Facebook sobre a qual tenha permissão administrativa.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Você é responsável por manter a confidencialidade e segurança do seu acesso ao sistema.</li>
                <li>Você concorda em notificar o suporte imediatamente sobre qualquer uso não autorizado ou suspeito da sua conta.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                3. Conduta do Usuário e Responsabilidade pelo Conteúdo
              </h2>
              <p>
                Você é o único responsável pelo conteúdo das publicações agendadas (imagens, vídeos, textos e links)
                e garante que possui todos os direitos e autorizações necessários sobre as mídias carregadas.
              </p>
              <p>Você concorda em NÃO utilizar a plataforma para agendar:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Conteúdos que violem as Diretrizes da Comunidade do Instagram ou do Facebook.</li>
                <li>Mídias ilícitas, difamatórias, obscenas ou abusivas.</li>
                <li>Vírus, malwares ou códigos que visem prejudicar o funcionamento de sistemas.</li>
                <li>Materiais que violem direitos de propriedade intelectual ou industrial de terceiros.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                4. Limitação de Responsabilidade
              </h2>
              <p>
                O serviço é prestado "como está". O Agendador IG não se responsabiliza por:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Falhas no agendamento ou publicação decorrentes de instabilidades de rede, mudanças imprevistas nas políticas ou APIs da Meta, bloqueio de contas pelo Instagram ou limitações técnicas impostas por terceiros.
                </li>
                <li>
                  Perda de dados, engajamento ou danos comerciais decorrentes do uso da plataforma.
                </li>
                <li>
                  Qualquer exclusão de posts ou restrição de alcance decorrente de denúncias ou ações do algoritmo do Instagram sobre o conteúdo publicado.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                5. Alteração, Suspensão ou Encerramento
              </h2>
              <p>
                Reservamo-nos o direito de alterar, suspender ou descontinuar qualquer aspecto do serviço a qualquer
                momento. Em caso de violação grave ou recorrente destes Termos de Serviço, poderemos suspender ou
                bloquear seu acesso imediatamente, sem aviso prévio.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                6. Modificação dos Termos
              </h2>
              <p>
                Estes Termos podem ser atualizados. O uso continuado do serviço após a postagem das modificações
                constituirá a sua aceitação das novas regras.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground border-b pb-1">
                7. Lei Aplicável
              </h2>
              <p>
                Estes termos são regidos pelas leis da República Federativa do Brasil. Quaisquer disputas serão resolvidas
                no foro da comarca da sede administrativa do projeto.
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
