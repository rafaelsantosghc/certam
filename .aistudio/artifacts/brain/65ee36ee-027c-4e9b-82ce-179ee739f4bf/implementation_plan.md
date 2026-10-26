# CERTAM - Portal do Concurseiro: Arquitetura & Expansão Funcional

Plataforma escalável de acompanhamento, classificação, preferências de lotação e interação entre concurseiros, iniciando com os concursos do Rio Grande do Sul (TJRS e MPRS) e estruturada para abrangência nacional.

---

## Revisão do Usuário & Decisões Críticas

> [!IMPORTANT]
> As decisões de produto a seguir foram confirmadas na Fase 1 e orientam a implementação integral do sistema:

- **Concursos Iniciais de Validação**:
  - **TJRS**: Cargos: *Analista Judiciário - Área Judiciária*, *Analista Judiciário - Área Administrativa* e *Técnico Judiciário - Área Administrativo-Judiciária*.
  - **MPRS**: Cargos: *Analista do Ministério Público* e *Técnico do Ministério Público*.
- **Mecanismo de Notificações**:
  - Notificações internas no portal (ícone de sininho com contador de não-lidas em tempo real).
  - Arquitetura otimizada por concurso/cargo com tabela de leitura por usuário (`notification_reads`), evitando a duplicação desnecessária de milhares de registros no banco/store.
- **Regra de Acesso aos Chats e Homologação**:
  - **Cadastro Geral de Candidatos (Master List)**: O portal armazena as listas oficiais de classificação. Ao fazer login e preencher CPF e Nome Completo, o sistema realiza a vinculação unívoca no cadastro geral.
  - **Critério de Liberação**: Concursos não homologados possuem chats abertos a todos. Concursos homologados restringem o chat aos candidatos aprovados identificados por CPF vinculado ou Nome Completo.
  - **Recurso Manual**: Candidato não identificado automaticamente conta com botão imediato para solicitar verificação ao administrador, com deferimento em 1 clique no painel administrativo.

---

## 1. Visão Geral & Proposta de Valor

- **O que faz**: O CERTAM centraliza a vida do concurseiro aprovado ou em disputa, oferecendo cronograma oficial em linha do tempo, listas de classificação completas com proteção de dados, simuladores de escolha de comarcas por lote convocatório, quantitativo de cargos vagos/ocupados, comunicados oficiais (como monitoramento de PLs de cargos comissionados vs. efetivos) e canais de comunicação com controle de acesso dinâmico.
- **Público-Alvo**: Concurseiros, candidatos aprovados aguardando nomeação, comissões de aprovados e administradores de certames.
- **Valor Principal**: Transparência, organização colaborativa para nomeações e fim da dispersão de informações em grupos fragmentados de WhatsApp/Telegram.

---

## 2. Experiência do Usuário & Design Visual

### Fluxos Principais
1. **Descoberta & Home**:
   - Listagem dos concursos ativos, encerrados e previstos.
   - Filtros por esfera (Estadual, Municipal, Federal), status e busca por texto.
2. **Página do Concurso (`/concurso?id=...`)**:
   - Cabeçalho institucional com órgão, edital, ano e status (ex: *Homologado*, *Convocando*, *Em Andamento*).
   - Abas temáticas:
     1. **Linha do Tempo (Cronograma Oficial)**: Etapas concluídas, atual e futuras com datas e editais vinculados.
     2. **Cargos & Vagas**: Lista dos cargos com número de vagas imediatas, CR, nível de escolaridade e link individual de cada cargo.
     3. **Quadro de Vagas**: Vacâncias oficiais vs. cargos ocupados e projeções de convocações.
     4. **Documentos Oficiais**: Editais, retificações, comunicados e decisões judiciais para download direto.
     5. **Comunicados & Mobilização**: Notícias e avisos oficiais (ex: projetos de lei, audiências públicas, atos de gestão).
3. **Página do Cargo (`/concurso?id=...&cargo=...`)**:
   - Lista de Classificação Oficial: Visualização pública restrita (Posição e Nome).
   - Visualização para Aprovados Autenticados: Notas por disciplina, intenção de posse, cota e preferências de comarca.
   - Chat do Cargo: Aberto antes da homologação; restrito aos aprovados após homologação.
   - Acesso aos Lotes Convocatórios deste cargo.
4. **Página do Lote Convocatório (`/lote?id=...&cargo=...&lote=...`)**:
   - Simulador interativo de alocação de comarcas restrito aos convocados do lote.
   - Chat exclusivo do lote convocatório.
5. **Perfil do Candidato & Auditoria de Alterações**:
   - Dados: Nome Completo, CPF, Data de Nascimento, WhatsApp, E-mail de Contato (com botão para manter e-mail de login), seleção múltipla de outros concursos/cargos onde foi aprovado.
   - Caso o concurso do candidato não conste na lista, formulário direto para solicitar inclusão ao admin.
   - Ao editar dados já salvos, o sistema gera uma **Solicitação de Alteração** com diff ("Antes" vs. "Depois") enviada para a fila de moderação do administrador.
