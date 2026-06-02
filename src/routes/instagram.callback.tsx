import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { connectInstagram } from "@/lib/instagram.functions";

export const Route = createFileRoute("/instagram/callback")({
  ssr: false,
  component: CallbackPage,
});

function CallbackPage() {
  const [message, setMessage] = useState("Conectando sua conta...");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error_description") || params.get("error");

      const post = (payload: any) => {
        if (window.opener) {
          window.opener.postMessage({ type: "ig-oauth-result", ...payload }, window.location.origin);
        }
      };

      if (error || !code) {
        post({ success: false, error: error || "Autorização cancelada." });
        setMessage("Falha na autorização. Você pode fechar esta janela.");
        setTimeout(() => window.close(), 1500);
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/instagram/callback`;
        const result = await connectInstagram({ data: { code, redirectUri } });
        post({ success: true, accounts: result.accounts });
        setMessage("Conta conectada! Fechando...");
      } catch (e: any) {
        post({ success: false, error: e?.message || "Erro ao conectar." });
        setMessage("Erro ao conectar: " + (e?.message || ""));
      }
      setTimeout(() => window.close(), 1200);
    };
    run();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
