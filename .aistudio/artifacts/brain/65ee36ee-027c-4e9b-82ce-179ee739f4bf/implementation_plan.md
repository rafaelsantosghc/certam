# Plano de Implementação — Sistema Certam (18 Melhorias Integradas)

Plano detalhado para a implementação das 18 solicitações do usuário em uma única atualização coesa, otimizando consumo de recursos e garantindo integridade arquitetural do sistema.

---

## Decisões Confirmadas com o Usuário

> [!IMPORTANT]
> **Decisões Alinhadas:**
> 1. **Execução Unificada**: Todas as 18 melhorias serão implementadas em uma única grande entrega coordenada e verificada por compilação completa.
> 2. **Cadastro Geral e Importação de Candidatos**: Candidatos importados por planilha serão inseridos no Cadastro Geral como **perfis vinculáveis** (armazenando CPF e nome completo), prontos para reivindicação quando o candidato realizar seu cadastro/login.
> 3. **Substituição de Comarca por Lotação**: O termo principal do sistema passa a ser **Lotação**, acompanhado de uma nova configuração no cadastro/edição do concurso permitindo ao administrador especificar o subtipo institucional (*Comarca*, *Região*, *Cidade*, *Estado*, *Unidade* ou *Setor*), além de uma lista mestra de lotações do concurso.

---

