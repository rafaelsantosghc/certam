import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChatMensagem, MensagemPrivada, Usuario } from '../types';
import { chatStore } from '../store/chatStore';
import { cloudSync } from '../store/cloudSync';

export const READ_TIMESTAMPS_STORAGE_KEY = 'certam_chat_read_timestamps_v1';

export interface MessageReadStatus {
  messageId: string;
  isReadByOthers: boolean;
  readersCount: number;
  lastReadTimestamp: number | null;
}

export type ReadTimestampsMap = Record<string, Record<string, number>>;

function extractMessageTimestampMs(msg: ChatMensagem | MensagemPrivada, fallbackIdx: number): number {
  const anyMsg = msg as any;
  if (typeof anyMsg.created_at === 'number' && anyMsg.created_at > 0) {
    return anyMsg.created_at;
  }
  if (typeof anyMsg.updated_at === 'number' && anyMsg.updated_at > 0) {
    return anyMsg.updated_at;
  }
  const idStr = String(msg.id || '');
  const match = idStr.match(/^(?:msg|dm)-([a-z0-9]+)-/i);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 36);
    if (!Number.isNaN(parsed) && parsed > 1000000000000) {
      return parsed;
    }
  }
  const numSuffix = idStr.match(/(\d{13})/);
  if (numSuffix && numSuffix[1]) {
    const parsedNum = Number(numSuffix[1]);
    if (!Number.isNaN(parsedNum)) return parsedNum;
  }
  return 1700000000000 + fallbackIdx * 1000;
}

export function getReadTimestampsFromLocalStorage(): ReadTimestampsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw =
      localStorage.getItem(READ_TIMESTAMPS_STORAGE_KEY) ||
      cloudSync.getItem(READ_TIMESTAMPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ReadTimestampsMap;
    }
  } catch {
    // ignore
  }
  return {};
}

export function recordRoomReadTimestamp(
  roomKey: string,
  readerId: string,
  timestampMs: number = Date.now()
): void {
  if (typeof window === 'undefined' || !roomKey || !readerId) return;
  const normalizedReader = readerId.trim().toLowerCase();
  if (!normalizedReader || normalizedReader === 'candidato@certam.com.br') return;

  try {
    const currentMap = getReadTimestampsFromLocalStorage();
    const roomReaders = { ...(currentMap[roomKey] || {}) };
    const prevTs = Number(roomReaders[normalizedReader] || 0);

    if (timestampMs > prevTs) {
      roomReaders[normalizedReader] = timestampMs;
      const nextMap: ReadTimestampsMap = {
        ...currentMap,
        [roomKey]: roomReaders,
      };
      localStorage.setItem(READ_TIMESTAMPS_STORAGE_KEY, JSON.stringify(nextMap));
      cloudSync.setItem(READ_TIMESTAMPS_STORAGE_KEY, nextMap);
      window.dispatchEvent(new CustomEvent('certam_read_receipts_updated'));
    }
  } catch {
    // ignore
  }
}

/**
 * Hook `useMessageStatus`:
 * Visualiza confirmações de leitura (read receipts) cruzando os timestamps de leitura
 * armazenados no `localStorage` (`certam_chat_read_timestamps_v1`) com o array de mensagens.
 */
