import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../store/authContext';
import { certamStore } from '../store/certamStore';
import { contactStore, MOTIVOS_LABELS } from '../store/contactStore';
import { auditStore } from '../store/auditStore';
import { MotivoContato, Concurso } from '../types';
import { sanitizeInput } from '../utils/security';
import { X, Send, CheckCircle2, MessageSquare, AlertCircle, Building, Check, Sparkles, Link2 } from 'lucide-react';

interface ContatoAdminModalProps {
  aberto: boolean;
  onClose: () => void;
  motivoInicial?: MotivoContato;
  concursoNomePreenchido?: string;
  concursoIdPreenchido?: string;
  cargoIdPreenchido?: string;
}

export const ContatoAdminModal: React.FC<ContatoAdminModalProps> = ({
  aberto,
  onClose,
  motivoInicial = 'inclusao_concurso',
  concursoNomePreenchido = '',
  concursoIdPreenchido = '',
  cargoIdPreenchido = '',
}) => {
  const { usuario } = useAuth();
  const [concursosCadastrados, setConcursosCadastrados] = useState<Concurso[]>(() => certamStore.getConcursos());

  const [motivo, setMotivo] = useState<MotivoContato>(motivoInicial);

  // Seleção e preenchimento de concurso
  const [concursoSelecionadoId, setConcursoSelecionadoId] = useState<string>(concursoIdPreenchido || '');
  const [concursoOutroNome, setConcursoOutroNome] = useState(concursoNomePreenchido);
  const [anoConcurso, setAnoConcurso] = useState('2025');

  // Seleção e preenchimento de cargo
  const [cargoSelecionadoId, setCargoSelecionadoId] = useState<string>(cargoIdPreenchido || '');
  const [cargoOutroNome, setCargoOutroNome] = useState('');

  // Classificação e mensagem
  const [classificacao, setClassificacao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setConcursosCadastrados(certamStore.getConcursos());
      setMotivo(motivoInicial);
      if (concursoIdPreenchido) {
        setConcursoSelecionadoId(concursoIdPreenchido);
      }
      if (cargoIdPreenchido) {
        setCargoSelecionadoId(cargoIdPreenchido);
      }
      if (concursoNomePreenchido) {
        setConcursoOutroNome(concursoNomePreenchido);
      }
      setSucesso(false);
      setErro(null);
    }
  }, [aberto, motivoInicial, concursoIdPreenchido, cargoIdPreenchido, concursoNomePreenchido]);

  // Cargos disponíveis para o concurso selecionado
  const cargosDoConcurso = useMemo(() => {
    if (!concursoSelecionadoId || concursoSelecionadoId === '__OUTRO__') return [];
    const conc = concursosCadastrados.find((c) => c.id === concursoSelecionadoId);
    return conc?.cargos || [];
  }, [concursoSelecionadoId, concursosCadastrados]);

  if (!aberto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const emailAutor = usuario?.email || usuario?.email_contato || 'visitante@certam.com.br';
    const nomeAutor = usuario?.nome || 'Usuário Concurseiro';
    const cpfAutor = usuario?.cpf || '';

    let finalConcursoNome = '';
    let finalCargoNome = '';
    let finalAno = anoConcurso || '2025';

    const isFormularioAprovacao =
      motivo === 'inclusao_concurso' ||
      motivo === 'vinculacao_nao_efetivada' ||
      motivo === 'vinculacao_cadastro';

    if (isFormularioAprovacao) {
      // 1. Resolução do Concurso
      if (concursoSelecionadoId === '__OUTRO__') {
        if (!concursoOutroNome.trim()) {
          setErro('Por favor, informe o nome do concurso que ainda não está cadastrado.');
          return;
        }
        finalConcursoNome = concursoOutroNome.trim();
      } else if (concursoSelecionadoId) {
        const conc = concursosCadastrados.find((c) => c.id === concursoSelecionadoId);
        finalConcursoNome = conc ? `${conc.nome}` : concursoSelecionadoId;
        finalAno = conc?.ano || finalAno;
      } else {
        setErro('Por favor, selecione um concurso cadastrado ou escolha a opção "Outro".');
        return;
      }

      // 2. Resolução do Cargo
      if (concursoSelecionadoId === '__OUTRO__') {
        if (!cargoOutroNome.trim()) {
          setErro('Por favor, informe o nome do cargo aprovado.');
          return;
        }
        finalCargoNome = cargoOutroNome.trim();
      } else {
        if (cargoSelecionadoId === '__OUTRO__') {
          if (!cargoOutroNome.trim()) {
            setErro('Por favor, informe o nome do cargo que não está cadastrado para aquele concurso.');
            return;
          }
          finalCargoNome = cargoOutroNome.trim();
        } else if (cargoSelecionadoId) {
          const cg = cargosDoConcurso.find((c) => c.id === cargoSelecionadoId);
          finalCargoNome = cg ? cg.nome : cargoSelecionadoId;
        } else {
          setErro('Por favor, selecione um cargo cadastrado ou escolha a opção "Outro".');
          return;
        }
      }

      // 3. Resolução da Classificação
      if (!classificacao.trim()) {
        setErro('Por favor, informe a sua classificação oficial.');
        return;
      }
    } else {
      if (!mensagem.trim()) {
        setErro('Por favor, descreva sua solicitação ou mensagem para o administrador.');
        return;
      }
    }

    // Registra na Caixa de Contatos do Admin
    const posNum = parseInt(classificacao.replace(/\D/g, ''), 10) || 1;
    const descMensagem =
      mensagem.trim() ||
      (motivo === 'vinculacao_nao_efetivada'
        ? `Solicitação de vinculação do candidato ${nomeAutor} (CPF: ${cpfAutor || 'pendente'}) no concurso ${finalConcursoNome} (${finalAno}) - Cargo: ${finalCargoNome} com classificação ${classificacao}.`
        : `Solicitação de inclusão do certame ${finalConcursoNome} (${finalAno}) - Cargo: ${finalCargoNome} com classificação ${classificacao}.`);

    contactStore.enviarMensagem({
      usuario_email: emailAutor,
      usuario_nome: nomeAutor,
      motivo,
      concurso_nome: sanitizeInput(finalConcursoNome, 100),
      ano_concurso: sanitizeInput(finalAno, 10),
      cargo_nome: sanitizeInput(finalCargoNome, 100),
      classificacao: sanitizeInput(classificacao, 50),
      mensagem: sanitizeInput(descMensagem, 1000),
    });

    // Se for vinculação não efetivada ou concurso existente, também registra na fila de homologações do Admin
    if (isFormularioAprovacao) {
      auditStore.solicitarVinculacao({
        usuario_email: emailAutor,
        usuario_nome: nomeAutor,
        cpf: cpfAutor,
        concurso_id: concursoSelecionadoId || 'outro',
        cargo_id: cargoSelecionadoId || 'outro',
        concurso_nome: finalConcursoNome,
        cargo_nome: finalCargoNome,
        ano_concurso: finalAno,
        posicao_declarada: posNum,
        tipo: motivo === 'vinculacao_nao_efetivada' ? 'vinculacao_nao_efetivada' : 'inclusao_novo_concurso',
        comprovante_info: `Classificação informada: ${classificacao}. ${mensagem.trim()}`,
      });
    }

    setSucesso(true);
    setTimeout(() => {
      setSucesso(false);
      onClose();
    }, 2400);
  };

  const isFormularioAprovacao =
    motivo === 'inclusao_concurso' ||
    motivo === 'vinculacao_nao_efetivada' ||
    motivo === 'vinculacao_cadastro';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold">
              {motivo === 'vinculacao_nao_efetivada' ? (
                <Link2 className="w-4 h-4" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">
                {motivo === 'vinculacao_nao_efetivada'
                  ? 'Solicitar Vinculação de Aprovação'
                  : 'Acionar a Administração'}
              </h3>
              <p className="text-2xs text-slate-300">
                Inclusão de novos certames, vinculação de aprovados e suporte
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback de Sucesso */}
        {sucesso ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#2DD4AA] mx-auto animate-bounce" />
            <h4 className="font-serif font-bold text-lg text-slate-900">
              Solicitação Enviada com Sucesso!
            </h4>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              O administrador do CERTAM já recebeu os dados informados. As informações serão conferidas e integradas ao portal.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
            {erro && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            {/* Motivo da Solicitação */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tipo de Solicitação <span className="text-rose-500">*</span>
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoContato)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-medium"
              >
                <option value="inclusao_concurso">
                  Informar Outro Concurso ou Cargo Não Cadastrado no Site
                </option>
                <option value="vinculacao_nao_efetivada">
                  Concurso/Cargo Cadastrado, mas Vinculação Não Foi Efetivada
                </option>
                <option value="erro_classificacao">
                  Correção de Nota ou Posição na Classificação
                </option>
                <option value="duvida">Dúvida sobre Escolha de Comarcas ou Posse</option>
                <option value="sugestao">Sugestão de Funcionalidade para o Portal</option>
                <option value="outro">Outro Assunto</option>
              </select>
            </div>

            {/* Bloco Dinâmico para Concurso e Cargo */}
            {isFormularioAprovacao ? (
              <div className="p-3.5 bg-teal-50/50 border border-teal-200 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-teal-700" />
                    <span>Identificação do Concurso e Cargo</span>
                  </span>
                  {motivo === 'vinculacao_nao_efetivada' && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      Vinculação Manual
                    </span>
                  )}
                </div>

                {motivo === 'vinculacao_nao_efetivada' && (
                  <p className="text-2xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    Selecione o concurso e cargo já cadastrados no site nos quais você foi aprovado. A administração conferirá seu CPF e nome na lista oficial para efetivar sua vinculação.
                  </p>
                )}

                {/* 1. SELEÇÃO DO CONCURSO */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Concurso <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={concursoSelecionadoId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConcursoSelecionadoId(val);
                      setCargoSelecionadoId('');
                      if (val !== '__OUTRO__') {
                        const conc = concursosCadastrados.find((c) => c.id === val);
                        if (conc) {
                          setAnoConcurso(conc.ano);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium text-xs"
                    required
                  >
                    <option value="">Selecione um concurso cadastrado...</option>
                    {concursosCadastrados.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({c.ano})
                      </option>
                    ))}
                    <option value="__OUTRO__">
                      + Outro (Concurso que ainda não está cadastrado no site)
                    </option>
                  </select>
                </div>

                {/* Campo aberto caso selecione "Outro" concurso */}
                {concursoSelecionadoId === '__OUTRO__' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 animate-in fade-in duration-150">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nome do Concurso / Órgão <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: TJSC, TRF-4, TJPR, SEFAZ..."
                        value={concursoOutroNome}
                        onChange={(e) => setConcursoOutroNome(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Ano <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 2025"
                        value={anoConcurso}
                        onChange={(e) => setAnoConcurso(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium text-xs font-mono"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* 2. SELEÇÃO DO CARGO */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Cargo Aprovado <span className="text-rose-500">*</span>
                  </label>

                  {concursoSelecionadoId && concursoSelecionadoId !== '__OUTRO__' ? (
                    <select
                      value={cargoSelecionadoId}
                      onChange={(e) => setCargoSelecionadoId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium text-xs"
                      required
                    >
                      <option value="">Selecione um cargo cadastrado...</option>
                      {cargosDoConcurso.map((cg) => (
                        <option key={cg.id} value={cg.id}>
                          {cg.nome}
                        </option>
                      ))}
                      <option value="__OUTRO__">
                        + Outro (Cargo que ainda não está cadastrado para aquele concurso)
                      </option>
                    </select>
                  ) : concursoSelecionadoId === '__OUTRO__' ? (
                    <input
                      type="text"
                      placeholder="Ex: Analista Judiciário, Técnico, Contador..."
                      value={cargoOutroNome}
                      onChange={(e) => setCargoOutroNome(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium text-xs"
                      required
                    />
                  ) : (
                    <div className="text-2xs text-slate-400 bg-slate-100/70 p-2.5 rounded-xl border border-dashed border-slate-200">
                      Selecione primeiro o concurso acima para visualizar ou digitar os cargos disponíveis.
                    </div>
                  )}
                </div>

                {/* Campo aberto caso selecione "Outro" cargo para um concurso cadastrado */}
                {concursoSelecionadoId &&
                  concursoSelecionadoId !== '__OUTRO__' &&
                  cargoSelecionadoId === '__OUTRO__' && (
                    <div className="pt-1 animate-in fade-in duration-150">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nome do Cargo Não Cadastrado para este Concurso <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Oficial de Justiça, Psicólogo, Administrador..."
                        value={cargoOutroNome}
                        onChange={(e) => setCargoOutroNome(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium text-xs"
                        required
                      />
                    </div>
                  )}

                {/* 3. CLASSIFICAÇÃO */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Sua Classificação Oficial <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 5º lugar (ou 12)"
                    value={classificacao}
                    onChange={(e) => setClassificacao(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium text-xs font-mono"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Indique a colocação obtida (Ampla concorrência ou cota).
                  </span>
                </div>
              </div>
            ) : null}

            {/* Mensagem / Observações Adicionais */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {isFormularioAprovacao ? 'Observações Adicionais (opcional)' : 'Mensagem Detalhada'}
                {!isFormularioAprovacao && <span className="text-rose-500"> *</span>}
              </label>
              <textarea
                rows={3}
                placeholder={
                  isFormularioAprovacao
                    ? 'Informe links do edital, diário oficial ou detalhes que facilitem a conferência do administrador...'
                    : 'Descreva sua dúvida, sugestão ou solicitação...'
                }
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden leading-relaxed font-medium"
                required={!isFormularioAprovacao}
              />
            </div>

            {/* Ações */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {motivo === 'vinculacao_nao_efetivada'
                    ? 'Solicitar Vinculação'
                    : 'Enviar para o Administrador'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
