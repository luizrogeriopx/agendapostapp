# Finalizar integração de pagamentos Stripe

As chaves `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` já estão salvas no backend. O fluxo de checkout e o webhook básico (`checkout.session.completed`) já existem no código. Agora é necessário publicar, conectar o webhook real e validar o fluxo de ponta a ponta.

## O que já existe
- Tela `/plans` com 4 planos (Teste, AgendaPró, AutomaçãoPró, Premium) e toggle mensal/anual.
- Tela `/financial` com resumo do plano ativo, faturas em aberto e histórico de pagamentos.
- `upgradePlan` cria sessão de checkout Stripe em modo `subscription` com `price_data` dinâmico.
- `verifyStripeSession` confirma o pagamento ao retornar de `/financial?session_id=...`.
- Endpoint `/api/public/stripe-webhook` processa `checkout.session.completed` e atualiza perfil + fatura.

## Passos para finalizar

### 1. Publicar o app
Republicar `agendapostapp.lovable.app` para que o ambiente publicado passe a usar as chaves Stripe salvas. O preview local já as enxerga, mas o site publicado precisa ser atualizado.

### 2. Configurar webhook no Stripe
- URL do endpoint: `https://agendapostapp.lovable.app/api/public/stripe-webhook`.
- Evento obrigatório: `checkout.session.completed`.
- Copiar o segredo de assinatura (`whsec_...`) para o secret `STRIPE_WEBHOOK_SECRET` se ainda não for o atual.

### 3. Melhorar robustez do webhook
O webhook atual só trata `checkout.session.completed`. Para assinaturas recorrentes funcionarem corretamente, adicionar:
- `invoice.paid`: marca fatura como paga e cria novas faturas de renovação.
- `customer.subscription.updated`: sincroniza mudanças de plano/cancelamento vindas do Stripe.
- `customer.subscription.deleted`: volta o usuário para o plano Teste ao cancelar.

### 4. Criar produtos/preços fixos no Stripe (opcional, mas recomendado)
Hoje o app cria `price_data` dinamicamente a cada checkout. Isso funciona, mas gera muitos preços duplicados no dashboard Stripe. Criar 6 preços fixos (3 planos pagos × 2 ciclos) e usar `price: <id>` no `line_items` melhora a organização e permite cupons/descontos no Stripe.

### 5. Testar o fluxo completo
- Criar conta/login com Google.
- Ir em `/plans`, escolher um plano pago e ser redirecionado ao Stripe Checkout.
- Usar cartão de teste `4242 4242 4242 4242`.
- Verificar retorno para `/financial?session_id=...` e atualização automática do plano ativo.
- Enviar evento de teste `checkout.session.completed` do Stripe para validar o webhook.

## Entrega esperada
- App publicado com Stripe ativo.
- Webhook configurado e validado.
- Renovações e cancelamentos tratados.
- Fluxo de upgrade testado e funcionando.
