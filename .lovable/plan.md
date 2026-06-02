
# Agendador de Instagram

Aplicação para conectar contas do Instagram e agendar **posts (feed/carrossel), stories e reels** com publicação automática no horário escolhido.

## Como funciona a integração (e o que a Meta exige)

A publicação no Instagram só funciona via **Instagram Graph API**, que tem requisitos rígidos. Quero ser transparente sobre eles antes de começar:

1. **Conta Instagram Business ou Creator** (conta pessoal não funciona via API).
2. Essa conta precisa estar **vinculada a uma Página do Facebook**.
3. É preciso criar um **App de Desenvolvedor da Meta** (em developers.facebook.com) e obter um **App ID** e **App Secret**.
4. A API exige que a mídia (imagem/vídeo) esteja em uma **URL pública** — a Meta baixa o arquivo dessa URL. Vamos usar o armazenamento do Lovable Cloud para isso.
5. **App Review da Meta:** enquanto o app estiver em modo de desenvolvimento, só publica em contas adicionadas como testadoras. Para uso geral, a Meta exige aprovação das permissões `instagram_basic`, `instagram_content_publish`, `pages_show_list` e `business_management`. Vou te guiar nesse processo.

Vou montar um guia passo a passo dentro do próprio app para você configurar tudo isso.

## O que será construído

### 1. Backend (Lovable Cloud)
Será necessário ativar o Lovable Cloud para banco de dados, autenticação, armazenamento de mídia e tarefas agendadas.

- **Login com Google** no app.
- **Tabelas:**
  - `instagram_accounts` — contas IG conectadas (id, nome, token de acesso de longa duração, data de expiração) ligadas ao usuário.
  - `scheduled_posts` — posts agendados (tipo: feed/carrossel/story/reel, legenda, lista de mídias, conta destino, horário, status).
  - `post_media` — arquivos de mídia associados.
- **RLS:** cada usuário só vê/gerencia seus próprios dados.
- **Storage:** bucket público para as mídias (necessário para a API da Meta acessar).

### 2. Conexão com a Meta (OAuth)
- Botão "Conectar Instagram" que inicia o **Facebook Login**.
- Troca do código por **token de longa duração** (~60 dias) e listagem das contas Instagram Business vinculadas para o usuário escolher.
- Aviso de renovação quando o token estiver perto de expirar.

### 3. Agendamento e publicação automática
- **Editor de publicação:** upload de mídia, escrever legenda, escolher conta, tipo (post/story/reel/carrossel), data e hora.
- **Pré-visualização** do conteúdo antes de agendar.
- **Calendário/lista** dos posts agendados, com editar/cancelar.
- **Publicação automática:** um endpoint público (`/api/public/publish-due`) acionado periodicamente por uma tarefa agendada (pg_cron) verifica posts vencidos e os publica via Graph API (fluxo de criar container de mídia → publicar).
- Tratamento de status: agendado, publicando, publicado, falhou (com motivo).

### 4. Interface
- Dashboard com próximos agendamentos.
- Tela de contas conectadas.
- Tela de criação/edição de agendamento.
- Guia de configuração da Meta (passo a passo embutido).

## Segredos necessários
Vou pedir, no momento certo, o **Meta App ID** e o **Meta App Secret** (que você vai obter seguindo o guia). Eles ficam armazenados com segurança no backend, nunca no frontend.

## Detalhes técnicos
- **Stack:** TanStack Start + Lovable Cloud (Supabase). Server functions/rotas para o fluxo OAuth e publicação.
- **Tipos de mídia suportados pela API:** imagem única, carrossel (até 10), reels (vídeo) e stories (imagem/vídeo). Limites de formato/tamanho da Meta serão validados no upload.
- **Cron:** rota `/api/public/*` protegida por segredo, chamada por pg_cron a cada poucos minutos.

## Primeira entrega sugerida
Para não fazer tudo de uma vez, proponho começar por: login Google + conexão da conta Instagram + agendamento de **post de imagem/carrossel** com publicação automática. Em seguida adiciono **reels** e **stories**. Posso ajustar essa ordem se preferir.
