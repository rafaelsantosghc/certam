-- =====================================================================
-- SCRIPT COMPLETO DE CONFIGURAÇÃO, LIMPEZA DE CONFLITOS E MIGRAÇÃO: SUPABASE POSTGRESQL
-- CERTAM - Portal de Acompanhamento de Concursos Públicos (Vercel + Supabase)
-- =====================================================================
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Abra o painel do seu projeto no Supabase (https://supabase.com/dashboard).
-- 2. No menu lateral esquerdo, clique em "SQL Editor".
-- 3. Clique em "+ New query", cole TODO este script abaixo e clique em "RUN".
-- =====================================================================

-- 1. CRIAÇÃO E ATUALIZAÇÃO DAS TABELAS ESSENCIAIS
CREATE TABLE IF NOT EXISTS public.concursos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    cargo TEXT DEFAULT '',
    orgao TEXT DEFAULT 'TJRS',
    ativo BOOLEAN DEFAULT true,
    dados_completos JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.concursos ADD COLUMN IF NOT EXISTS dados_completos JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.concursos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.lotes (
    id TEXT NOT NULL,
    concurso_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    ativo BOOLEAN DEFAULT false,
    is_ranking_visible BOOLEAN DEFAULT true,
    is_printing_enabled BOOLEAN DEFAULT true,
    travado BOOLEAN DEFAULT false,
    senha TEXT DEFAULT '',
    comarcas JSONB DEFAULT '[]'::jsonb,
    candidatos JSONB DEFAULT '[]'::jsonb,
    dados_completos JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, concurso_id)
);

