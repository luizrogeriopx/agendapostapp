export type PlanType = "teste" | "agendapro" | "automacaopro" | "premium";

export interface PlanDetails {
  id: PlanType;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  maxPosts: number;
  maxAutomations: number;
  maxRepliesPerAutomation: number;
  hasTagging: boolean;
  hasBulkScheduling: boolean;
  hasAutomations: boolean;
  hasScheduling: boolean;
}

export const PLANS: Record<PlanType, PlanDetails> = {
  teste: {
    id: "teste",
    name: "Plano Teste",
    priceMonthly: 0,
    priceAnnual: 0,
    maxPosts: 5,
    maxAutomations: 1,
    maxRepliesPerAutomation: 3,
    hasTagging: false,
    hasBulkScheduling: false,
    hasAutomations: true,
    hasScheduling: true,
  },
  agendapro: {
    id: "agendapro",
    name: "Plano AgendaPró",
    priceMonthly: 27,
    priceAnnual: 27 * 12 * 0.6, // 40% discount -> R$ 194.40/yr (equivalent to R$ 16.20/mo)
    maxPosts: Infinity,
    maxAutomations: 0,
    maxRepliesPerAutomation: 0,
    hasTagging: true,
    hasBulkScheduling: true,
    hasAutomations: false,
    hasScheduling: true,
  },
  automacaopro: {
    id: "automacaopro",
    name: "Plano AutomaçãoPró",
    priceMonthly: 37,
    priceAnnual: 37 * 12 * 0.6, // 40% discount -> R$ 266.40/yr (equivalent to R$ 22.20/mo)
    maxPosts: 0,
    maxAutomations: Infinity,
    maxRepliesPerAutomation: Infinity,
    hasTagging: false,
    hasBulkScheduling: false,
    hasAutomations: true,
    hasScheduling: false,
  },
  premium: {
    id: "premium",
    name: "Plano Premium",
    priceMonthly: 47,
    priceAnnual: 47 * 12 * 0.6, // 40% discount -> R$ 338.40/yr (equivalent to R$ 28.20/mo)
    maxPosts: Infinity,
    maxAutomations: Infinity,
    maxRepliesPerAutomation: Infinity,
    hasTagging: true,
    hasBulkScheduling: true,
    hasAutomations: true,
    hasScheduling: true,
  },
};
