import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Instagram, CalendarClock, Image, Clapperboard } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agendador de Instagram — Posts, Reels e Stories" },
      {
        name: "description",
        content:
          "Conecte suas contas do Instagram Business e agende posts, carrosséis, reels e stories com publicação automática.",
      },
      { property: "og:title", content: "Agendador de Instagram" },
      {
        property: "og:description",
        content: "Agende posts, reels e stories com publicação automática no Instagram.",
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Instagram className="h-5 w-5" />
          </span>
          Agendador IG
        </div>
        <Link to="/auth">
          <Button>Entrar</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 w-full flex-1">
        <section className="py-20 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Agende seu conteúdo no Instagram em um só lugar
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Conecte suas contas Business, programe posts, carrosséis, reels e stories, e deixe a
            publicação acontecer automaticamente no horário certo.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth">
              <Button size="lg">Começar agora</Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-6 pb-24 sm:grid-cols-3">
          {[
            { icon: CalendarClock, title: "Agendamento", desc: "Escolha data e hora e relaxe." },
            { icon: Image, title: "Posts e carrosséis", desc: "Imagens e múltiplas mídias." },
            { icon: Clapperboard, title: "Reels e stories", desc: "Vídeos publicados automaticamente." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white"
                style={{ background: "var(--gradient-brand)" }}
              >
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

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

