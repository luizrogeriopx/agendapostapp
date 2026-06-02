import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getMetaConfig } from "@/lib/instagram.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({ meta: [{ title: "Configurar Meta — Agendador de Instagram" }] }),
  component: SetupPage,
});

function SetupPage() {
  const fetchConfig = useServerFn(getMetaConfig);
  const { data: config } = useQuery({ queryKey: ["meta-config"], queryFn: () => fetchConfig() });
  const [redirectUri, setRedirectUri] = useState("");

  useEffect(() => {
    setRedirectUri(`${window.location.origin}/instagram/callback`);
  }, []);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const steps = [
    {
      title: "Crie uma conta de desenvolvedor da Meta",
      body: (
        <>
          Acesse{" "}
          <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="font-medium text-primary underline">
            developers.facebook.com
          </a>{" "}
          e crie sua conta gratuitamente.
        </>
      ),
    },
    {
      title: "Crie um App do tipo 'Empresa'",
      body: "No painel de Apps, clique em Criar App e escolha o tipo Empresa (Business).",
    },
    {
      title: "Adicione o produto 'Instagram Graph API' e 'Facebook Login'",
      body: "No app, adicione os produtos Instagram (Graph API) e Login do Facebook.",
    },
    {
      title: "Configure a URL de redirecionamento OAuth",
      body: (
        <div>
          Em Login do Facebook → Configurações, adicione esta URL em “URIs de redirecionamento OAuth válidos”:
          <div className="mt-2 flex items-center gap-2 rounded-lg border bg-muted p-2">
            <code className="flex-1 break-all text-xs">{redirectUri}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(redirectUri)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ),
    },
    {
      title: "Vincule sua conta Instagram Business a uma Página do Facebook",
      body: "Sua conta Instagram precisa ser Business/Creator e estar vinculada a uma Página do Facebook.",
    },
    {
      title: "Copie o App ID e o App Secret e insira aqui",
      body: "Em Configurações → Básico, copie o ID do app e a Chave secreta do app. Depois me informe no chat para eu salvá-los com segurança.",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurar integração com a Meta</h1>
        <p className="text-sm text-muted-foreground">
          Siga os passos para conectar suas contas do Instagram via API oficial.
        </p>
      </div>

      <div
        className={`flex items-center gap-3 rounded-xl border p-4 ${
          config?.configured ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"
        }`}
      >
        {config?.configured ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Circle className="h-5 w-5 text-amber-600" />
        )}
        <span className="text-sm font-medium">
          {config?.configured
            ? "App da Meta configurado e pronto para conectar contas."
            : "App da Meta ainda não configurado (faltam App ID / App Secret)."}
        </span>
      </div>

      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-4 rounded-xl border bg-card p-4">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              {i + 1}
            </span>
            <div>
              <p className="font-medium text-foreground">{s.title}</p>
              <div className="mt-1 text-sm text-muted-foreground">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
        <Button variant="outline" className="w-full">
          Abrir painel de Apps da Meta <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </a>
    </div>
  );
}
