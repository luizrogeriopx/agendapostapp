import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Instagram, CalendarClock, Image, Clapperboard, Sparkles, MessageSquare, ArrowRight, CreditCard, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agendador de Instagram — Posts, Reels, Stories e Automações" },
      {
        name: "description",
        content:
          "Conecte suas contas do Instagram Business, agende posts, reels e stories e automatize respostas em comentários e directs.",
      },
      { property: "og:title", content: "Agendador de Instagram com Automação" },
      {
        property: "og:description",
        content: "Agende posts, reels e stories e automatize comentários e direct em um só lugar.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 border-b border-muted/40 sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Instagram className="h-5 w-5" />
          </span>
          Agendador IG
        </div>
        <div className="flex items-center gap-4">
          <Link to="/plans">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <CreditCard className="h-4 w-4" /> Planos
            </Button>
          </Link>
          <Link to="/auth">
            <Button variant="outline">Entrar</Button>
          </Link>
          <Link to="/auth">
            <Button style={{ background: "var(--gradient-brand)" }} className="text-white hover:opacity-90 transition-opacity">
              Começar Grátis
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 w-full flex-1 pb-20">
        {/* Hero Section */}
        <section className="py-24 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
          
          <Badge className="mb-4 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 px-3 py-1 text-xs font-semibold rounded-full gap-1.5 inline-flex items-center">
            <Sparkles className="h-3.5 w-3.5" /> NOVO: Automação de Comentários e Direct!
          </Badge>

          <h1 className="mx-auto max-w-3xl text-5xl font-black tracking-tight text-foreground sm:text-6xl leading-[1.15]">
            Agende seu conteúdo e <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">automatize suas vendas</span>
          </h1>
          
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Conecte suas contas Business, programe posts, carrosséis, reels e stories com publicação automática. Além disso, responda comentários e envie links diretos pelo Direct 24/7 sem esforço.
          </p>

          <div className="mt-10 flex justify-center items-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="px-8 font-semibold text-white transition-transform duration-200 hover:scale-[1.02]" style={{ background: "var(--gradient-brand)" }}>
                Começar agora <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/plans">
              <Button size="lg" variant="outline" className="px-6 font-semibold">
                Ver Planos e Preços
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section className="grid gap-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { 
              icon: CalendarClock, 
              title: "Agendamento Inteligente", 
              desc: "Programe dia e hora exatos de seus posts e deixe o resto por nossa conta.",
              color: "from-pink-500 to-rose-500"
            },
            { 
              icon: Image, 
              title: "Feed e Carrosséis", 
              desc: "Publique imagens únicas ou carrosséis completos com marcação de perfis.",
              color: "from-purple-500 to-pink-500"
            },
            { 
              icon: Clapperboard, 
              title: "Reels e Stories", 
              desc: "Publique vídeos automaticamente para engajar seu público em múltiplos formatos.",
              color: "from-indigo-500 to-purple-500"
            },
            { 
              icon: MessageSquare, 
              title: "Automação de Directs", 
              desc: "Responda instantaneamente aos comentários e envie mensagens privadas no Direct.",
              color: "from-blue-500 to-indigo-500"
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-xs hover:shadow-md transition-all duration-300 group">
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white bg-gradient-to-br ${f.color} group-hover:scale-110 transition-transform duration-300`}
              >
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-normal">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Detailed Automation Info Section */}
        <section className="rounded-3xl border bg-card/50 backdrop-blur-xs p-8 sm:p-12 shadow-xs grid gap-8 md:grid-cols-2 items-center overflow-hidden relative">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="space-y-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Gere vendas no piloto automático com Automações
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Não perca nenhuma oportunidade de conversão. Quando seus seguidores comentarem palavras-chave específicas nas suas publicações, o sistema responde o comentário na hora e envia seu link de vendas ou contato diretamente no Direct deles.
            </p>
            <ul className="space-y-3">
              {[
                "Resposta instantânea em posts de Feed, Reels e Carrossel",
                "Envio automático de links, catálogos e cupons via Direct",
                "Filtro inteligente por palavras-chave gatilho",
                "Configuração simples e 100% segura com a API oficial da Meta",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground/80">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <Link to="/auth">
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                  Ativar Minha Primeira Automação <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="bg-muted/40 rounded-2xl p-6 border flex flex-col gap-4 relative shadow-inner">
            <div className="flex items-center gap-3 border-b pb-3 border-muted/80">
              <span className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">IG</span>
              <div>
                <p className="text-xs font-bold text-foreground">Simulação de Comentário</p>
                <p className="text-[10px] text-muted-foreground">Postagem Recente</p>
              </div>
            </div>
            
            <div className="space-y-3 text-xs leading-normal">
              <div className="bg-card p-3 rounded-xl border border-muted shadow-xs self-start max-w-[85%]">
                <p className="font-semibold text-[10px] text-indigo-500 mb-0.5">@cliente_interessado</p>
                <p className="text-foreground">Eu quero o link do produto! Envia pra mim por favor! 🔥</p>
              </div>
              
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50 shadow-xs self-end ml-auto max-w-[85%] relative">
                <span className="absolute -top-1.5 -left-1.5 bg-indigo-500 text-white text-[8px] font-extrabold px-1 rounded-full flex items-center gap-0.5">
                  <Sparkles className="h-2 w-2" /> Auto-Resposta
                </span>
                <p className="font-semibold text-[10px] text-primary mb-0.5">Sua Loja (Agendador)</p>
                <p className="text-foreground mb-1">Olá! Acabamos de enviar o link de acesso exclusivo direto no seu Direct! Dá uma olhadinha lá 😉</p>
                <p className="text-[9px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium italic border-t pt-1 border-indigo-100/30">
                  Direct enviado: "Aqui está o seu link: https://sualoja.com/produto"
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto py-8">
        <div className="mx-auto max-w-5xl px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground w-full">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Instagram className="h-4 w-4" />
            </span>
            Agendador IG
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Política de Privacidade
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Termos de Serviço
            </Link>
            <Link to="/data-deletion" className="hover:text-foreground transition-colors">
              Exclusão de Dados
            </Link>
          </div>
          <p className="text-xs">
            &copy; {new Date().getFullYear()} Agendador IG. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Custom simple Badge component for styling if UI library version differs
function Badge({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
