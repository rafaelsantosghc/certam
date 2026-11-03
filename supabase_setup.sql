-- =====================================================================
-- SCRIPT DE LIMPEZA GERAL E PADRONIZAÇÃO EXCLUSIVA: SUPABASE POSTGRESQL
-- CERTAM - Portal de Acompanhamento de Concursos Públicos
-- =====================================================================
-- OBJETIVO DESTE SCRIPT:
-- 1. Eliminar TODAS as tabelas que pertenciam a outro site vinculado anteriormente
--    (concursos, lotes, respostas, comarcas_tjrs, candidatos_base e quaisquer outras),
--    mantendo EXCLUSIVAMENTE a tabela `public.configuracoes` utilizada pelo site atual.
-- 2. Garantir a estrutura correta de `public.configuracoes` (incluindo a coluna `updated_at`).
-- 3. Limpar todos os registros de `public.configuracoes` que vieram do outro site ou de testes
--    antigos (ex: tjrs_2024), preservando apenas os dados oficiais atuais do CERTAM (`certam_*`).
-- 4. Configurar políticas RLS de leitura e escrita pública para funcionamento 100% sem bloqueios.
--
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Abra o painel do seu projeto no Supabase (https://supabase.com/dashboard).
-- 2. No menu lateral esquerdo, clique em "SQL Editor".
-- 3. Clique em "+ New query", cole TODO este script abaixo e clique em "RUN".
-- =====================================================================

-- 1. GARANTIR QUE A TABELA OFICIAL DO SITE ATUAL (public.configuracoes) EXISTA COM A COLUNA updated_at
CREATE TABLE IF NOT EXISTS public.configuracoes (
    chave TEXT PRIMARY KEY,
    valor JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Caso a tabela public.configuracoes tenha sido criada pelo site antigo sem a coluna updated_at:
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS valor JSONB;
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. ELIMINAR TODAS AS TABELAS DO OUTRO SITE / NÃO UTILIZADAS PELO SITE ATUAL
DROP TABLE IF EXISTS public.respostas CASCADE;
DROP TABLE IF EXISTS public.lotes CASCADE;
DROP TABLE IF EXISTS public.concursos CASCADE;
DROP TABLE IF EXISTS public.comarcas_tjrs CASCADE;
DROP TABLE IF EXISTS public.candidatos_base CASCADE;

-- Remove dinamicamente qualquer outra tabela residual no schema public que não seja 'configuracoes'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> 'configuracoes'
    ) LOOP
        EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    END LOOP;
END $$;

-- =====================================================================
-- 3. MIGRAÇÃO SEGURA E LIMPEZA DE DADOS DO OUTRO SITE EM public.configuracoes
-- =====================================================================

-- 3.1 Migra concursos de chaves legadas (se existirem) para certam_concursos_cargos_v6
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
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1;

        IF legacy_val IS NOT NULL THEN
            INSERT INTO public.configuracoes (chave, valor, updated_at)
            VALUES ('certam_concursos_cargos_v6', legacy_val, now())
            ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
        END IF;
    END IF;
END $$;

-- 3.2 Migra lotes de chaves legadas para certam_lotes_data_v6
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
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1;

        IF legacy_val IS NOT NULL THEN
            INSERT INTO public.configuracoes (chave, valor, updated_at)
            VALUES ('certam_lotes_data_v6', legacy_val, now())
            ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
        END IF;
    END IF;
END $$;

-- 3.3 Migra auditorias, vinculações, contatos e usuários se estivessem em versão anterior
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

-- 3.4 ELIMINA TODOS OS DADOS CADASTRADOS PELO OUTRO SITE E CHAVES DE TESTE OBSOLETAS
DELETE FROM public.configuracoes
WHERE chave NOT LIKE 'certam_%'
   OR chave IN (
       '_test_ping',
       'certam_diag_heartbeat',
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
   OR chave LIKE 'certam_candidatos_data_v5_%'
   OR chave LIKE '%tjrs_2024%'
   OR chave LIKE '%tjrs_analista_2024%'
   OR chave LIKE '%mprs_2024%';

-- 3.5 Remove eventual concurso de teste antigo (tjrs_2024 / mprs_2024) de dentro do array JSON certam_concursos_cargos_v6
UPDATE public.configuracoes
SET valor = COALESCE(
    (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(valor) = 'array' THEN valor
                WHEN jsonb_typeof(valor) = 'string' AND (valor #>> '{}') LIKE '[%' THEN (valor #>> '{}')::jsonb
                ELSE '[]'::jsonb
            END
        ) AS elem
        WHERE lower(COALESCE(elem->>'id', '')) NOT IN ('tjrs_2024', 'tjrs_analista_2024', 'mprs_2024')
          AND NOT (upper(COALESCE(elem->>'orgao', '')) = 'TJRS' AND COALESCE(elem->>'ano', '') = '2024')
    ),
    '[]'::jsonb
),
updated_at = now()
WHERE chave = 'certam_concursos_cargos_v6';

-- =====================================================================
-- 4. PERMISSÕES E ROW LEVEL SECURITY (RLS) NA TABELA public.configuracoes
-- Garante que todos os usuários (logados ou anônimos) visualizem concursos e
-- listas de classificação e consigam enviar solicitações ao painel Admin.
-- =====================================================================

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.configuracoes TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "configuracoes_leitura_publica" ON public.configuracoes;
CREATE POLICY "configuracoes_leitura_publica"
ON public.configuracoes
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "configuracoes_escrita_publica" ON public.configuracoes;
CREATE POLICY "configuracoes_escrita_publica"
ON public.configuracoes
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Recarrega o cache de schema do PostgREST no Supabase imediatamente
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- FIM DO SCRIPT
-- =====================================================================