-- Remove a Foreign Key restritiva legada (lotes_concurso_id_fkey) que impedia salvar lotes
-- de novos concursos ou cargos vinculados via configuracoes
ALTER TABLE public.lotes DROP CONSTRAINT IF EXISTS lotes_concurso_id_fkey;
ALTER TABLE public.lotes ADD COLUMN IF NOT EXISTS dados_completos JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.lotes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.respostas (
    id TEXT PRIMARY KEY,
    concurso_id TEXT DEFAULT 'tjrs_2025',
    lote_id TEXT NOT NULL,
    ambiente TEXT DEFAULT 'prod',
    nome TEXT NOT NULL,
    cpf TEXT DEFAULT '',
    email TEXT DEFAULT '',
    whatsapp TEXT DEFAULT '',
    intencao TEXT DEFAULT 'assumir',
    escolhas JSONB DEFAULT '[]'::jsonb,
    possui_fg_cc TEXT DEFAULT 'Não',
    fg_cc_registro_funcional TEXT DEFAULT '',
    fg_cc_cargo TEXT DEFAULT '',
    fg_cc_comarca_atual TEXT DEFAULT '',
    fg_cc_pretende_continuar TEXT DEFAULT '',
    bloqueado BOOLEAN DEFAULT true,
    dados_cadastrais_bloqueados BOOLEAN DEFAULT true,
    dados_completos JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuracoes (
    chave TEXT PRIMARY KEY,
    valor JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comarcas_tjrs (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    regiao TEXT DEFAULT 'RS',
    ativo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.candidatos_base (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    cpf TEXT DEFAULT '',
    email TEXT DEFAULT '',
    whatsapp TEXT DEFAULT '',
    tipo TEXT DEFAULT 'PF',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- 2. LIMPEZA DE CONFLITOS E MIGRAÇÃO AUTOMÁTICA DE CHAVES NA TABELA configuracoes
-- =====================================================================

-- 2.1 Migra concursos de chaves legadas (certam_concursos_cargos ou _v1.._v5) para certam_concursos_cargos_v6
DO $$
DECLARE
    legacy_val JSONB;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.configuracoes
        WHERE chave = 'certam_concursos_cargos_v6'
          AND jsonb_typeof(valor) = 'array'
          AND jsonb_array_length(valor) > 0
    ) THEN
        SELECT valor INTO legacy_val
        FROM public.configuracoes
        WHERE chave IN (
            'certam_concursos_cargos_v5',
            'certam_concursos_cargos_v4',
            'certam_concursos_cargos_v3',
            'certam_concursos_cargos_v2',
            'certam_concursos_cargos_v1',
            'certam_concursos_cargos'
        )
        AND valor IS NOT NULL
        AND valor::text NOT IN ('[]', '{}', '""', 'null')
        ORDER BY updated_at DESC
        LIMIT 1;

        IF legacy_val IS NOT NULL THEN
            INSERT INTO public.configuracoes (chave, valor, updated_at)
            VALUES ('certam_concursos_cargos_v6', legacy_val, now())
            ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
        END IF;
    END IF;
END $$;

-- 2.2 Migra lotes de chaves legadas para certam_lotes_data_v6
DO $$
DECLARE
    legacy_val JSONB;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.configuracoes
        WHERE chave = 'certam_lotes_data_v6'
          AND valor::text NOT IN ('[]', '{}', '""', 'null')
    ) THEN
        SELECT valor INTO legacy_val
        FROM public.configuracoes
        WHERE chave IN (
            'certam_lotes_data_v5',
            'certam_lotes_data_v4',
            'certam_lotes_data_v3',
            'certam_lotes_data_v2',
            'certam_lotes_data_v1',
            'certam_lotes_data'
        )
        AND valor IS NOT NULL
        AND valor::text NOT IN ('[]', '{}', '""', 'null')
        ORDER BY updated_at DESC
        LIMIT 1;

        IF legacy_val IS NOT NULL THEN
            INSERT INTO public.configuracoes (chave, valor, updated_at)
            VALUES ('certam_lotes_data_v6', legacy_val, now())
            ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
        END IF;
    END IF;
END $$;

-- 2.3 Migra auditorias, vinculações, contatos, notificações e usuários legados
INSERT INTO public.configuracoes (chave, valor, updated_at)
SELECT 'certam_perfil_audit_requests_v5', valor, now()
FROM public.configuracoes
WHERE chave = 'certam_perfil_audit_requests_v4'
  AND NOT EXISTS (SELECT 1 FROM public.configuracoes WHERE chave = 'certam_perfil_audit_requests_v5')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.configuracoes (chave, valor, updated_at)
SELECT 'certam_vinculacao_requests_v5', valor, now()
FROM public.configuracoes
WHERE chave = 'certam_vinculacao_requests_v4'
  AND NOT EXISTS (SELECT 1 FROM public.configuracoes WHERE chave = 'certam_vinculacao_requests_v5')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.configuracoes (chave, valor, updated_at)
SELECT 'certam_contact_messages_v5', valor, now()
FROM public.configuracoes
WHERE chave = 'certam_contact_messages_v4'
  AND NOT EXISTS (SELECT 1 FROM public.configuracoes WHERE chave = 'certam_contact_messages_v5')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.configuracoes (chave, valor, updated_at)
SELECT 'certam_notifications_events_v5', valor, now()
FROM public.configuracoes
WHERE chave IN ('certam_notifications_events_v4', 'certam_notifications_events_v3')
  AND NOT EXISTS (SELECT 1 FROM public.configuracoes WHERE chave = 'certam_notifications_events_v5')
ORDER BY updated_at DESC
LIMIT 1
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.configuracoes (chave, valor, updated_at)
SELECT 'certam_users_registry_v2', valor, now()
FROM public.configuracoes
WHERE chave = 'certam_users_registry_v1'
  AND NOT EXISTS (SELECT 1 FROM public.configuracoes WHERE chave = 'certam_users_registry_v2')
ON CONFLICT (chave) DO NOTHING;

-- 2.4 Remove chaves obsoletas/conflitantes da tabela configuracoes
DELETE FROM public.configuracoes
WHERE chave IN (
    '_test_ping',
    'certam_concursos_cargos',
    'certam_concursos_cargos_v1',
    'certam_concursos_cargos_v2',
    'certam_concursos_cargos_v3',
    'certam_concursos_cargos_v4',
    'certam_concursos_cargos_v5',
    'certam_lotes_data',
    'certam_lotes_data_v1',
    'certam_lotes_data_v2',
    'certam_lotes_data_v3',
    'certam_lotes_data_v4',
    'certam_lotes_data_v5',
    'certam_users_registry_v1',
    'certam_perfil_audit_requests_v4',
    'certam_vinculacao_requests_v4',
    'certam_contact_messages_v4',
    'certam_notifications_events_v3',
    'certam_notifications_events_v4',
    'certam_faq_items_v1',
    'certam_faq_items_v2',
    'certam_faq_items_v3',
    'certam_faq_items_v4',
    'certam_faq_items_v5'
)
OR chave LIKE 'certam_candidatos_data_v1_%'
OR chave LIKE 'certam_candidatos_data_v2_%'
OR chave LIKE 'certam_candidatos_data_v3_%'
OR chave LIKE 'certam_candidatos_data_v4_%'
OR chave LIKE 'certam_candidatos_data_v5_%';

-- 2.5 Remove o registro legado 'tjrs_analista_2024' de public.concursos caso conflite com a estrutura multi-cargo
DELETE FROM public.concursos WHERE id = 'tjrs_analista_2024';

-- =====================================================================
-- 3. HABILITAÇÃO DO ROW LEVEL SECURITY (RLS) COM POLÍTICAS PERMISSIVAS
-- Garante que o site consiga ler e gravar todas as tabelas sem erro 42501!
-- =====================================================================

ALTER TABLE public.concursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comarcas_tjrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatos_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "concursos_leitura_publica" ON public.concursos;
CREATE POLICY "concursos_leitura_publica" ON public.concursos FOR SELECT USING (true);
DROP POLICY IF EXISTS "concursos_escrita_publica" ON public.concursos;
CREATE POLICY "concursos_escrita_publica" ON public.concursos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lotes_leitura_publica" ON public.lotes;
CREATE POLICY "lotes_leitura_publica" ON public.lotes FOR SELECT USING (true);
DROP POLICY IF EXISTS "lotes_escrita_publica" ON public.lotes;
CREATE POLICY "lotes_escrita_publica" ON public.lotes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "respostas_leitura_publica" ON public.respostas;
CREATE POLICY "respostas_leitura_publica" ON public.respostas FOR SELECT USING (true);
DROP POLICY IF EXISTS "respostas_escrita_publica" ON public.respostas;
CREATE POLICY "respostas_escrita_publica" ON public.respostas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "configuracoes_leitura_publica" ON public.configuracoes;
CREATE POLICY "configuracoes_leitura_publica" ON public.configuracoes FOR SELECT USING (true);
DROP POLICY IF EXISTS "configuracoes_escrita_publica" ON public.configuracoes;
CREATE POLICY "configuracoes_escrita_publica" ON public.configuracoes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "comarcas_tjrs_leitura_publica" ON public.comarcas_tjrs;
CREATE POLICY "comarcas_tjrs_leitura_publica" ON public.comarcas_tjrs FOR SELECT USING (true);
DROP POLICY IF EXISTS "comarcas_tjrs_escrita_publica" ON public.comarcas_tjrs;
CREATE POLICY "comarcas_tjrs_escrita_publica" ON public.comarcas_tjrs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "candidatos_base_leitura_publica" ON public.candidatos_base;
CREATE POLICY "candidatos_base_leitura_publica" ON public.candidatos_base FOR SELECT USING (true);
DROP POLICY IF EXISTS "candidatos_base_escrita_publica" ON public.candidatos_base;
CREATE POLICY "candidatos_base_escrita_publica" ON public.candidatos_base FOR ALL USING (true) WITH CHECK (true);

-- Recarrega o cache de schema do PostgREST no Supabase
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM DO SCRIPT
-- =====================================================================

