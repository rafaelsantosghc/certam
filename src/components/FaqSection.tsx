import React, { useState, useMemo, useEffect } from 'react';
import { faqStore } from '../store/faqStore';
import { FaqItem, FaqCategoria } from '../types';
import {
  HelpCircle,
  Search,
  ChevronDown,
  Sparkles,
  Bookmark,
  MessageSquare,
  Tag,
  CheckCircle2,
  ThumbsUp,
  Share2,
} from 'lucide-react';

interface FaqSectionProps {
  concursoId?: string;
  cargoId?: string;
  concursoNome?: string;
  onOpenChat?: () => void;
  onNavigateAdmin?: () => void;
}

const CATEGORIAS: { id: FaqCategoria | 'todas'; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas as Categorias' },
  { id: 'Remuneração e Benefícios', rotulo: 'Remuneração & Benefícios' },
  { id: 'Escolha de Lotação', rotulo: 'Escolha de Lotação' },
  { id: 'Posse e Documentos', rotulo: 'Posse & Documentos' },
  { id: 'Carreira e Teletrabalho', rotulo: 'Teletrabalho & Carreira' },
  { id: 'Recursos e Classificação', rotulo: 'Recursos & Classificação' },
  { id: 'Geral', rotulo: 'Geral & Certame' },
];

