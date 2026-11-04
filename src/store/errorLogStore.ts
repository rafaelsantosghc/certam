import { cloudSync } from './cloudSync';

export interface ErrorLogEntry {
  id: string;
  created_at: string;
  data_hora: string;
  origem: 'ErrorBoundary' | 'RuntimeException' | 'UnhandledRejection' | 'TesteManual' | 'TesteAdmin';
  mensagem: string;
  stack?: string;
  component_stack?: string;
  url: string;
  user_agent: string;
  usuario_email?: string;
  usuario_nome?: string;
  resolvido?: boolean;
  enviado_supabase_tabela?: boolean;
  updated_at_ms?: number;
}

const STORAGE_KEY = 'certam_error_logs_v1';
const SUPABASE_ERROR_TABLE = 'error_logs';
const MAX_LOGS = 100;

let listenersInitialized = false;

function getCurrentUserSnapshot(): { email?: string; nome?: string } {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('certam_auth_user_v8');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
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

async function insertIntoSupabaseErrorTable(entry: ErrorLogEntry): Promise<boolean> {
  const cfg = cloudSync.getSupabaseConfig();
  if (!cfg) return false;

  try {
    const rowPayload = {
      id: entry.id,
      created_at: entry.created_at,
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

    const res = await fetch(`${cfg.url}/rest/v1/${SUPABASE_ERROR_TABLE}`, {
      method: 'POST',
      headers: getSupabaseHeaders(cfg.anonKey, {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(rowPayload),
    });

    return res.ok;
  } catch {
    return false;
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
  }): Promise<ErrorLogEntry> {
    const errObj =
      params.error instanceof Error
        ? params.error
        : new Error(typeof params.error === 'string' ? params.error : JSON.stringify(params.error));

    const now = new Date();
    const user = getCurrentUserSnapshot();

    const entry: ErrorLogEntry = {
      id: `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: now.toISOString(),
      data_hora: `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`,
      origem: params.origem || 'ErrorBoundary',
      mensagem: errObj.message || 'Erro desconhecido na renderização',
      stack: errObj.stack || undefined,
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

    // 2. Envia diretamente para a tabela específica `public.error_logs` no Supabase
    const enviadoTabela = await insertIntoSupabaseErrorTable(entry);
    if (enviadoTabela) {
      const atualizados = this.getLogs().map((item) =>
        item.id === entry.id
          ? { ...item, enviado_supabase_tabela: true, updated_at_ms: Date.now() }
          : item
      );
      this.saveLogs(atualizados);
      entry.enviado_supabase_tabela = true;
    }

    return entry;
  },

  async fetchFromSupabaseTable(): Promise<{
    tableExists: boolean;
    logs: ErrorLogEntry[];
    error?: string;
  }> {
    const cfg = cloudSync.getSupabaseConfig();
    if (!cfg) {
      return { tableExists: false, logs: this.getLogs() };
    }

    try {
      const res = await fetch(
        `${cfg.url}/rest/v1/${SUPABASE_ERROR_TABLE}?select=*&order=created_at.desc&limit=100`,
        {
          method: 'GET',
          headers: getSupabaseHeaders(cfg.anonKey),
          cache: 'no-store',
        }
      );

      if (res.status === 404) {
        return {
          tableExists: false,
          logs: this.getLogs(),
          error: 'Tabela public.error_logs ainda não criada no SQL Editor do Supabase.',
        };
      }

      if (!res.ok) {
        const errTxt = await res.text().catch(() => `HTTP ${res.status}`);
        return {
          tableExists: false,
          logs: this.getLogs(),
          error: `HTTP ${res.status}: ${errTxt.slice(0, 140)}`,
        };
      }

      const rows = await res.json();
      if (!Array.isArray(rows)) {
        return { tableExists: true, logs: this.getLogs() };
      }

      const tableLogs: ErrorLogEntry[] = rows.map((r: any) => {
        const dt = r.created_at ? new Date(r.created_at) : new Date();
        return {
          id: String(r.id || `err-${ dt.getTime() }`),
          created_at: r.created_at || dt.toISOString(),
          data_hora: `${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}`,
          origem: r.origem || 'ErrorBoundary',
          mensagem: r.mensagem || 'Erro registrado',
          stack: r.stack || undefined,
          component_stack: r.component_stack || undefined,
          url: r.url || '',
          user_agent: r.user_agent || '',
          usuario_email: r.usuario_email || undefined,
          usuario_nome: r.usuario_nome || undefined,
          resolvido: Boolean(r.resolvido),
          enviado_supabase_tabela: true,
          updated_at_ms: dt.getTime(),
        };
      });

      // Mescla os registros da tabela public.error_logs com os locais
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
        logs: merged,
      };
    } catch (e: any) {
      return {
        tableExists: false,
        logs: this.getLogs(),
        error: e?.message || 'Erro de rede ao consultar public.error_logs',
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
      try {
        await fetch(`${cfg.url}/rest/v1/${SUPABASE_ERROR_TABLE}?id=eq.${encodeURIComponent(id)}`, {
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
    const lista = this.getLogs().filter((item) => item.id !== id);
    this.saveLogs(lista, true);

    const cfg = cloudSync.getSupabaseConfig();
    if (cfg) {
      try {
        await fetch(`${cfg.url}/rest/v1/${SUPABASE_ERROR_TABLE}?id=eq.${encodeURIComponent(id)}`, {
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
        await fetch(`${cfg.url}/rest/v1/${SUPABASE_ERROR_TABLE}?id=not.is.null`, {
          method: 'DELETE',
          headers: getSupabaseHeaders(cfg.anonKey),
        });
      } catch {
        // ignore
      }
    }
  },

  getSqlCreateTableScript(): string {
    return `-- Execute no SQL Editor do Supabase para criar a tabela dedicada de logs do ErrorBoundary:
CREATE TABLE IF NOT EXISTS public.error_logs (
  id text PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  origem text NOT NULL DEFAULT 'ErrorBoundary',
  mensagem text NOT NULL,
  stack text,
  component_stack text,
  url text,
  user_agent text,
  usuario_email text,
  usuario_nome text,
  resolvido boolean DEFAULT false
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir insercao e leitura de logs de erro" ON public.error_logs;
CREATE POLICY "Permitir insercao e leitura de logs de erro"
  ON public.error_logs
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
