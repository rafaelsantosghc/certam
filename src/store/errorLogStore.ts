import { cloudSync } from './cloudSync';

export interface ErrorLogEntry {
  id: string;
  user_id?: string;
  usuario_id?: string;
  usuario_cpf?: string;
  timestamp: string;
  carimbo_tempo: string;
  created_at: string;
  data_hora: string;
  origem: 'ErrorBoundary' | 'RuntimeException' | 'UnhandledRejection' | 'TesteManual' | 'TesteAdmin';
  error_message: string;
  mensagem: string;
  stack?: string;
  stack_trace?: string;
  component_stack?: string;
  url: string;
  user_agent: string;
  usuario_email?: string;
  usuario_nome?: string;
  resolvido?: boolean;
  enviado_supabase_tabela?: boolean;
  tabela_supabase?: 'system_logs' | 'error_logs';
  updated_at_ms?: number;
}

const STORAGE_KEY = 'certam_error_logs_v1';
const PRIMARY_SUPABASE_TABLE = 'system_logs';
const FALLBACK_SUPABASE_TABLE = 'error_logs';
const MAX_LOGS = 100;

let listenersInitialized = false;

function getCurrentUserSnapshot(): { id?: string; cpf?: string; email?: string; nome?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('certam_auth_user_v8');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      id: parsed?.id || parsed?.candidato_id || undefined,
      cpf: parsed?.cpf || undefined,
      email: parsed?.email || undefined,
      nome: parsed?.nome || undefined,
    };
  } catch {
    return {};
  }
}

