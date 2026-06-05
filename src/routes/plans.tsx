import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanType } from "@/lib/plans";
import { getMyProfile, upgradePlan } from "@/lib/profile.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Instagram, Check, X, Sparkles, Crown, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "Planos e Preços — Agendador de Instagram" }] }),
  component: PlansPage,
});

function PlansPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMyProfile = useServerFn(getMyProfile);
  const triggerUpgrade = useServerFn(upgradePlan);

  const [isAnnual, setIsAnnual] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check login status
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  // Fetch profile if logged in
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchMyProfile(),
    enabled: isLoggedIn,
  });

  const activePlan = profile?.subscription_plan || "teste";

  const upgradeMutation = useMutation({
    mutationFn: async (vars: { planId: PlanType; billingCycle: "monthly" | "yearly"; origin: string }) => {
      return triggerUpgrade({ data: vars });
    },
    onSuccess: (res) => {
      if (res.stripeUrl) {
        toast.info("Redirecionando para o ambiente de pagamento seguro da Stripe...");
        window.location.href = res.stripeUrl;
      } else {
        toast.success(`Plano alterado para ${PLANS[res.profile?.subscription_plan as PlanType]?.name || "Plano Teste"}!`);
        qc.invalidateQueries({ queryKey: ["profile"] });
        navigate({ to: "/financial" });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao alterar o plano.");
    },
  });

  const handleSelectPlan = (planId: PlanType) => {
    if (!isLoggedIn) {
      toast.info("Por favor, crie uma conta ou faça login para escolher um plano.");
      navigate({ to: "/auth" });
      return;
    }

    if (planId === activePlan) {
      toast.info("Você já está utilizando este plano!");
      return;
    }

    const billingCycle = isAnnual ? "yearly" : "monthly";
    const planName = PLANS[planId].name;
    const origin = window.location.origin;
    
    if (planId === "teste") {
      toast.promise(
        upgradeMutation.mutateAsync({ planId, billingCycle, origin }),
        {
          loading: `Alterando para ${planName}...`,
          success: `Plano alterado para ${planName}!`,
          error: "Erro ao alterar o plano.",
        }
      );
      return;
    }

    // Propose upgrade confirmation
    const price = isAnnual ? PLANS[planId].priceAnnual : PLANS[planId].priceMonthly;
    const period = isAnnual ? "ano" : "mês";
    
    if (confirm(`Deseja alterar seu plano para o ${planName} por R$ ${price.toFixed(2)}/${period}? Você será redirecionado para a Stripe para concluir o pagamento.`)) {
      upgradeMutation.mutate({ planId, billingCycle, origin });
    }
  };

  const getPrice = (planId: PlanType) => {
    const plan = PLANS[planId];
    if (planId === "teste") return "Gratuito";
    const price = isAnnual ? plan.priceAnnual / 12 : plan.priceMonthly;
    return `R$ ${price.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 border-b border-muted/40">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <Link to="/" className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Instagram className="h-5 w-5" />
            </span>
            <span>Agendador IG</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Link to="/dashboard">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
              </Button>
            </Link>
          ) : (
            <Link to="/auth">
              <Button variant="outline">Entrar</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 w-full flex-1 py-16 space-y-16">
        {/* Title */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Escolha o plano ideal para o seu perfil
          </h1>
          <p className="text-muted-foreground text-base">
            Seja você um produtor de conteúdo inicial ou uma agência de marketing digital de grande escala, temos o plano perfeito.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-6 flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
              Cobrança Mensal
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-muted transition-colors duration-200 ease-in-out focus:outline-hidden"
              style={{ backgroundColor: isAnnual ? "var(--color-primary, #db2777)" : "" }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                style={{ transform: isAnnual ? "translateX(20px)" : "translateX(0px)" }}
              />
            </button>
            <span className={`text-sm font-medium flex items-center gap-1.5 ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
              Cobrança Anual
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Salvar 40%
              </span>
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch">
          {(["teste", "agendapro", "automacaopro", "premium"] as PlanType[]).map((planId) => {
            const plan = PLANS[planId];
            const isCurrent = isLoggedIn && activePlan === planId;
            const isPopular = planId === "premium";

            return (
              <div
                key={planId}
                className={`rounded-3xl border bg-card p-6 shadow-xs flex flex-col justify-between relative transition-all duration-300 ${
                  isPopular ? "border-primary ring-2 ring-primary/20 scale-[1.02] lg:scale-[1.03]" : "border-muted/60"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Crown className="h-3 w-3 fill-white" /> Recomendado
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground min-h-[32px] mt-1">
                      {planId === "teste" && "Perfeito para testar nossa plataforma e automações básicas."}
                      {planId === "agendapro" && "Ideal para quem quer apenas programar posts ilimitados."}
                      {planId === "automacaopro" && "Focado em quem quer apenas rodar automações de venda."}
                      {planId === "premium" && "O melhor dos dois mundos. Agendamentos e automações ilimitadas."}
                    </p>
                  </div>

                  <div className="border-t pt-4 border-muted/55">
                    <span className="text-4xl font-black text-foreground">
                      {getPrice(planId)}
                    </span>
                    {planId !== "teste" && (
                      <span className="text-muted-foreground text-xs font-semibold">
                        /{isAnnual ? "mês eq." : "mês"}
                      </span>
                    )}
                    {planId !== "teste" && isAnnual && (
                      <p className="text-[10px] text-emerald-500 font-bold mt-1">
                        R$ {plan.priceAnnual.toFixed(0)} cobrados anualmente
                      </p>
                    )}
                  </div>

                  {/* Limits summary list */}
                  <ul className="space-y-3 pt-2 text-xs leading-normal">
                    <li className="flex items-start gap-2">
                      {plan.hasScheduling ? (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <span>
                        {plan.maxPosts === Infinity && "Agendamento ilimitado"}
                        {plan.maxPosts === 5 && "Limite de 5 agendamentos"}
                        {plan.maxPosts === 0 && "Sem suporte a agendamento"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      {plan.hasAutomations ? (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <span>
                        {plan.maxAutomations === Infinity && "Automações ilimitadas"}
                        {plan.maxAutomations === 1 && "Apenas 1 automação ativa"}
                        {plan.maxAutomations === 0 && "Sem suporte a automações"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      {plan.maxRepliesPerAutomation === Infinity ? (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : plan.maxRepliesPerAutomation > 0 ? (
                        <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <span>
                        {plan.maxRepliesPerAutomation === Infinity && "Envios de Direct/respostas ilimitados"}
                        {plan.maxRepliesPerAutomation === 3 && "Limite de 3 respostas no total"}
                        {plan.maxRepliesPerAutomation === 0 && "Sem respostas automáticas"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      {plan.hasTagging ? (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <span className={!plan.hasTagging ? "text-muted-foreground line-through" : ""}>
                        Marcação de perfis nas mídias
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      {plan.hasBulkScheduling ? (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <span className={!plan.hasBulkScheduling ? "text-muted-foreground line-through" : ""}>
                        Agendamento em massa via planilhas
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6">
                  <Button
                    onClick={() => handleSelectPlan(planId)}
                    disabled={upgradeMutation.isPending || (loadingProfile && isLoggedIn)}
                    className="w-full font-semibold gap-1.5"
                    variant={isCurrent ? "outline" : isPopular ? "default" : "secondary"}
                    style={isPopular && !isCurrent ? { background: "var(--gradient-brand)", color: "#fff" } : undefined}
                  >
                    {isCurrent ? (
                      "Plano Ativo"
                    ) : upgradeMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Atualizando...
                      </>
                    ) : (
                      "Escolher Plano"
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="rounded-3xl border bg-card/65 p-6 shadow-xs overflow-x-auto space-y-6">
          <h2 className="text-xl font-extrabold text-foreground text-center">Tabela Comparativa</h2>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-muted">
                <th className="py-3 px-4 text-muted-foreground font-semibold">Recursos</th>
                <th className="py-3 px-4 text-foreground font-bold">Plano Teste</th>
                <th className="py-3 px-4 text-foreground font-bold">AgendaPró</th>
                <th className="py-3 px-4 text-foreground font-bold">AutomaçãoPró</th>
                <th className="py-3 px-4 text-foreground font-bold">Plano Premium</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-muted/50">
                <td className="py-3 px-4 font-medium">Agendamento de Posts</td>
                <td className="py-3 px-4 text-muted-foreground">Até 5 posts</td>
                <td className="py-3 px-4 text-foreground">Ilimitado</td>
                <td className="py-3 px-4 text-muted-foreground">Não possui</td>
                <td className="py-3 px-4 text-foreground">Ilimitado</td>
              </tr>
              <tr className="border-b border-muted/50">
                <td className="py-3 px-4 font-medium">Automações Ativas</td>
                <td className="py-3 px-4 text-muted-foreground">Apenas 1</td>
                <td className="py-3 px-4 text-muted-foreground">Não possui</td>
                <td className="py-3 px-4 text-foreground">Ilimitado</td>
                <td className="py-3 px-4 text-foreground">Ilimitado</td>
              </tr>
              <tr className="border-b border-muted/50">
                <td className="py-3 px-4 font-medium">Respostas de Comentários</td>
                <td className="py-3 px-4 text-muted-foreground">Até 3 total</td>
                <td className="py-3 px-4 text-muted-foreground">Não possui</td>
                <td className="py-3 px-4 text-foreground">Ilimitado</td>
                <td className="py-3 px-4 text-foreground">Ilimitado</td>
              </tr>
              <tr className="border-b border-muted/50">
                <td className="py-3 px-4 font-medium">Marcação de Usuários</td>
                <td className="py-3 px-4"><X className="h-4 w-4 text-rose-500" /></td>
                <td className="py-3 px-4"><Check className="h-4 w-4 text-emerald-500" /></td>
                <td className="py-3 px-4"><X className="h-4 w-4 text-rose-500" /></td>
                <td className="py-3 px-4"><Check className="h-4 w-4 text-emerald-500" /></td>
              </tr>
              <tr className="border-b border-muted/50">
                <td className="py-3 px-4 font-medium">Agendamento em Massa</td>
                <td className="py-3 px-4"><X className="h-4 w-4 text-rose-500" /></td>
                <td className="py-3 px-4"><Check className="h-4 w-4 text-emerald-500" /></td>
                <td className="py-3 px-4"><X className="h-4 w-4 text-rose-500" /></td>
                <td className="py-3 px-4"><Check className="h-4 w-4 text-emerald-500" /></td>
              </tr>
              <tr className="border-b border-muted/50">
                <td className="py-3 px-4 font-medium">Suporte e Atualizações</td>
                <td className="py-3 px-4 text-muted-foreground">Comunidade</td>
                <td className="py-3 px-4 text-foreground">Suporte Standard</td>
                <td className="py-3 px-4 text-foreground">Suporte Standard</td>
                <td className="py-3 px-4 text-foreground">Suporte Prioritário</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
