import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, listInvoices, payInvoice } from "@/lib/profile.functions";
import { PLANS, type PlanType } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { CreditCard, Calendar, Receipt, ArrowRight, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/financial")({
  head: () => ({ meta: [{ title: "Financeiro — Agendador de Instagram" }] }),
  component: FinancialPage,
});

function FinancialPage() {
  const qc = useQueryClient();
  const fetchMyProfile = useServerFn(getMyProfile);
  const fetchInvoices = useServerFn(listInvoices);
  const triggerPayment = useServerFn(payInvoice);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchMyProfile(),
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => fetchInvoices(),
  });

  const payMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return triggerPayment({ data: { invoiceId } });
    },
    onSuccess: (updated) => {
      toast.success("Pagamento simulado com sucesso!");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao realizar o pagamento.");
    },
  });

  const activePlanId = (profile?.subscription_plan || "teste") as PlanType;
  const activePlan = PLANS[activePlanId];

  const openInvoices = invoices.filter((inv) => inv.status === "open");
  const paidInvoices = invoices.filter((inv) => inv.status === "paid");

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handlePay = (invoiceId: string, amount: number) => {
    if (confirm(`Deseja simular o pagamento desta fatura de R$ ${amount.toFixed(2)}?`)) {
      payMutation.mutate(invoiceId);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Gerencie seus planos de assinatura, faturas e histórico de pagamento.</p>
      </div>

      {loadingProfile ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Active Plan Detail Card */}
          <div className="md:col-span-2 rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CreditCard className="h-28 w-28 text-muted-foreground" />
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Plano Atual
                </span>
                <h2 className="text-2xl font-black text-foreground mt-2">{activePlan.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {activePlanId === "teste" && "Você está no plano de testes gratuito com limitações de uso."}
                  {activePlanId === "agendapro" && "Você tem agendamentos ilimitados liberados para suas mídias."}
                  {activePlanId === "automacaopro" && "Você tem automações de comentários e Direct ilimitadas."}
                  {activePlanId === "premium" && "Acesso completo e ilimitado a todas as ferramentas."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4 border-muted/50 text-xs">
                <div>
                  <p className="text-muted-foreground">Preço base do plano</p>
                  <p className="font-bold text-sm text-foreground">
                    {activePlanId === "teste" ? "Gratuito" : `R$ ${activePlan.priceMonthly.toFixed(2)}/mês`}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ciclo ativo</p>
                  <p className="font-bold text-sm text-foreground">
                    {activePlanId === "teste" ? "Permanente" : "Mensal / Anual"}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link to="/plans">
                <Button className="gap-2 bg-gradient-brand text-white hover:opacity-90 transition-opacity">
                  Alterar ou Fazer Upgrade <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Payment Status Widget */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="font-bold text-foreground text-sm">Resumo de Faturas</h3>
              
              {openInvoices.length > 0 ? (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs leading-normal">
                    <p className="font-bold text-amber-600 dark:text-amber-400">Pendência Financeira</p>
                    <p className="text-muted-foreground mt-0.5">
                      Você possui {openInvoices.length} fatura(s) aguardando pagamento.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs leading-normal">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">Tudo em dia!</p>
                    <p className="text-muted-foreground mt-0.5">
                      Nenhuma fatura em atraso ou pendência financeira em aberto.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground mt-4 pt-4 border-t border-muted/50">
              Pagamentos processados de forma simulada e segura.
            </div>
          </div>
        </div>
      )}

      {/* Main Billing Areas */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Open Invoices */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-foreground text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" /> Faturas em Aberto
            </h3>
            
            {loadingInvoices ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : openInvoices.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhuma fatura pendente de pagamento no momento.
              </p>
            ) : (
              <div className="space-y-3">
                {openInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 border rounded-xl bg-muted/20 text-xs">
                    <div className="space-y-1">
                      <p className="font-bold text-foreground">
                        {PLANS[inv.plan_id as PlanType]?.name || "Assinatura"}
                      </p>
                      <p className="text-muted-foreground">
                        Vencimento: {formatDate(inv.due_date)} ({inv.billing_cycle === "monthly" ? "Mensal" : "Anual"})
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-foreground text-sm">
                        R$ {inv.amount.toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handlePay(inv.id, inv.amount)}
                        disabled={payMutation.isPending}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[11px] h-8 px-3"
                      >
                        {payMutation.isPending && payMutation.variables === inv.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        Pagar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Paid Invoices (History) */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-foreground text-base flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-500" /> Histórico de Pagamentos
          </h3>
          
          {loadingInvoices ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : paidInvoices.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum pagamento registrado no histórico.
            </p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {paidInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 border rounded-xl bg-muted/10 text-xs hover:bg-muted/20 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-foreground">
                        {PLANS[inv.plan_id as PlanType]?.name || "Assinatura"}
                      </p>
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">
                        Pago
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Pago em: {inv.paid_at ? formatDate(inv.paid_at) : formatDate(inv.created_at)} ({inv.billing_cycle === "monthly" ? "Mensal" : "Anual"})
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-foreground text-sm">
                      R$ {inv.amount.toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        toast.info(`Comprovante de pagamento da fatura ${inv.id.substring(0, 8)} gerado com sucesso!`);
                      }}
                      title="Baixar Recibo/Fatura"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