function getSupabaseHeaders(anonKey: string, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function insertIntoSupabaseTable(entry: ErrorLogEntry): Promise<{ ok: boolean; table?: 'system_logs' | 'error_logs' }> {
  const cfg = cloudSync.getSupabaseConfig();
  if (!cfg) return { ok: false };

  // Payload completo contendo todas as variações de campos para suportar estritamente system_logs e fallback error_logs
  const userIdVal = entry.user_id || entry.usuario_cpf || entry.usuario_id || 'anonimo';
  const isoDate = entry.created_at || new Date().toISOString();

  // Tentativa primária: tabela 'system_logs' conforme especificação
  try {
    const systemLogsPayload = {
      id: entry.id,
      user_id: userIdVal,
      usuario_id: userIdVal,
      usuario_cpf: entry.usuario_cpf || null,
      timestamp: isoDate,
      carimbo_tempo: isoDate,
      created_at: isoDate,
      error_message: entry.error_message || entry.mensagem,
      mensagem: entry.mensagem || entry.error_message,
      component_stack: entry.component_stack || null,
      stack_trace: entry.stack_trace || entry.stack || null,
      stack: entry.stack || null,
      origem: entry.origem,
      url: entry.url,
      user_agent: entry.user_agent,
      usuario_email: entry.usuario_email || null,
      usuario_nome: entry.usuario_nome || null,
      resolvido: Boolean(entry.resolvido),
    };

    const res = await fetch(`${cfg.url}/rest/v1/${PRIMARY_SUPABASE_TABLE}`, {
      method: 'POST',
      headers: getSupabaseHeaders(cfg.anonKey, {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(systemLogsPayload),
    });

    if (res.ok) {
      return { ok: true, table: 'system_logs' };
    }

    // Se retornar 404 (tabela system_logs ainda não criada no Supabase), tenta fallback em error_logs
    if (res.status === 404) {
      const fallbackPayload = {
        id: entry.id,
        created_at: isoDate,
        origem: entry.origem,
        mensagem: entry.mensagem,
        stack: entry.stack || null,
        component_stack: entry.component_stack || null,
        url: entry.url,
        user_agent: entry.user_agent,
        usuario_email: entry.usuario_email || null,
        usuario_nome: entry.usuario_nome || null,
        resolvido: Boolean(entry.resolvido),
      };

      const fallbackRes = await fetch(`${cfg.url}/rest/v1/${FALLBACK_SUPABASE_TABLE}`, {
        method: 'POST',
        headers: getSupabaseHeaders(cfg.anonKey, {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(fallbackPayload),
      });

      if (fallbackRes.ok) {
        return { ok: true, table: 'error_logs' };
      }
    }

    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export const errorLogStore = {
  getLogs(): ErrorLogEntry[] {
    try {
      const raw = cloudSync.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  },

  saveLogs(logs: ErrorLogEntry[], forceReplace = false): void {
    const trimmed = logs.slice(0, MAX_LOGS);
    cloudSync.setItem(STORAGE_KEY, trimmed, forceReplace);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('certam_error_logs_updated'));
    }
  },

  async logError(params: {
    error: Error | unknown;
    componentStack?: string | null;
    origem?: ErrorLogEntry['origem'];
    userId?: string;
  }): Promise<ErrorLogEntry> {
    const errObj =
      params.error instanceof Error
        ? params.error
        : new Error(typeof params.error === 'string' ? params.error : JSON.stringify(params.error));

    const now = new Date();
    const isoDate = now.toISOString();
    const user = getCurrentUserSnapshot();
    const effectiveUserId = params.userId || user.cpf || user.id || user.email || 'anonimo';

    const entry: ErrorLogEntry = {
      id: `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: effectiveUserId,
      usuario_id: effectiveUserId,
      usuario_cpf: user.cpf,
      timestamp: isoDate,
      carimbo_tempo: isoDate,
      created_at: isoDate,
      data_hora: `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`,
      origem: params.origem || 'ErrorBoundary',
      error_message: errObj.message || 'Erro inesperado capturado na aplicação',
      mensagem: errObj.message || 'Erro inesperado capturado na aplicação',
      stack: errObj.stack || undefined,
      stack_trace: errObj.stack || undefined,
      component_stack: params.componentStack ? String(params.componentStack).trim() : undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      usuario_email: user.email,
      usuario_nome: user.nome,
      resolvido: false,
      enviado_supabase_tabela: false,
      updated_at_ms: Date.now(),
    };

    // 1. Salva imediatamente no store local e sincroniza via cloudSync
    const atuais = this.getLogs();
    const novaLista = [entry, ...atuais].slice(0, MAX_LOGS);
    this.saveLogs(novaLista);

    // 2. Envia diretamente para a tabela 'system_logs' no Supabase
    const { ok: enviadoTabela, table } = await insertIntoSupabaseTable(entry);
    if (enviadoTabela) {
      const atualizados = this.getLogs().map((item) =>
        item.id === entry.id
          ? { ...item, enviado_supabase_tabela: true, tabela_supabase: table, updated_at_ms: Date.now() }
          : item
      );
      this.saveLogs(atualizados);
      entry.enviado_supabase_tabela = true;
      entry.tabela_supabase = table;
    }

    return entry;
  },

  async fetchFromSupabaseTable(): Promise<{
    tableExists: boolean;
    activeTable: 'system_logs' | 'error_logs' | null;
    logs: ErrorLogEntry[];
    error?: string;
  }> {
    const cfg = cloudSync.getSupabaseConfig();
    if (!cfg) {
      return { tableExists: false, activeTable: null, logs: this.getLogs() };
    }

    // 1. Tenta buscar da tabela principal 'system_logs'
    try {
      const resPrimary = await fetch(
        `${cfg.url}/rest/v1/${PRIMARY_SUPABASE_TABLE}?select=*&order=created_at.desc&limit=100`,
        {
          method: 'GET',
          headers: getSupabaseHeaders(cfg.anonKey),
          cache: 'no-store',
        }
      );

      if (resPrimary.ok) {
        const rows = await resPrimary.json();
        if (Array.isArray(rows)) {
          const tableLogs: ErrorLogEntry[] = rows.map((r: any) => {
            const dt = r.carimbo_tempo || r.timestamp || r.created_at ? new Date(r.carimbo_tempo || r.timestamp || r.created_at) : new Date();
            const msg = r.error_message || r.mensagem || 'Erro registrado';
            const userId = r.user_id || r.usuario_id || r.usuario_cpf || 'anonimo';
            return {
              id: String(r.id || `err-${dt.getTime()}`),
              user_id: userId,
              usuario_id: userId,
              usuario_cpf: r.usuario_cpf || (userId.includes('.') ? userId : undefined),
              timestamp: r.timestamp || r.created_at || dt.toISOString(),
              carimbo_tempo: r.carimbo_tempo || r.timestamp || r.created_at || dt.toISOString(),
              created_at: r.created_at || dt.toISOString(),
              data_hora: `${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}`,
              origem: r.origem || 'ErrorBoundary',
              error_message: msg,
              mensagem: msg,
              stack: r.stack || r.stack_trace || undefined,
              stack_trace: r.stack_trace || r.stack || undefined,
              component_stack: r.component_stack || undefined,
              url: r.url || '',
              user_agent: r.user_agent || '',
              usuario_email: r.usuario_email || undefined,
              usuario_nome: r.usuario_nome || undefined,
              resolvido: Boolean(r.resolvido),
              enviado_supabase_tabela: true,
              tabela_supabase: 'system_logs',
              updated_at_ms: dt.getTime(),
            };
          });

          const map = new Map<string, ErrorLogEntry>();
          tableLogs.forEach((item) => map.set(item.id, item));
          this.getLogs().forEach((localItem) => {
            if (!map.has(localItem.id)) {
              map.set(localItem.id, localItem);
            }
          });

          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          this.saveLogs(merged);

          return {
            tableExists: true,
            activeTable: 'system_logs',
            logs: merged,
          };
        }
      }

      // Se não encontrou a tabela system_logs (404), tenta na tabela legado error_logs
      if (resPrimary.status === 404) {
        const resFallback = await fetch(
          `${cfg.url}/rest/v1/${FALLBACK_SUPABASE_TABLE}?select=*&order=created_at.desc&limit=100`,
          {
            method: 'GET',
            headers: getSupabaseHeaders(cfg.anonKey),
            cache: 'no-store',
          }
        );

        if (resFallback.ok) {
          const rows = await resFallback.json();
          if (Array.isArray(rows)) {
            const tableLogs: ErrorLogEntry[] = rows.map((r: any) => {
              const dt = r.created_at ? new Date(r.created_at) : new Date();
              const msg = r.mensagem || 'Erro registrado';
              return {
                id: String(r.id || `err-${dt.getTime()}`),
                user_id: r.usuario_email || 'anonimo',
                usuario_id: r.usuario_email || 'anonimo',
                timestamp: r.created_at || dt.toISOString(),
                carimbo_tempo: r.created_at || dt.toISOString(),
                created_at: r.created_at || dt.toISOString(),
                data_hora: `${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}`,
                origem: r.origem || 'ErrorBoundary',
                error_message: msg,
                mensagem: msg,
                stack: r.stack || undefined,
                component_stack: r.component_stack || undefined,
                url: r.url || '',
                user_agent: r.user_agent || '',
                usuario_email: r.usuario_email || undefined,
                usuario_nome: r.usuario_nome || undefined,
                resolvido: Boolean(r.resolvido),
                enviado_supabase_tabela: true,
                tabela_supabase: 'error_logs',
                updated_at_ms: dt.getTime(),
              };
            });

            const map = new Map<string, ErrorLogEntry>();
            tableLogs.forEach((item) => map.set(item.id, item));
            this.getLogs().forEach((localItem) => {
              if (!map.has(localItem.id)) {
                map.set(localItem.id, localItem);
              }
            });

            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            this.saveLogs(merged);

            return {
              tableExists: true,
              activeTable: 'error_logs',
              logs: merged,
            };
          }
        }

        return {
          tableExists: false,
          activeTable: null,
          logs: this.getLogs(),
          error: 'Tabela public.system_logs ainda não criada no SQL Editor do Supabase.',
        };
      }

      const errTxt = await resPrimary.text().catch(() => `HTTP ${resPrimary.status}`);
      return {
        tableExists: false,
        activeTable: null,
        logs: this.getLogs(),
        error: `HTTP ${resPrimary.status}: ${errTxt.slice(0, 140)}`,
      };
    } catch (e: any) {
      return {
        tableExists: false,
        activeTable: null,
        logs: this.getLogs(),
        error: e?.message || 'Erro de rede ao consultar public.system_logs no Supabase',
      };
    }
  },

  async marcarComoResolvido(id: string, resolvido?: boolean): Promise<void> {
    const lista = this.getLogs().map((item) =>
      item.id === id
        ? { ...item, resolvido: resolvido !== undefined ? resolvido : !item.resolvido, updated_at_ms: Date.now() }
        : item
    );
    this.saveLogs(lista, true);

    const alvo = lista.find((i) => i.id === id);
    const cfg = cloudSync.getSupabaseConfig();
    if (cfg && alvo) {
      const targetTable = alvo.tabela_supabase || PRIMARY_SUPABASE_TABLE;
      try {
        await fetch(`${cfg.url}/rest/v1/${targetTable}?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: getSupabaseHeaders(cfg.anonKey),
          body: JSON.stringify({ resolvido: Boolean(alvo.resolvido) }),
        });
      } catch {
        // ignore
      }
    }
  },

  async excluirLog(id: string): Promise<void> {
    const alvo = this.getLogs().find((i) => i.id === id);
    const lista = this.getLogs().filter((item) => item.id !== id);
    this.saveLogs(lista, true);

    const cfg = cloudSync.getSupabaseConfig();
    if (cfg) {
      const targetTable = alvo?.tabela_supabase || PRIMARY_SUPABASE_TABLE;
      try {
        await fetch(`${cfg.url}/rest/v1/${targetTable}?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getSupabaseHeaders(cfg.anonKey),
        });
      } catch {
        // ignore
      }
    }
  },

  async limparTodosLogs(): Promise<void> {
    this.saveLogs([], true);
    const cfg = cloudSync.getSupabaseConfig();
    if (cfg) {
      try {
        await fetch(`${cfg.url}/rest/v1/${PRIMARY_SUPABASE_TABLE}?id=not.is.null`, {
          method: 'DELETE',
          headers: getSupabaseHeaders(cfg.anonKey),
        });
        await fetch(`${cfg.url}/rest/v1/${FALLBACK_SUPABASE_TABLE}?id=not.is.null`, {
          method: 'DELETE',
          headers: getSupabaseHeaders(cfg.anonKey),
        });
      } catch {
        // ignore
      }
    }
  },

  getSqlCreateTableScript(): string {
    return `-- Execute no SQL Editor do Supabase para criar a tabela dedicada 'system_logs' do ErrorBoundary:
CREATE TABLE IF NOT EXISTS public.system_logs (
  id text PRIMARY KEY,
  user_id text,
  usuario_id text,
  usuario_cpf text,
  carimbo_tempo timestamptz DEFAULT now(),
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  error_message text NOT NULL,
  mensagem text,
  component_stack text,
  stack_trace text,
  stack text,
  origem text NOT NULL DEFAULT 'ErrorBoundary',
  url text,
  user_agent text,
  usuario_email text,
  usuario_nome text,
  resolvido boolean DEFAULT false
);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir insercao e leitura de system_logs" ON public.system_logs;
CREATE POLICY "Permitir insercao e leitura de system_logs"
  ON public.system_logs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);`;
  },

  initGlobalListeners(): void {
    if (listenersInitialized || typeof window === 'undefined') return;
    listenersInitialized = true;

    window.addEventListener('error', (event) => {
      const msg = String(event.message || '');
      if (msg.includes('ResizeObserver') || msg.includes('WebSocket')) return;
      void this.logError({
        error: event.error || new Error(msg || 'Runtime Error'),
        origem: 'RuntimeException',
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reasonStr = String(event.reason?.message || event.reason || '');
      if (reasonStr.includes('WebSocket')) return;
      void this.logError({
        error: event.reason instanceof Error ? event.reason : new Error(reasonStr || 'Unhandled Rejection'),
        origem: 'UnhandledRejection',
      });
    });
  },
};
