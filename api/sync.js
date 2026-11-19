import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP_SYNC_DB_FILE = path.join(os.tmpdir(), 'certam_sync_db.json');
const PUBLIC_SYNC_DB_FILE = path.join(process.cwd(), 'public', 'certam_sync_db.json');
const SUPABASE_CONFIG_KEY = 'certam_supabase_config';
const BANNED_CONCURSO_IDS = new Set(['tjrs_2024', 'tjrs_analista_2024', 'mprs_2024']);

const LEGACY_KEY_MIGRATIONS = {
  certam_concursos_cargos: 'certam_concursos_cargos_v6',
  certam_concursos_cargos_v1: 'certam_concursos_cargos_v6',
  certam_concursos_cargos_v2: 'certam_concursos_cargos_v6',
  certam_concursos_cargos_v3: 'certam_concursos_cargos_v6',
  certam_concursos_cargos_v4: 'certam_concursos_cargos_v6',
  certam_concursos_cargos_v5: 'certam_concursos_cargos_v6',
  certam_lotes_data: 'certam_lotes_data_v6',
  certam_lotes_data_v1: 'certam_lotes_data_v6',
  certam_lotes_data_v2: 'certam_lotes_data_v6',
  certam_lotes_data_v3: 'certam_lotes_data_v6',
  certam_lotes_data_v4: 'certam_lotes_data_v6',
  certam_lotes_data_v5: 'certam_lotes_data_v6',
  certam_users_registry_v1: 'certam_users_registry_v2',
  certam_perfil_audit_requests_v4: 'certam_perfil_audit_requests_v5',
  certam_vinculacao_requests_v4: 'certam_vinculacao_requests_v5',
  certam_contact_messages_v4: 'certam_contact_messages_v5',
  certam_notifications_events_v3: 'certam_notifications_events_v5',
  certam_notifications_events_v4: 'certam_notifications_events_v5',
  certam_faq_items_v1: 'certam_faq_items_v6',
  certam_faq_items_v2: 'certam_faq_items_v6',
  certam_faq_items_v3: 'certam_faq_items_v6',
  certam_faq_items_v4: 'certam_faq_items_v6',
  certam_faq_items_v5: 'certam_faq_items_v6',
};

let memoryCache = { entries: {}, versions: {} };

function sanitizeSyncEntryValue(key, valStr) {
  if (!valStr || typeof valStr !== 'string') return valStr;
  if (key === 'certam_concursos_cargos_v6' && valStr.startsWith('[')) {
    try {
      const parsed = JSON.parse(valStr);
      if (Array.isArray(parsed)) {
        const filtered = parsed
          .filter((c) => {
            if (!c || typeof c !== 'object') return false;
            const cid = String(c.id || '').toLowerCase();
            if (BANNED_CONCURSO_IDS.has(cid)) return false;
            if (String(c.orgao || '').toUpperCase() === 'TJRS' && String(c.ano || '') === '2024') {
              return false;
            }
            return true;
          })
          .map((c) => {
            if (
              c.id === 'tjrs_2025' &&
              c.nome === 'Concurso TJRS - Tribunal de Justiça do Rio Grande do Sul' &&
              c.status === 'Homologado' &&
              c.tipo_lotacao === 'Comarca'
            ) {
              return {
                ...c,
                nome: 'Tribunal de Justiça do Estado do Rio Grande do Sul',
                status: 'Convocando',
                tipo_lotacao: 'Lotação',
              };
            }
            return c;
          });
        return JSON.stringify(filtered);
      }
    } catch {
      // ignore
    }
  }
  return valStr;
}

function readDbFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.entries) {
        const clampedVersions = {};
        const now = Date.now();
        for (const [vk, vv] of Object.entries(parsed.versions || {})) {
          if (typeof vv === 'number') {
            clampedVersions[vk] = vv === 1793400000000 || vv > now + 60000 ? 1 : vv;
          }
        }
        return { entries: parsed.entries, versions: clampedVersions };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function loadLocalDb() {
  const fromPublic = readDbFile(PUBLIC_SYNC_DB_FILE);
  const fromTmp = readDbFile(TMP_SYNC_DB_FILE);

  const entries = {
    ...(fromPublic?.entries || {}),
    ...(fromTmp?.entries || {}),
    ...(memoryCache.entries || {}),
  };
  const versions = {
    ...(fromPublic?.versions || {}),
    ...(fromTmp?.versions || {}),
    ...(memoryCache.versions || {}),
  };

  for (const k of Object.keys(entries)) {
    entries[k] = sanitizeSyncEntryValue(k, entries[k]);
  }

  return { entries, versions };
}

function saveLocalDb(db) {
  memoryCache = {
    entries: { ...db.entries },
    versions: { ...db.versions },
  };
  try {
    fs.writeFileSync(TMP_SYNC_DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

function resolveServerSupabaseConfig(dbEntries) {
  const envUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const envKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (envUrl && envKey && envUrl.startsWith('http')) {
    return { url: envUrl.replace(/\/+$/, ''), key: envKey };
  }

  try {
    const rawCfg = dbEntries?.[SUPABASE_CONFIG_KEY];
    if (rawCfg) {
      const parsed = JSON.parse(rawCfg);
      if (parsed?.url && parsed?.anonKey && parsed.url.startsWith('http')) {
        return {
          url: String(parsed.url).trim().replace(/\/+$/, ''),
          key: String(parsed.anonKey).trim(),
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

let lastSupabasePullAt = 0;
const SERVER_SUPABASE_PULL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

async function upsertRowToSupabase(cfg, chave, rawStrVal) {
  let parsedValor = rawStrVal;
  try {
    parsedValor = JSON.parse(rawStrVal);
  } catch {
    parsedValor = rawStrVal;
  }

  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json',
  };

  // 1. Tenta upsert direto com on_conflict=chave e return=minimal (0 bytes de Egress)
  try {
    const res = await fetch(`${cfg.url}/rest/v1/configuracoes?on_conflict=chave`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ chave, valor: parsedValor, updated_at: new Date().toISOString() }]),
    });
    if (res.ok) return true;
  } catch {
    // fallback
  }

  // 2. Fallback PATCH com return=minimal,count=exact (sem baixar o JSON de volta, economizando 100% de Egress)
  const encodedKey = encodeURIComponent(chave);
  for (const candidateValor of [parsedValor, rawStrVal]) {
    try {
      const patchRes = await fetch(`${cfg.url}/rest/v1/configuracoes?chave=eq.${encodedKey}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal,count=exact' },
        body: JSON.stringify({ valor: candidateValor }),
      });
      if (patchRes.ok) {
        const range = patchRes.headers.get('content-range') || '';
        if (range && !range.endsWith('/0') && !range.startsWith('*/0')) {
          return true;
        }
        break;
      }
    } catch {
      // ignore
    }
  }

  for (const candidateValor of [parsedValor, rawStrVal]) {
    try {
      const postRes = await fetch(`${cfg.url}/rest/v1/configuracoes`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ chave, valor: candidateValor }),
      });
      if (postRes.ok) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const db = loadLocalDb();
  const supCfg = resolveServerSupabaseConfig(db.entries);

  // Se o servidor possui variáveis de ambiente do Supabase, expõe certam_supabase_config para que todos os navegadores conectem automaticamente
  if (supCfg && !db.entries[SUPABASE_CONFIG_KEY]) {
    const anonEnv = (
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.PUBLIC_SUPABASE_ANON_KEY ||
      supCfg.key
    ).trim();
    db.entries[SUPABASE_CONFIG_KEY] = JSON.stringify({ url: supCfg.url, anonKey: anonEnv });
    db.versions[SUPABASE_CONFIG_KEY] = 1;
  }

  if (req.method === 'GET') {
    const now = Date.now();
    const hasLocalEntries = Object.keys(db.entries).length > 1;
    // Evita consultar SELECT * no Supabase a cada requisição GET (o que esgotava o limite de 5GB de Egress).
    // O cliente já faz Delta Sync seletivo (select=chave,updated_at) diretamente com o Supabase.
    if (supCfg && (!hasLocalEntries || now - lastSupabasePullAt > SERVER_SUPABASE_PULL_COOLDOWN_MS)) {
      lastSupabasePullAt = now;
      try {
        const metaRes = await fetch(`${supCfg.url}/rest/v1/configuracoes?select=chave,updated_at`, {
          method: 'GET',
          headers: {
            apikey: supCfg.key,
            Authorization: `Bearer ${supCfg.key}`,
            'Content-Type': 'application/json',
          },
        });
        if (metaRes.ok) {
          const metaRows = await metaRes.json();
          if (Array.isArray(metaRows)) {
            const requestedKeysParam =
              typeof req.query?.keys === 'string'
                ? new Set(req.query.keys.split(',').map((s) => s.trim()).filter(Boolean))
                : null;
            const keysToFetch = [];
            for (const row of metaRows) {
              if (!row || typeof row.chave !== 'string') continue;
              const rawKey = row.chave;
              if (!rawKey.startsWith('certam_')) continue;
              if (rawKey === '_test_ping' || rawKey === 'certam_diag_heartbeat') continue;
              const k = LEGACY_KEY_MIGRATIONS[rawKey] || rawKey;
              if (k.includes('tjrs_2024') || k.includes('mprs_2024')) continue;
              // Evita baixar datasets massivos de candidatos em lote no GET padrão; eles são carregados sob demanda pelo frontend
              if (
                k.startsWith('certam_candidatos_data_v6_') &&
                (!requestedKeysParam || !requestedKeysParam.has(k))
              ) {
                continue;
              }
              const ts = row.updated_at ? new Date(row.updated_at).getTime() : 1;
              const knownTs = db.versions[k] || 0;
              if (!db.entries[k] || ts > knownTs) {
                keysToFetch.push(rawKey);
              }
            }
            if (keysToFetch.length > 0) {
              const inList = keysToFetch.map((k) => `"${k.replace(/"/g, '')}"`).join(',');
              const supRes = await fetch(
                `${supCfg.url}/rest/v1/configuracoes?select=chave,valor,updated_at&chave=in.(${encodeURIComponent(inList)})`,
                {
                  method: 'GET',
                  headers: {
                    apikey: supCfg.key,
                    Authorization: `Bearer ${supCfg.key}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              if (supRes.ok) {
                const rows = await supRes.json();
                if (Array.isArray(rows)) {
                  for (const row of rows) {
                    if (!row || typeof row.chave !== 'string') continue;
                    const rawKey = row.chave;
                    const k = LEGACY_KEY_MIGRATIONS[rawKey] || rawKey;
                    const rawVal =
                      typeof row.valor === 'string' ? row.valor : JSON.stringify(row.valor ?? null);
                    const cleanVal = sanitizeSyncEntryValue(k, rawVal);
                    if (cleanVal && cleanVal !== '[]' && cleanVal !== '{}' && cleanVal !== 'null') {
                      db.entries[k] = cleanVal;
                      db.versions[k] = row.updated_at
                        ? new Date(row.updated_at).getTime()
                        : db.versions[k] || 1;
                    }
                  }
                  saveLocalDb(db);
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return res.status(200).json({
      entries: db.entries,
      versions: db.versions,
      serverTime: new Date().toISOString(),
    });
  }

  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const incoming = payload?.entries || {};
      const ackId = payload?.ackId;
      const msgId = payload?.msgId;
      const skipSupabaseForward = Boolean(payload?.clientWillPushSupabase);
      const keysToDelete = Array.isArray(payload?.deleteKeys) ? payload.deleteKeys : [];
      const now = Date.now();
      const updatedEntries = {};

      for (const delKey of keysToDelete) {
        if (typeof delKey === 'string' && delKey in db.entries) {
          delete db.entries[delKey];
          delete db.versions[delKey];
        }
      }

      const activeSupCfg = resolveServerSupabaseConfig({ ...db.entries, ...incoming });

      for (const [rawKey, v] of Object.entries(incoming)) {
        if (rawKey === '_test_ping') continue;
        const k = LEGACY_KEY_MIGRATIONS[rawKey] || rawKey;
        if (typeof v === 'string') {
          let sanitized = sanitizeSyncEntryValue(k, v);
          if (
            (k.startsWith('certam_chat_') || k.startsWith('certam_dm_')) &&
            db.entries[k] &&
            db.entries[k].startsWith('[') &&
            sanitized.startsWith('[')
          ) {
            try {
              const existingArr = JSON.parse(db.entries[k]);
              const incomingArr = JSON.parse(sanitized);
              if (Array.isArray(existingArr) && Array.isArray(incomingArr)) {
                const map = new Map();
                existingArr.forEach((item) => {
                  if (item && typeof item === 'object' && (item.id || item.email)) {
                    map.set(String(item.id || item.email), item);
                  }
                });
                incomingArr.forEach((item) => {
                  if (item && typeof item === 'object' && (item.id || item.email)) {
                    const keyId = String(item.id || item.email);
                    const prev = map.get(keyId);
                    map.set(keyId, prev ? { ...prev, ...item } : item);
                  }
                });
                sanitized = JSON.stringify(Array.from(map.values()));
              }
            } catch {
              // fallback to sanitized
            }
          }
          db.entries[k] = sanitized;
          db.versions[k] = now;
          updatedEntries[k] = sanitized;
          // Evita escrita duplicada no Supabase quando o próprio navegador já fará o upsert direto
          if (activeSupCfg && !skipSupabaseForward && k !== SUPABASE_CONFIG_KEY) {
            await upsertRowToSupabase(activeSupCfg, k, sanitized);
          }
        }
      }

      saveLocalDb(db);

      return res.status(200).json({
        ok: true,
        ackId,
        msgId,
        serverTimestamp: now,
        entries: updatedEntries,
        versions: db.versions,
        totalKeys: Object.keys(db.entries).length,
        serverTime: new Date().toISOString(),
      });
    } catch {
      return res.status(400).json({ ok: false });
    }
  }

  return res.status(405).json({ ok: false });
}