export const FaqSection: React.FC<FaqSectionProps> = ({
  concursoId,
  concursoNome,
  onOpenChat,
}) => {
  const [faqs, setFaqs] = useState<FaqItem[]>(() => faqStore.getFaqs(concursoId));
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<FaqCategoria | 'todas'>('todas');
  const [itensAbertos, setItensAbertos] = useState<Record<string, boolean>>({});
  const [utilMarcados, setUtilMarcados] = useState<Record<string, boolean>>({});
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  useEffect(() => {
    setFaqs(faqStore.getFaqs(concursoId));
    const handleUpdate = () => {
      setFaqs(faqStore.getFaqs(concursoId));
    };
    window.addEventListener('certam_faq_updated', handleUpdate);
    return () => window.removeEventListener('certam_faq_updated', handleUpdate);
  }, [concursoId]);

  // Abre os itens destacados por padrão na primeira carga
  useEffect(() => {
    const iniciaisOpen: Record<string, boolean> = {};
    faqs.forEach((f) => {
      if (f.destaque) {
        iniciaisOpen[f.id] = true;
      }
    });
    setItensAbertos(iniciaisOpen);
  }, [faqs.length]);

  const toggleItem = (id: string) => {
    setItensAbertos((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleUtil = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUtilMarcados((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCompartilhar = (faq: FaqItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const texto = `*Dúvida Oficial CERTAM: ${faq.pergunta}*\n\n${faq.resposta}`;
      navigator.clipboard.writeText(texto);
      setCopiadoId(faq.id);
      setTimeout(() => setCopiadoId(null), 2500);
    } catch {
      // ignore
    }
  };

  const faqsFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return faqs.filter((f) => {
      const bateCategoria = categoriaAtiva === 'todas' || f.categoria === categoriaAtiva;
      if (!bateCategoria) return false;

      if (!termo) return true;

      const naPergunta = f.pergunta.toLowerCase().includes(termo);
      const naResposta = f.resposta.toLowerCase().includes(termo);
      const nasTags = f.tags?.some((t) => t.toLowerCase().includes(termo)) ?? false;

      return naPergunta || naResposta || nasTags;
    });
  }, [faqs, busca, categoriaAtiva]);

  const totalDestaques = useMemo(() => faqs.filter((f) => f.destaque).length, [faqs]);

  return (
    <div className="space-y-6">
      {/* Hero Header do FAQ */}
      <div className="bg-gradient-to-br from-[#07192B] via-[#0C2640] to-[#135A7A] rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-[#2DD4AA]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2DD4AA]/20 border border-[#2DD4AA]/30 text-[#2DD4AA] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Base Oficial de Conhecimento e Orientações</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold font-serif tracking-tight text-white">
            Perguntas Frequentes &amp; Regras do Certame
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            Respostas oficiais sobre remuneração líquida, regras da escolha de comarcas, teletrabalho,
            documentos exigidos para a posse e rotina no {concursoNome || 'Tribunal'}.
          </p>

          {/* Campo de Busca Rápida */}
          <div className="pt-2">
            <div className="relative max-w-xl">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Busque por termos como 'salário', 'documentos', 'teletrabalho', 'fim de fila'..."
                className="w-full pl-11 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4AA] transition-all shadow-inner"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-300 hover:text-white bg-white/10 px-2 py-1 rounded-lg"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros por Categoria em Badges */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIAS.map((cat) => {
          const isActive = categoriaAtiva === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoriaAtiva(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                isActive
                  ? 'bg-[#07192B] text-[#2DD4AA] border-[#07192B] shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {cat.rotulo}
            </button>
          );
        })}
      </div>

      {/* Estatísticas Rápidas */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Exibindo <strong>{faqsFiltrados.length}</strong> de <strong>{faqs.length}</strong> dúvidas cadastradas
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
            <Bookmark className="w-3.5 h-3.5" />
            {totalDestaques} em destaque
          </span>
        </div>
      </div>

      {/* Lista de Acordeões do FAQ */}
      {faqsFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Nenhuma resposta encontrada</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Não encontramos dúvidas com o termo "{busca}". Tente pesquisar com outras palavras ou envie
            sua pergunta diretamente no chat da comunidade.
          </p>
          {onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#07192B] text-white rounded-xl text-xs font-bold hover:bg-[#0C2640] transition-all cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#2DD4AA]" />
              Perguntar no Chat do Cargo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {faqsFiltrados.map((faq) => {
            const isOpen = Boolean(itensAbertos[faq.id]);
            const isUtil = Boolean(utilMarcados[faq.id]);
            const isCopiado = copiadoId === faq.id;

            return (
              <div
                key={faq.id}
                className={`bg-white rounded-2xl border transition-all duration-200 ${
                  isOpen
                    ? 'border-teal-500/40 shadow-md ring-1 ring-teal-500/10'
                    : 'border-slate-200 hover:border-slate-300 card-shadow'
                }`}
              >
                {/* Pergunta (Cabeçalho do Acordeão) */}
                <button
                  type="button"
                  onClick={() => toggleItem(faq.id)}
                  className="w-full text-left p-5 flex items-start justify-between gap-4 cursor-pointer focus:outline-none"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {faq.categoria}
                      </span>
                      {faq.destaque && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Bookmark className="w-3 h-3 fill-amber-500 text-amber-500" />
                          Mais Acessada
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                      {faq.pergunta}
                    </h3>
                  </div>

                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {/* Resposta Expansível */}
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 border-t border-slate-100/80 animate-in fade-in duration-150 space-y-4">
                    <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/70 p-4 rounded-xl border border-slate-100 font-normal">
                      {faq.resposta}
                    </div>

                    {/* Tags e Ações Rápidas */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                      {faq.tags && faq.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {faq.tags.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBusca(t);
                              }}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-mono transition-colors cursor-pointer"
                            >
                              #{t}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={(e) => handleUtil(faq.id, e)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            isUtil
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${isUtil ? 'fill-emerald-600' : ''}`} />
                          <span>{isUtil ? 'Útil! (+1)' : 'Foi útil?'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleCompartilhar(faq, e)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                          title="Copiar texto da resposta"
                        >
                          {isCopiado ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Caixa de Ajuda Adicional */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 card-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Não encontrou a resposta que precisava?</h4>
            <p className="text-xs text-slate-500">
              Interaja diretamente com os colegas aprovados ou sugira uma nova dúvida ao administrador.
            </p>
          </div>
        </div>

        {onOpenChat && (
          <button
            type="button"
            onClick={onOpenChat}
            className="px-4 py-2.5 rounded-xl bg-[#07192B] hover:bg-[#0C2640] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm shrink-0"
          >
            <MessageSquare className="w-4 h-4 text-[#2DD4AA]" />
            Abrir Fórum da Comunidade
          </button>
        )}
      </div>
    </div>
  );
};