6. **Mensagens Privadas (1 a 1)**:
   - Conversas diretas entre candidatos aprovados para troca de contatos e dúvidas sobre comarcas, com opção de silenciar conversas e bloquear usuários.
7. **Canal "Fale com o Administrador"**:
   - Modal/Página com formulário segmentado por categoria (*Inclusão de Concurso*, *Erro de Classificação*, *Dúvida*, *Sugestão*, *Outro*).

### Identidade Visual & Design System CERTAM
- **Paleta de Cores**:
  - `Azul Nobre Marítimo`: `#07192B` (fundos institucionais e cabeçalhos).
  - `Menta Vibrante`: `#2DD4AA` (destaques, status ativo e chamadas de ação).
  - `Azul Petróleo / Teal`: `#135A7A` (bordas ativas, acentos secundários e navegação).
  - `Neutros de Alta Densidade`: Fundo suave `#F8FAFC`, cartões `#FFFFFF`, texto primário `#0F172A` e secundário `#475569`.
- **Tipografia**:
  - Títulos e cabeçalhos institucionais com porte serifado sóbrio (`font-serif`, `Merriweather` / `Playfair Display`).
  - Interface, controles e formulários em tipografia limpa sans-serif (`font-sans`, `Plus Jakarta Sans` / `Outfit`).
  - Classificações, notas, datas e CPFs com algarismos tabulares e monoespaçados (`font-mono`, `tabular-nums`).
- **Disciplina Anti-Slop (Zero-Pills)**:
  - Eliminação de pílulas estáticas repetitivas para metadados; uso de texto inline limpo com separadores sutis (`·` ou `/`).
  - Botões de filtro em controles segmentados funcionais com contraste WCAG AA.

---

## 3. Decisões Técnicas de Produto & Trade-Offs

- **Decisão 1: Otimização de Notificações em Escala (Single-Broadcast + Read-Ledger)**:
  - *Abordagem*: Cada notificação de concurso/cargo é registrada uma única vez (`NotificationEvent`). O usuário apenas registra IDs lidos em seu perfil (`read_notification_ids`).
  - *Vantagem*: Evita a geração de 50.000 linhas de notificação quando 5.000 candidatos do TJRS recebem um comunicado de convocação.
- **Decisão 2: Auditoria de Modificações no Perfil**:
  - *Abordagem*: Alterações em campos sensíveis (Nome, CPF, Classificações) entram em estado `pendente_aprovacao`. O admin visualiza o comparativo lado a lado e pode aprovar ou rejeitar com justificativa.
  - *Vantagem*: Impede fraudes de identidade, falsificação de notas ou usurpação de colocações de outros candidatos.
- **Decisão 3: Verificação Híbrida de Aprovados**:
  - *Abordagem*: Cruzamento determinístico de CPF e Nome com a base oficial de inscritos, com fluxo de fallback amigável caso haja variação de acentuação ou ausência de CPF na listagem oficial publicada pelo tribunal.

---

## 4. Arquitetura Técnica & Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CERTAM PORTAL (React SPA)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ROTEAMENTO VIA QUERY PARAMS / PERMALINKS:                                  │
│  • /                 -> Portal Home (Catálogo com Filtros)                  │
│  • /concurso?id=...  -> Concurso Dashboard (Linha do Tempo, Vagas, Docs)  │
│  • /concurso?...&cargo=... -> Cargo View (Classificação, Chat, Lotes)       │
│  • /lote?...         -> Simulador de Comarcas do Lote Convocatório          │
│  • /admin            -> Painel Administrativo com Fila de Moderação         │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │
    ┌───────────┴─────────────────────────────────────────┐
    ▼                                                     ▼
