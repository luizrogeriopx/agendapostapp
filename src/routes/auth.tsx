import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Instagram } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Agendador de Instagram" },
      { name: "description", content: "Faça login para conectar suas contas e agendar publicações no Instagram." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const signInGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ background: "var(--gradient-brand)" }}>
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-2xl border animate-fade-in">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Instagram className="h-8 w-8" />
        </div>
        <h1 className="text-center text-2xl font-bold text-foreground">Agendador de Instagram</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Crie sua conta para conectar seus perfis do Instagram Business e agendar publicações automaticamente.
        </p>

        <div className="mt-8 space-y-4">
          <Button onClick={signInGoogle} disabled={loading} className="w-full py-6 text-base font-semibold" size="lg">
            {loading ? "Conectando..." : "Criar conta / Entrar com Google"}
          </Button>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Acesso Seguro</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-2">
            <p className="text-center">
              * Novos usuários serão cadastrados automaticamente ao clicar no botão acima.
            </p>
            <p className="text-center">
              Ao continuar, você concorda em conectar suas contas do Instagram Business.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-4 text-xs border-t pt-4 text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground hover:underline">
            Privacidade
          </Link>
          <Link to="/terms" className="hover:text-foreground hover:underline">
            Termos
          </Link>
          <Link to="/data-deletion" className="hover:text-foreground hover:underline">
            Exclusão de Dados
          </Link>
        </div>
      </div>
    </div>
  );
}

