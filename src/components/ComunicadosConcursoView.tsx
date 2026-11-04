import React, { useState, useEffect } from 'react';
import { Concurso, ComunicadoItem } from '../types';
import { useAuth } from '../store/authContext';
import { cloudSync } from '../store/cloudSync';
import {
  Megaphone,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Calendar,
  User,
  BarChart3,
  Plus,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface EnqueteOpcao {
  id: string;
  texto: string;
  votos_cpfs: string[];
}

interface EnqueteComissao {
  id: string;
  pergunta: string;
  criada_em: string;
  ativa: boolean;
  opcoes: EnqueteOpcao[];
}

interface ComunicadosConcursoViewProps {
  concurso: Concurso;
}

const DEFAULT_ENQUETES: EnqueteComissao[] = [
  {
    id: 'enq-padrao-1',
    pergunta: 'Qual deve ser a pauta prioritária da Comissão de Aprovados na próxima audiência institucional com a Administração?',
    criada_em: '15/02/2025',
    ativa: true,
    opcoes: [
      {
        id: 'op-1',
        texto: 'Ampliação do quantitativo do próximo lote de nomeações para suprir vacâncias de aposentadoria',
        votos_cpfs: ['00011122233', '11122233344', '22233344455', '33344455566'],
      },
      {
        id: 'op-2',
        texto: 'Substituição prioritária de cargos em comissão / cedidos por servidores efetivos concursados',
        votos_cpfs: ['44455566677', '55566677788'],
      },
      {
        id: 'op-3',
        texto: 'Divulgação antecipada do cronograma semestral de chamamentos e vagas por comarca',
        votos_cpfs: ['66677788899', '77788899900', '88899900011'],
      },
    ],
  },
];

export const ComunicadosConcursoView: React.FC<ComunicadosConcursoViewProps> = ({ concurso }) => {
  const { usuario, isAdmin } = useAuth();
  const comunicados: ComunicadoItem[] = concurso.comunicados || [];
  const [comunicadoAbertoId, setComunicadoAbertoId] = useState<string | null>(
    comunicados.length > 0 ? comunicados[0].id : null
  );

  const storageKeyEnquetes = `certam_enquetes_v1_${concurso.id}`;

  const [enquetes, setEnquetes] = useState<EnqueteComissao[]>(() => {
    try {
      const raw = localStorage.getItem(storageKeyEnquetes);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_ENQUETES;
  });

  const [mostrarFormNovaEnquete, setMostrarFormNovaEnquete] = useState(false);
  const [novaPergunta, setNovaPergunta] = useState('');
  const [novasOpcoesTexto, setNovasOpcoesTexto] = useState('Opção 1\nOpção 2\nOpção 3');

  useEffect(() => {
    const syncEnquetes = () => {
      try {
        const raw = localStorage.getItem(storageKeyEnquetes);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setEnquetes(parsed);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', syncEnquetes);
    return () => window.removeEventListener('storage', syncEnquetes);
  }, [storageKeyEnquetes]);

  const salvarEnquetes = (lista: EnqueteComissao[]) => {
    setEnquetes(lista);
    try {
      localStorage.setItem(storageKeyEnquetes, JSON.stringify(lista));
    } catch {
      // ignore
    }
    void cloudSync.pushKey(storageKeyEnquetes, lista, true);
  };

  const cpfUsuarioNormalizado = usuario?.cpf ? usuario.cpf.replace(/\D/g, '') : '';
  const idVotante = cpfUsuarioNormalizado.length >= 6 ? cpfUsuarioNormalizado : usuario?.email || '';

  const handleVotar = (enqueteId: string, opcaoId: string) => {
    if (!usuario || !idVotante) return;
    const atualizadas = enquetes.map((enq) => {
      if (enq.id !== enqueteId) return enq;
      const novasOpcoes = enq.opcoes.map((op) => {
        const semMeuVoto = op.votos_cpfs.filter((v) => v !== idVotante);
        if (op.id === opcaoId) {
          return { ...op, votos_cpfs: [...semMeuVoto, idVotante] };
        }
        return { ...op, votos_cpfs: semMeuVoto };
      });
      return { ...enq, opcoes: novasOpcoes };
    });
    salvarEnquetes(atualizadas);
  };

  const handleCriarEnquete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaPergunta.trim()) return;
    const linhas = novasOpcoesTexto
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (linhas.length < 2) return;

    const nova: EnqueteComissao = {
      id: `enq-${Date.now().toString(36)}`,
      pergunta: novaPergunta.trim(),
      criada_em: new Date().toLocaleDateString('pt-BR'),
      ativa: true,
      opcoes: linhas.map((texto, idx) => ({
        id: `op-${Date.now().toString(36)}-${idx}`,
        texto,
        votos_cpfs: [],
      })),
    };

    salvarEnquetes([nova, ...enquetes]);
    setNovaPergunta('');
    setMostrarFormNovaEnquete(false);
  };

  const handleExcluirEnquete = (id: string) => {
    if (window.confirm('Deseja excluir esta enquete da comissão?')) {
      salvarEnquetes(enquetes.filter((e) => e.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* SEÇÃO DE ENQUETES VERIFICADAS DA COMISSÃO DE APROVADOS (MELHORIA 7) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 card-shadow space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-mono font-bold uppercase mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Votação Auditada • 1 Voto por CPF Vinculado</span>
            </div>
            <h3 className="font-serif font-bold text-lg text-[#07192B] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-600" />
              <span>Enquetes Oficiais da Comissão de Aprovados</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Deliberações rápidas com resultado em tempo real para orientar a atuação institucional dos aprovados em {concurso.orgao}.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setMostrarFormNovaEnquete((v) => !v)}
              className="px-3.5 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{mostrarFormNovaEnquete ? 'Cancelar Enquete' : 'Nova Enquete Oficial'}</span>
            </button>
          )}
        </div>

        {mostrarFormNovaEnquete && isAdmin && (
          <form onSubmit={handleCriarEnquete} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Pergunta da Enquete:</label>
              <input
                type="text"
                value={novaPergunta}
                onChange={(e) => setNovaPergunta(e.target.value)}
                placeholder="Ex: Qual pauta priorizar na audiência com a Presidência do Tribunal?"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Opções de Voto (uma por linha):</label>
              <textarea
                rows={3}
                value={novasOpcoesTexto}
                onChange={(e) => setNovasOpcoesTexto(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-xl font-medium"
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl cursor-pointer"
              >
                Publicar Enquete
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {enquetes.map((enq) => {
            const totalVotos = enq.opcoes.reduce((acc, op) => acc + op.votos_cpfs.length, 0);
            const opcaoVotadaId = idVotante
              ? enq.opcoes.find((op) => op.votos_cpfs.includes(idVotante))?.id
              : undefined;

            return (
              <div
                key={enq.id}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Publicada em {enq.criada_em} • {totalVotos} {totalVotos === 1 ? 'voto auditado' : 'votos auditados'}
                    </span>
                    <h4 className="font-serif font-bold text-sm sm:text-base text-slate-900 mt-0.5">
                      {enq.pergunta}
                    </h4>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleExcluirEnquete(enq.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Excluir enquete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {enq.opcoes.map((op) => {
                    const qtd = op.votos_cpfs.length;
                    const perc = totalVotos > 0 ? Math.round((qtd / totalVotos) * 100) : 0;
                    const selecionada = opcaoVotadaId === op.id;

                    return (
                      <button
                        key={op.id}
                        type="button"
                        disabled={!usuario}
                        onClick={() => handleVotar(enq.id, op.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all relative overflow-hidden ${
                          selecionada
                            ? 'border-teal-500 bg-teal-50/60 shadow-2xs'
                            : 'border-slate-200 bg-white hover:border-teal-300'
                        } ${!usuario ? 'cursor-not-allowed opacity-85' : 'cursor-pointer'}`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-teal-500/12 transition-all duration-500"
                          style={{ width: `${perc}%` }}
                        />
                        <div className="relative flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 font-semibold text-slate-800">
                            {selecionada && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                            <span>{op.texto}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono">
                            <span className="text-[11px] text-slate-500">{qtd} v.</span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-900 font-bold text-xs">
                              {perc}%
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!usuario && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    Faça login com sua conta vinculada ao CPF para registrar seu voto auditado nesta deliberação.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO DE COMUNICADOS OFICIAIS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 card-shadow space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="font-serif font-bold text-lg text-[#07192B] flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-teal-600" />
            <span>Área de Comunicados Oficiais &amp; Mobilização dos Aprovados</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhamento de tramitações legislativas (PLs de cargos comissionados vs. efetivos), reuniões institucionais e ações das comissões
          </p>
        </div>

        {comunicados.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhum comunicado cadastrado para este certame até o momento.
          </div>
        ) : (
          <div className="space-y-4">
            {comunicados.map((item) => {
              const isAberto = comunicadoAbertoId === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border transition-all ${
                    item.importante
                      ? 'border-amber-300 bg-amber-50/20 shadow-2xs'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div
                    onClick={() => setComunicadoAbertoId(isAberto ? null : item.id)}
                    className="p-4 sm:p-5 cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.importante && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Urgente / Destaque
                          </span>
                        )}
                        <span className="text-2xs text-slate-400 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {item.data}
                        </span>
                        <span className="text-2xs text-slate-300">·</span>
                        <span className="text-2xs text-slate-500 flex items-center gap-1 font-semibold">
                          <User className="w-3 h-3" />
                          {item.autor}
                        </span>
                      </div>

                      <h4 className="font-serif font-bold text-sm sm:text-base text-slate-900 leading-snug">
                        {item.titulo}
                      </h4>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.resumo}
                      </p>

                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {item.tags.map((t, i) => (
                            <span
                              key={i}
                              className="text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 font-medium"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="self-end sm:self-center text-xs font-bold text-teal-700 hover:text-teal-900 shrink-0 cursor-pointer"
                    >
                      {isAberto ? 'Recolher texto' : 'Ler na íntegra'}
                    </button>
                  </div>

                  {isAberto && (
                    <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-slate-200/60 bg-white rounded-b-2xl">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-2 whitespace-pre-line font-medium">
                        {item.texto_completo}
                      </div>

                      {item.link_externo && (
                        <div className="mt-3 flex justify-end">
                          <a
                            href={item.link_externo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900"
                          >
                            <span>Acompanhar tramitação oficial / Notícia na íntegra</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