## 1. Visão Geral das 18 Melhorias

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                          SISTEMA CERTAM — ATUALIZAÇÃO 18 ITENS                  │
├───────────────────┬──────────────────────────┬─────────────────────────────────┤
│ A. Acesso & Perfil│ B. Concursos & Lotações  │ C. Listas, Cotas & Lotes        │
│ • "Meus Concursos"│ • Config. Lotação        │ • Múltiplas Cotas (PCD+PPP etc.)│
│   filtrado real   │   (Comarca/Região/etc.)  │ • Status sem previsão ajustado  │
│ • "Acompanhados"  │ • Catálogo de Lotações   │ • Lotação Definitiva vs Escolhas│
│ • Painel Admin    │ • Visibilidade pública   │ • Página exclusiva do Lote      │
│   Geral de Users  │ • Linha do tempo inversa │ • Paginação topo/base + seletor │
│ • Slogan e botões │   + Edição Admin         │ • Importador com mapeamento     │
└───────────────────┴──────────────────────────┴─────────────────────────────────┘
```

---

## 2. Detalhamento por Área de Atuação

### A. Gestão de Candidato, Acesso & Painel Administrativo Geral (Itens 1, 2, 4, 5, 7, 18)

1. **Item 1 — Concursos em Andamento vs Concursos Acompanhados**:
   - Ajustar a lógica de "Meus Concursos em Andamento": só exibir concursos onde o candidato logado possui inscrição/aprovação ativa (cruzando CPF ou nome com a lista de candidatos).
   - Criar a nova seção **"Concursos que estou acompanhando"** na tela inicial do candidato.
   - Adicionar botões **"Acompanhar Concurso"** e **"Deixar de Acompanhar"** com status e sininho de notificação no cabeçalho do concurso, persistindo no perfil do usuário (`usuario.concursos_acompanhados: string[]`).

2. **Item 2 — Auditoria e Solicitações de Cadastro Chegando ao Painel Admin**:
   - Diagnosticar o fluxo de solicitação de vinculação/alteração (`solicitacoesVinculacaoStore` e `certamStore.getSolicitacoes()`).
   - Garantir que as solicitações de alteração de cadastro emitidas pelo usuário comum sejam gravadas no armazenamento compartilhado com status `pendente` e renderizadas com contador de pendências no painel de administração e na gaveta de moderação.

3. **Item 4 — Ícone de Feedback de Erro na Escolha de Comarca/Lotação**:
   - Substituir o ícone de sucesso (Check) pelo ícone correto de erro (`AlertCircle` ou `XCircle` vermelho) nos toasts e modais quando um candidato não autorizado tenta manifestar preferência.

4. **Item 5 — Visibilidade Pública dos Concursos Criados pelo Admin**:
   - Assegurar que os concursos criados ou alterados no `certamStore` sejam salvos no `localStorage` sob chave unificada de dados públicos, garantindo que qualquer usuário (logado como candidato ou visitante) visualize os novos concursos e seus cargos.

5. **Item 7 — Slogan e Ajuste Textual**:
   - Atualizar o slogan no cabeçalho/hero para: **"Nunca é só uma prova."**
   - No botão de edição de cadastro, remover o sufixo `(auditado)` para ficar apenas **"Editar Cadastro"** ou **"Editar Perfil"**.

6. **Item 18 — Painel Central de Cadastro de Usuários & Integração com Planilhas**:
   - Criar visualização de **Gestão Geral de Cadastros** no painel administrativo:
     - Listagem de todos os usuários cadastrados e perfis vinculáveis.
     - Ações: Editar dados, Bloquear/Desbloquear acesso, Alterar papel (Admin/Candidato/Convidado), Excluir usuário.
   - Integração com a importação: ao importar lista de aprovados de uma planilha, verificar automaticamente por CPF ou Nome completo se o candidato já existe; caso não exista, criar registro prévio no cadastro geral com status `"Aguardando Vinculação"`.

---

### B. Concurso, Linha do Tempo & Sistema Dinâmico de Lotações (Itens 3, 10, 14, 16, 17)

1. **Item 3 — Linha do Tempo Invertida e Edição pelo Administrador**:
   - Inverter a ordenação de `cronograma`: eventos mais recentes no topo, mais antigos abaixo.
   - Adicionar botão **"Editar Cronograma / Linha do Tempo"** visível apenas para administradores, permitindo adicionar novos eventos, editar datas, títulos e status.

2. **Item 10 — Redirecionamento Correto do Menu Lateral**:
   - Ao clicar em um cargo no menu lateral esquerdo, garantir navegação direta para a aba de **Visão Geral do Cargo** (`abaAtiva = 'dashboard'`) em vez de abrir documentos oficiais.

3. **Item 14 — Cabeçalho Fixo/Compacto nas Páginas Principais**:
   - Implementar cabeçalho com classe `sticky top-0 z-30` no dashboard do concurso/cargo:
   - Quando o usuário rolar a página para baixo, o cabeçalho se torna compacto, condensando ações secundárias em dropdown para preservar área útil de leitura.

4. **Item 16 — Separação: Lotação Definitiva vs Preferências do Candidato**:
   - Na tabela de classificação:
     - Coluna **"Lotação Definitiva"**: exibe estritamente a lotação atribuída após a consolidação oficial do lote (`comarca_definitiva` ou `comarca_escolhida`).
     - Coluna **"Preferências do Candidato"**: exibe as opções declaradas pelo candidato antes da convocação (`escolhas_comarcas`).

5. **Item 17 — Substituição Global de "Comarca" por "Lotação" e Configuração de Subtipo**:
   - No modelo do Concurso, adicionar campo `tipo_lotacao: 'Comarca' | 'Região' | 'Cidade' | 'Estado' | 'Unidade' | 'Setor' | 'Lotação'` (com padrão 'Lotação' ou 'Comarca' conforme o órgão).
   - Adicionar gerenciador de **Catálogo de Lotações** no concurso, permitindo cadastrar e listar todas as lotações oficiais do órgão.
   - Nos lotes, permitir selecionar das lotações cadastradas ou digitar nova (inserindo-a automaticamente no catálogo do concurso).
   - Atualizar rótulos, filtros e tabelas para utilizar o termo dinâmico ou `"Lotação"`.

---

### C. Classificação, Cotas Múltiplas, Lotes e Importador (Itens 6, 8, 9, 11, 12, 13, 15)

1. **Item 6 — Acesso Restrito à Página Exclusiva do Lote**:
   - Remover botão de simulador genérico da barra superior da aba de lotes.
   - Substituir pelo botão **"Acessar Página do Lote"** dentro de cada card de lote.
   - Restringir o acesso: apenas candidatos contemplados naquele lote (titulares ou suplentes convocados) ou administradores têm permissão para acessar a tela de escolha; para os demais aprovados ou não participantes, exibir bloqueio claro de acesso.

2. **Item 8 — Reconhecimento de Candidatos em Múltiplas Cotas (ex: PCD + PPP)**:
   - Evoluir o tipo de cota para suportar múltiplas marcações (`cotas: CotaTipo[]` além de `cota: CotaTipo`), reconhecendo candidatos elegíveis simultaneamente à Ampla Concorrência, PPP/Negros e PCD/Indígena/Trans.
   - Atualizar o importador de classificação para aceitar valores combinados na coluna de cota (ex: `"PPP, PCD"`, `"Negro / PCD"`, `"PCD + Cota Racial"`).

3. **Item 9 — Simulação e Registro da Ordem de Nomeação com Múltiplas Cotas**:
   - No algoritmo de ordem de convocação (`calcularOrdemNomeacao`):
     - Um candidato com múltiplas cotas concorre na lista da Ampla e nas listas de cada uma de suas cotas reservadas.
     - Quando o candidato for convocado pela Ampla, ele libera a cota para o próximo cotista; se convocado pela cota, é baixado também na lista de ampla.
     - Registrar no histórico por qual modalidade (Ampla ou tipo de cota) a convocação ocorreu.

4. **Item 11 — Correção do Status "Próximo (previsão)" em Cargos sem Previsão de Lote**:
   - Se o cargo não possui vagas previstas para o próximo lote (`vagas_previstas_proximo_lote === 0` ou sem data de previsão cadastrada), o status dos candidatos não convocados deve ser exibido como **"Aguardando Convocação"** em vez de "Próximo (previsão)".

5. **Item 12 — Reset de Paginação ao Trocar de Cargo**:
   - No `ConcursoCargoDashboard`, ao alternar de cargo via seletor ou abas, resetar o estado `paginaAtual` para `1`.

6. **Item 13 — Paginação no Topo e Base + Seletor de Itens por Página**:
   - Replicar os controles de paginação (anterior, números de página, próximo) tanto no topo quanto no rodapé das tabelas de classificação e de ordem de nomeação.
   - Adicionar dropdown de quantidade de itens por página: `25`, `50`, `100` ou `Todos`.

7. **Item 15 — Importador Interativo de Planilhas com Mapeamento e Edição Manual**:
   - No importador de candidatos/lotes via planilha/colagem:
     - Etapa 1: Leitura e pré-visualização das colunas detectadas.
     - Etapa 2: Mapeamento interativo por seletores de coluna (definindo explicitamente qual coluna é *Ordem*, *Nome*, *Cotas*, *Data de Convocação*, *Data de Nomeação*, *Papel Titular/Suplente* e *Lotação*).
     - Etapa 3: Grid editável com células interativas para ajustes rápidos antes de confirmar a importação definitiva.

---

## 3. Arquitetura e Fluxo de Dados

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARQUITETURA DE DADOS                            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴────────────────────────┐
           ▼                                                  ▼
┌─────────────────────────────┐                    ┌─────────────────────┐
│       certamStore           │                    │     lotesStore      │
├─────────────────────────────┤                    ├─────────────────────┤
│ • Concursos, Cargos         │                    │ • Lotes de Lotações │
│ • tipo_lotacao              │                    │ • Convocados        │
│ • catalogo_lotacoes[]       │                    │ • Escolhas & Trava  │
│ • cronograma[] (ordenado)   │                    │ • data_convocacao   │
│ • usuarios[] / cadastros[]  │                    │ • data_nomeacao     │
│ • solicitacoesVinculacao[]  │                    │ • data_audiencia    │
└──────────┬──────────────────┘                    └──────────┬──────────┘
           │                                                  │
           └─────────────────────────┬────────────────────────┘
                                     ▼
                   ┌───────────────────────────────────┐
                   │    ConcursoCargoDashboard.tsx     │
                   │ • Header Sticky Compacto          │
                   │ • Visão Geral, Classificação,     │
                   │   Nomeação e Lotes Restritos      │
                   │ • Paginação Topo + Base + Seletor │
                   └───────────────────────────────────┘
```

---

## 4. Plano de Verificação e Testes

1. **Testes de Acesso e Permissões**:
   - Entrar como usuário comum: TJRS não deve aparecer em "Meus Concursos" se não estiver inscrito/aprovado; testar botão "Acompanhar Concurso" e verificar aparição na nova seção "Concursos Acompanhados".
   - Testar envio de solicitação de alteração de cadastro e verificar chegada imediata no painel admin.
2. **Testes de Lotação e Concursos**:
   - Modificar configuração do concurso para tipo de lotação (ex: "Setor" ou "Comarca") e validar propagação nos títulos e badges.
   - Conferir ordenação invertida da Linha do Tempo e edição de eventos pelo administrador.
3. **Testes de Cotas Múltiplas e Ordem de Nomeação**:
   - Cadastrar candidato com cotas PCD + PPP; verificar sua presença em ambas as listas de reserva e na Ampla; testar convocação e conferir registro da modalidade.
4. **Testes de Importador Interativo**:
   - Importar planilha com colunas invertidas; usar o mapeador de colunas para definir data de convocação vs data de nomeação; editar valores inline e confirmar importação.
5. **Verificação de Compilação**:
   - Executar `lint_applet` e `compile_applet` garantindo zero erros de tipos ou compilação.