┌───────────────────────────────┐     ┌───────────────────────────────────────┐
│     STORES & CONTEXTOS        │     │         MÓDULOS & COMPONENTES         │
├───────────────────────────────┤     ├───────────────────────────────────────┤
│ • authContext.tsx             │     │ • Navbar & NotificationBell           │
│   (Sessão, Perfil, Master ID) │     │ • ConcursoLinhaDoTempo (Etapas)       │
│ • certamStore.ts              │     │ • ConcursoQuadroVagas (Vacâncias)     │
│   (Concursos TJRS/MPRS, Docs) │     │ • ConcursoDocumentos & Comunicados    │
│ • lotesStore.ts               │     │ • CargoClassificacaoTable (Público/   │
│   (Lotes, Comarcas, Respostas)│     │   Aprovado com proteção de CPF)       │
│ • chatStore.ts & dmStore.ts   │     │ • ChatIntegrado (Público vs Restrito) │
│   (Canais Cargo e 1-a-1)      │     │ • MensagensPrivadasDrawer             │
│ • auditStore.ts               │     │ • PerfilModal com Submissão ao Admin  │
│   (Fila de Alterações/Diffs)  │     │ • AdminAprovacoes & Fila de Contato   │
│ • contactStore.ts             │     │ • SimuladorLotes (Alocação Dinâmica)  │
└───────────────────────────────┘     └───────────────────────────────────────┘
```

### Novos Modelos de Dados (`src/types/index.ts`)
1. **`CronogramaEtapa`**: `id`, `concurso_id`, `cargo_id?`, `titulo`, `data_prevista`, `data_realizada?`, `status` (*pendente*, *em_andamento*, *concluida*), `link_edital?`.
2. **`QuadroVagas`**: `concurso_id`, `cargo_id`, `vagas_ocupadas`, `vagas_reais`, `cargos_criados`, `previsao_nomeacao_ano`.
3. **`DocumentoConcurso`**: `id`, `concurso_id`, `titulo`, `tipo` (*Edital*, *Retificacao*, *Decisao*, *Resultado*), `data_publicacao`, `url_ou_conteudo`.
4. **`ComunicadoConcurso`**: `id`, `concurso_id`, `titulo`, `resumo`, `texto_completo`, `autor`, `data`, `importante`.
5. **`PerfilAuditRequest`**: `id`, `usuario_email`, `candidato_cpf`, `data_solicitacao`, `status` (*pendente*, *aprovado*, *rejeitado*), `alteracoes: { campo, valor_antigo, valor_novo }[]`.
6. **`SolicitacaoVinculacao`**: `id`, `usuario_email`, `nome_completo`, `cpf`, `concurso_id`, `cargo_id`, `posicao_declarada`, `status`.
7. **`MensagemContatoAdmin`**: `id`, `usuario_email`, `nome`, `motivo`, `concurso_nome?`, `cargo_nome?`, `classificacao?`, `mensagem`, `data`, `status` (*aberto*, *respondido*, *arquivado*).
8. **`MensagemPrivada` & `BloqueioUsuario`**: `remetente_email`, `destinatario_email`, `texto`, `data_hora`, `lida`.

---

## 5. Roteiro de Execução Passo a Passo

1. **Expansão de Tipos & Modelos (`src/types/index.ts`)**:
   - Adicionar tipagens de Cronograma, Quadro de Vagas, Documentos, Comunicados, Auditoria de Perfil, Mensagens Privadas e Contato do Admin.
2. **Estruturação de Dados com TJRS e MPRS (`src/store/certamStore.ts` & `src/data/`)**:
   - Cadastrar o **TJRS** com os três cargos solicitados (*Analista Judiciário - Área Judiciária*, *Analista Judiciário - Área Administrativa* e *Técnico Judiciário - Área Administrativo-Judiciária*).
   - Cadastrar o **MPRS** com os dois cargos solicitados (*Analista do Ministério Público* e *Técnico do Ministério Público*).
   - Inserir cronogramas reais, quadros de vagas e candidatos na Master List de classificação para teste dos cruzamentos.
3. **Mecanismo de Verificação & Master List**:
   - Atualizar a autenticação para cruzar Nome Completo e CPF com a Master List dos cargos.
   - Implementar o botão "Não fui identificado automaticamente? Solicitar validação ao Administrador".
4. **Gating de Chat (Público vs. Homologado)**:
   - Chat aberto a todos enquanto o status do concurso for diferente de `Homologado`.
   - Bloqueio inteligente pós-homologação: somente candidatos vinculados e validados têm permissão de envio e leitura das preferências.
5. **Painel do Concurso & Cargo com Novas Abas**:
   - Timeline oficial com visualização cronológica interativa.
   - Tabela de documentos com links de download.
   - Quadro de vagas ocupadas vs. cargos vagos reais com cálculo de reposição.
   - Mural de comunicados oficiais e mobilização dos aprovados.
6. **Auditoria de Perfil no Painel do Candidato e Admin**:
   - Modal de edição que exibe diff e submete ao admin em vez de salvar diretamente.
   - Aba no painel admin para aprovação em 1 clique das alterações de perfil.
7. **Central de Mensagens Privadas (1-a-1) & Bloqueios**:
   - Drawer de mensagens diretas entre candidatos aprovados com bloqueio/silenciamento.
8. **Central de Notificações Internas Otimizada**:
   - Sininho no topo com contador de não-lidas baseado em `read_notification_ids`.
9. **Formulário de Contato com o Administrador**:
   - Formulário com motivos configurados + caixa de entrada para despacho no Admin.
10. **Validação & Compilação**:
    - Verificação via `lint_applet` e `compile_applet`.
