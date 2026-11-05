import { cloudSync } from './cloudSync';

export type ChatConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface PendingAck {
  resolve: (res: { ok: boolean; serverTimestamp?: number; error?: string }) => void;
  timer: number;
}

class ChatRealtimeConnectionManager {
  private ws: WebSocket | null = null;
  private supabaseWs: WebSocket | null = null;
  private state: ChatConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private supabaseReconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private supabaseReconnectTimer: number | null = null;
  private heartbeatInterval: number | null = null;
  private pongTimeout: number | null = null;
  private supabaseHeartbeatInterval: number | null = null;
  private phxRefCounter = 1;
  private initialized = false;
  private wsUpgradeSupported = true;
  private consecutiveWsUpgradeFailures = 0;
  private pendingAcks = new Map<string, PendingAck>();

  init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.connectServerWebSocket();
    this.connectSupabaseRealtime();

    window.addEventListener('online', () => {
      this.reconnectAttempts = 0;
      this.supabaseReconnectAttempts = 0;
      this.ensureConnected(true);
    });

    window.addEventListener('offline', () => {
      this.setConnectionState('disconnected');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.ensureConnected(false);
      }
    });
  }

  getConnectionState(): ChatConnectionState {
    return this.state;
  }

  private setConnectionState(next: ChatConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('certam_chat_connection_state', {
          detail: { state: next, timestamp: Date.now() },
        })
      );
    }
  }

  ensureConnected(forceImmediate = false): void {
    if (typeof window === 'undefined') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setConnectionState('disconnected');
      return;
    }

    if (
      this.wsUpgradeSupported &&
      (!this.ws ||
        this.ws.readyState === WebSocket.CLOSED ||
        this.ws.readyState === WebSocket.CLOSING)
    ) {
      if (forceImmediate) {
        if (this.reconnectTimer) {
          window.clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.connectServerWebSocket();
      } else if (!this.reconnectTimer) {
        this.scheduleServerReconnect();
      }
    }

    const supCfg = cloudSync.getSupabaseConfig();
    if (
      supCfg &&
      (!this.supabaseWs ||
        this.supabaseWs.readyState === WebSocket.CLOSED ||
        this.supabaseWs.readyState === WebSocket.CLOSING)
    ) {
      if (forceImmediate) {
        if (this.supabaseReconnectTimer) {
          window.clearTimeout(this.supabaseReconnectTimer);
          this.supabaseReconnectTimer = null;
        }
        this.connectSupabaseRealtime();
      } else if (!this.supabaseReconnectTimer) {
        this.scheduleSupabaseReconnect();
      }
    }
  }

  private connectServerWebSocket(): void {
    if (typeof window === 'undefined' || !('WebSocket' in window)) return;
    if (!this.wsUpgradeSupported) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.setConnectionState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/chat-ws`;
      const socket = new WebSocket(wsUrl);
      this.ws = socket;
      let opened = false;

      socket.onopen = () => {
        opened = true;
        this.reconnectAttempts = 0;
        this.consecutiveWsUpgradeFailures = 0;
        this.setConnectionState('connected');
        this.startServerHeartbeat();
        // Ao reconectar, sincroniza imediatamente o estado com o servidor
        void cloudSync.pullFromServer();
      };

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          const packet = JSON.parse(event.data);
          if (!packet || typeof packet !== 'object') return;

          if (packet.type === 'chat:connected' || packet.type === 'chat:pong') {
            if (this.pongTimeout) {
              window.clearTimeout(this.pongTimeout);
              this.pongTimeout = null;
            }
            this.setConnectionState('connected');
            return;
          }

          if (packet.type === 'chat:ack' && typeof packet.ackId === 'string') {
            const pending = this.pendingAcks.get(packet.ackId);
            if (pending) {
              window.clearTimeout(pending.timer);
              this.pendingAcks.delete(packet.ackId);
              if (packet.entries && typeof packet.entries === 'object') {
                cloudSync.ingestRealtimeEntries(packet.entries);
              }
              pending.resolve({
                ok: Boolean(packet.ok),
                serverTimestamp: packet.serverTimestamp || Date.now(),
              });
            }
            return;
          }

          if (packet.type === 'chat:broadcast' && packet.entries) {
            cloudSync.ingestRealtimeEntries(packet.entries, packet.versions);
          }
        } catch {
          // ignore invalid JSON
        }
      };

      socket.onerror = () => {
        // Silencia erro bruto no console e aciona fluxo de reconexão
      };

      socket.onclose = () => {
        this.stopServerHeartbeat();
        if (this.ws === socket) {
          this.ws = null;
        }
        if (!opened) {
          this.consecutiveWsUpgradeFailures++;
          // Se o proxy reverso não suportar upgrade WS após 3 tentativas, mantém reconexão espaçada e usa Supabase Realtime / HTTP ACK
          if (this.consecutiveWsUpgradeFailures >= 3) {
            this.wsUpgradeSupported = false;
            window.setTimeout(() => {
              this.wsUpgradeSupported = true;
              this.consecutiveWsUpgradeFailures = 0;
            }, 60000);
            return;
          }
        }
        this.scheduleServerReconnect();
      };
    } catch {
      this.scheduleServerReconnect();
    }
  }

  private startServerHeartbeat(): void {
    this.stopServerHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.scheduleServerReconnect();
        return;
      }
      try {
        this.ws.send(JSON.stringify({ type: 'chat:ping', ts: Date.now() }));
        if (this.pongTimeout) window.clearTimeout(this.pongTimeout);
        this.pongTimeout = window.setTimeout(() => {
          // Conexão zumbi detectada -> força fechamento e reconexão imediata
          try {
            this.ws?.close();
          } catch {
            // ignore
          }
          this.ws = null;
          this.scheduleServerReconnect();
        }, 6000);
      } catch {
        this.scheduleServerReconnect();
      }
    }, 12000);
  }

  private stopServerHeartbeat(): void {
    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pongTimeout) {
      window.clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private scheduleServerReconnect(): void {
    if (typeof window === 'undefined' || this.reconnectTimer) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setConnectionState('disconnected');
      return;
    }
    this.setConnectionState('reconnecting');
    const delay = Math.min(10000, 1000 * Math.pow(1.8, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectServerWebSocket();
    }, delay);
  }

  // ---------------------------------------------------------------------------
  // WRAPPER SUPABASE REALTIME WEBSOCKET (Phoenix Channel Protocol v1.0.0)
  // ---------------------------------------------------------------------------
  private connectSupabaseRealtime(): void {
    if (typeof window === 'undefined' || !('WebSocket' in window)) return;
    const cfg = cloudSync.getSupabaseConfig();
    if (!cfg || !cfg.url || !cfg.anonKey) return;

    if (
      this.supabaseWs &&
      (this.supabaseWs.readyState === WebSocket.OPEN ||
        this.supabaseWs.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      const wsBase = cfg.url.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
      const realtimeUrl = `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(
        cfg.anonKey
      )}&vsn=1.0.0`;

      const ws = new WebSocket(realtimeUrl);
      this.supabaseWs = ws;

      ws.onopen = () => {
        this.supabaseReconnectAttempts = 0;
        this.setConnectionState('connected');

        const joinRef = String(this.phxRefCounter++);
        const joinPayload = {
          topic: 'realtime:public:configuracoes',
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: true, self: false },
              presence: { key: '' },
              postgres_changes: [
                {
                  event: '*',
                  schema: 'public',
                  table: 'configuracoes',
                },
              ],
            },
          },
          ref: joinRef,
        };
        try {
          ws.send(JSON.stringify(joinPayload));
        } catch {
          // ignore
        }

        this.startSupabaseHeartbeat();
        void cloudSync.pullFromServer();
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          const msg = JSON.parse(event.data);
          if (!msg || typeof msg !== 'object') return;

          // Eventos de alteração na tabela public.configuracoes (postgres_changes)
          if (msg.event === 'postgres_changes' || msg.event === 'INSERT' || msg.event === 'UPDATE') {
            const record = msg.payload?.data?.record || msg.payload?.record;
            if (record && typeof record.chave === 'string') {
              const chave = record.chave;
              if (chave.startsWith('certam_chat_') || chave.startsWith('certam_dm_')) {
                const rawVal =
                  typeof record.valor === 'string'
                    ? record.valor
                    : JSON.stringify(record.valor ?? []);
                cloudSync.ingestRealtimeEntries({ [chave]: rawVal });
              }
            }
            return;
          }

          // Eventos de broadcast direto no canal Realtime
          if (msg.event === 'broadcast' && msg.payload?.entries) {
            cloudSync.ingestRealtimeEntries(msg.payload.entries);
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        // tratado no onclose
      };

      ws.onclose = () => {
        this.stopSupabaseHeartbeat();
        if (this.supabaseWs === ws) {
          this.supabaseWs = null;
        }
        this.scheduleSupabaseReconnect();
      };
    } catch {
      this.scheduleSupabaseReconnect();
    }
  }

  private startSupabaseHeartbeat(): void {
    this.stopSupabaseHeartbeat();
    this.supabaseHeartbeatInterval = window.setInterval(() => {
      if (!this.supabaseWs || this.supabaseWs.readyState !== WebSocket.OPEN) {
        this.scheduleSupabaseReconnect();
        return;
      }
      try {
        this.supabaseWs.send(
          JSON.stringify({
            topic: 'phoenix',
            event: 'heartbeat',
            payload: {},
            ref: String(this.phxRefCounter++),
          })
        );
      } catch {
        this.scheduleSupabaseReconnect();
      }
    }, 25000);
  }

  private stopSupabaseHeartbeat(): void {
    if (this.supabaseHeartbeatInterval) {
      window.clearInterval(this.supabaseHeartbeatInterval);
      this.supabaseHeartbeatInterval = null;
    }
  }

  private scheduleSupabaseReconnect(): void {
    if (typeof window === 'undefined' || this.supabaseReconnectTimer) return;
    if (!cloudSync.getSupabaseConfig()) return;
    const delay = Math.min(12000, 1500 * Math.pow(1.8, this.supabaseReconnectAttempts));
    this.supabaseReconnectAttempts++;
    this.supabaseReconnectTimer = window.setTimeout(() => {
      this.supabaseReconnectTimer = null;
      this.connectSupabaseRealtime();
    }, delay);
  }

  /**
   * Envia entradas do chat exigindo confirmação explícita de recebimento (ACK) do servidor
   * via WebSocket (/api/chat-ws), endpoint de ACK (/api/chat-ack) ou Supabase.
   */
  async sendEntriesWithAck(
    msgId: string,
    entries: Record<string, string>
  ): Promise<{ ok: boolean; serverTimestamp?: number; error?: string }> {
    this.init();

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setConnectionState('disconnected');
      return {
        ok: false,
        error: 'Você está offline. Verifique sua conexão e clique para reenviar.',
      };
    }

    const ackId = `ack_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    // Propaga broadcast via Supabase Realtime se o socket estiver aberto
    if (this.supabaseWs && this.supabaseWs.readyState === WebSocket.OPEN) {
      try {
        this.supabaseWs.send(
          JSON.stringify({
            topic: 'realtime:public:configuracoes',
            event: 'broadcast',
            payload: {
              type: 'broadcast',
              event: 'chat_update',
              entries,
            },
            ref: String(this.phxRefCounter++),
          })
        );
      } catch {
        // ignore
      }
    }

    // 1. Tentativa prioritária via WebSocket ativo (/api/chat-ws) com timeout de ACK
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const wsAckResult = await new Promise<{
        ok: boolean;
        serverTimestamp?: number;
        error?: string;
      }>((resolve) => {
        const timer = window.setTimeout(() => {
          this.pendingAcks.delete(ackId);
          resolve({ ok: false, error: 'Timeout de ACK no WebSocket' });
        }, 3200);

        this.pendingAcks.set(ackId, { resolve, timer });

        try {
          this.ws!.send(
            JSON.stringify({
              type: 'chat:send',
              ackId,
              msgId,
              entries,
            })
          );
        } catch {
          window.clearTimeout(timer);
          this.pendingAcks.delete(ackId);
          resolve({ ok: false, error: 'Erro ao escrever no WebSocket' });
        }
      });

      if (wsAckResult.ok) {
        // Também persiste em segundo plano no Supabase caso configurado
        void cloudSync.pushEntriesToSupabaseWithAck(entries);
        this.setConnectionState('connected');
        return wsAckResult;
      }
    } else {
      this.ensureConnected(false);
    }

    // 2. Fallback determinístico HTTP POST /api/chat-ack + Supabase com confirmação explícita
    let serverConfirmed = false;
    let serverTimestamp = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/chat-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ackId, msgId, entries }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data?.ok) {
          serverConfirmed = true;
          serverTimestamp = data.serverTimestamp || Date.now();
          if (data.entries && typeof data.entries === 'object') {
            cloudSync.ingestRealtimeEntries(data.entries);
          }
        }
      }
    } catch {
      // Falha na chamada a /api/chat-ack
    }

    // 3. Se Supabase estiver configurado, valida também no Supabase
    const supCfg = cloudSync.getSupabaseConfig();
    if (supCfg) {
      const supOk = await cloudSync.pushEntriesToSupabaseWithAck(entries);
      if (supOk) {
        serverConfirmed = true;
      }
    }

    if (serverConfirmed) {
      this.setConnectionState('connected');
      return { ok: true, serverTimestamp };
    }

    // Se nenhuma camada confirmou o recebimento, dispara reconexão automática e retorna erro para permitir reenvio manual
    this.ensureConnected(true);
    return {
      ok: false,
      error: 'Não foi possível confirmar o recebimento pelo servidor. Clique para reenviar.',
    };
  }
}

export const chatRealtimeClient = new ChatRealtimeConnectionManager();
