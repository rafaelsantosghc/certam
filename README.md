# CERTAM | Portal do Concurseiro

> *"Nunca é apenas uma prova."*

Plataforma unificada para acompanhamento oficial de concursos públicos, gestão de cargos, isolamento de rankings, simulação de escolha de comarcas/lotação em tempo real e emissão de folhas de audiência A4.

## Funcionalidades Principais

- **Portal de Concursos**: Catálogo de concursos públicos cadastrados e divisão estruturada em cargos com listas e dados isolados.
- **Dashboard do Concurso & Cargo**:
  - Métricas e KPIs em tempo real (Vagas imediatas, CR, candidatos homologados, convocados, confirmados e desistências).
  - Mapa regional interativo do Rio Grande do Sul (Norte, Serra, Centro, Metropolitana, Sul e Fronteira) com dados das comarcas polo.
  - Classificação completa com busca e filtros por cota (Ampla, PPP, PCD, Indígena), status oficial e intenção declarada.
  - Modal com detalhamento de notas por disciplina (Português, Jurídico, Informática, Específicos).
  - Chat e comunidade de candidatos em tempo real exclusivo por cargo.
- **Simulador de Lotes e Escolha de Lotação**:
  - Algoritmo de alocação de comarcas em tempo real considerando colocação, intenção e renúncias.
  - Formulário oficial de manifestação do candidato e reordenação de preferências de posse.
  - Painel de distribuição geral das vagas do lote.
  - Quadro de vagas ocupadas e disponíveis por comarca.
  - Folha de audiência pública A4 configurável em 1 a 5 colunas com círculos de marcação a caneta.
  - Exportação instantânea de planilhas Excel (.xlsx).
- **Painel Administrativo**:
  - Cadastro, edição e remoção de certames e cargos.
  - Importação de planilhas de classificação (.xlsx, .xls, .csv) via SheetJS com sincronização nos cargos.
  - Gestão de lotes, travas de manifestação e auditoria.
- **Política de Privacidade & LGPD**:
  - Conformidade com a Lei nº 13.709/2018 (LGPD).

## Tecnologias Utilizadas

- React 18 + TypeScript + Vite
- Tailwind CSS
- SheetJS (`xlsx`) para manipulação de planilhas
- Lucide React para iconografia