export function useMessageStatus(
  messages: (ChatMensagem | MensagemPrivada)[],
  roomKey: string,
  usuario?: Usuario | null,
  isRoomActiveAndOpen: boolean = false
) {
  const [readMapVersion, setReadMapVersion] = useState(0);

  const currentReaderId = useMemo(() => {
    return chatStore.obterIdentificadorUsuario(usuario).trim().toLowerCase();
  }, [usuario]);

  useEffect(() => {
    const handleUpdate = () => setReadMapVersion((v) => v + 1);
    window.addEventListener('certam_read_receipts_updated', handleUpdate);
    window.addEventListener('certam_chat_updated', handleUpdate);
    window.addEventListener('certam_dm_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('certam_read_receipts_updated', handleUpdate);
      window.removeEventListener('certam_chat_updated', handleUpdate);
      window.removeEventListener('certam_dm_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const markRoomAsReadNow = useCallback(() => {
    if (!roomKey || !currentReaderId || messages.length === 0) return;
    let maxMsgTs = Date.now();
    messages.forEach((m, idx) => {
      const ts = extractMessageTimestampMs(m, idx);
      if (ts > maxMsgTs) maxMsgTs = ts;
    });
    recordRoomReadTimestamp(roomKey, currentReaderId, maxMsgTs);
  }, [roomKey, currentReaderId, messages]);

  useEffect(() => {
    if (isRoomActiveAndOpen && roomKey && currentReaderId && messages.length > 0) {
      markRoomAsReadNow();
    }
  }, [isRoomActiveAndOpen, roomKey, currentReaderId, messages.length, markRoomAsReadNow]);

  const statusByMessageId = useMemo<Record<string, MessageReadStatus>>(() => {
    void readMapVersion;
    const result: Record<string, MessageReadStatus> = {};
    if (!Array.isArray(messages) || messages.length === 0) return result;

    const allReadTimestamps = getReadTimestampsFromLocalStorage();
    const roomReceipts = (roomKey && allReadTimestamps[roomKey]) || {};

    messages.forEach((msg, idx) => {
      const msgTs = extractMessageTimestampMs(msg, idx);
      const anyMsg = msg as any;

      const senderIdsOfMessage = new Set<string>();
      if (anyMsg.sender_id) senderIdsOfMessage.add(String(anyMsg.sender_id).trim().toLowerCase());
      if (anyMsg.email) senderIdsOfMessage.add(String(anyMsg.email).trim().toLowerCase());
      if (anyMsg.remetente_email) {
        senderIdsOfMessage.add(String(anyMsg.remetente_email).trim().toLowerCase());
      }

      const readersSet = new Set<string>();
      let latestReadTs: number | null = null;

      // 1. Cruza os timestamps de leitura em localStorage com o timestamp da mensagem
      for (const [readerKey, readTs] of Object.entries(roomReceipts)) {
        const normReader = readerKey.trim().toLowerCase();
        if (!normReader || senderIdsOfMessage.has(normReader)) continue;
        if (typeof readTs === 'number' && readTs >= msgTs) {
          readersSet.add(normReader);
          if (!latestReadTs || readTs > latestReadTs) {
            latestReadTs = readTs;
          }
        }
      }

      // 2. Considera também usuários que curtiram ou reagiram à mensagem como leitores confirmados
      if (Array.isArray(anyMsg.curtido_por)) {
        anyMsg.curtido_por.forEach((u: string) => {
          const norm = String(u || '').trim().toLowerCase();
          if (norm && !senderIdsOfMessage.has(norm)) {
            readersSet.add(norm);
          }
        });
      }
      if (anyMsg.reacoes && typeof anyMsg.reacoes === 'object') {
        Object.values(anyMsg.reacoes).forEach((arr: any) => {
          if (Array.isArray(arr)) {
            arr.forEach((u: string) => {
              const norm = String(u || '').trim().toLowerCase();
              if (norm && !senderIdsOfMessage.has(norm)) {
                readersSet.add(norm);
              }
            });
          }
        });
      }

      // 3. Se outro usuário enviou mensagem posterior na mesma sala, ele comprovadamente leu as anteriores
      for (let afterIdx = idx + 1; afterIdx < messages.length; afterIdx++) {
        const laterMsg = messages[afterIdx] as any;
        const laterSender = String(
          laterMsg.sender_id || laterMsg.email || laterMsg.remetente_email || ''
        )
          .trim()
          .toLowerCase();
        if (laterSender && !senderIdsOfMessage.has(laterSender)) {
          readersSet.add(laterSender);
          const laterTs = extractMessageTimestampMs(messages[afterIdx], afterIdx);
          if (!latestReadTs || laterTs > latestReadTs) {
            latestReadTs = laterTs;
          }
        }
      }

      // 4. Em DMs 1-a-1, respeita também a flag explícita `lida === true`
      if (typeof anyMsg.lida === 'boolean' && anyMsg.lida && anyMsg.destinatario_email) {
        const destNorm = String(anyMsg.destinatario_email).trim().toLowerCase();
        if (destNorm && !senderIdsOfMessage.has(destNorm)) {
          readersSet.add(destNorm);
        }
      }

      result[msg.id] = {
        messageId: msg.id,
        isReadByOthers: readersSet.size > 0,
        readersCount: readersSet.size,
        lastReadTimestamp: latestReadTs,
      };
    });

    return result;
  }, [messages, roomKey, readMapVersion]);

  const isMessageReadByOthers = useCallback(
    (msgId: string): boolean => {
      return Boolean(statusByMessageId[msgId]?.isReadByOthers);
    },
    [statusByMessageId]
  );

  const getMessageReadStatus = useCallback(
    (msgId: string): MessageReadStatus => {
      return (
        statusByMessageId[msgId] || {
          messageId: msgId,
          isReadByOthers: false,
          readersCount: 0,
          lastReadTimestamp: null,
        }
      );
    },
    [statusByMessageId]
  );

  return {
    statusByMessageId,
    isMessageReadByOthers,
    getMessageReadStatus,
    markRoomAsReadNow,
  };
}
