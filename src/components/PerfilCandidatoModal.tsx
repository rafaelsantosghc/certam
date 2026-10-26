import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/authContext';
import { certamStore } from '../store/certamStore';
import { auditStore } from '../store/auditStore';
import { Concurso, OutroConcursoAprovado, AlteracaoCampoItem } from '../types';
import { sanitizeInput } from '../utils/security';
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  User,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react';

interface PerfilCandidatoModalProps {
  aberto: boolean;
  onClose: () => void;
  onAbrirContatoAdmin?: (motivo: any) => void;
}

export const PerfilCandidatoModal: React.FC<PerfilCandidatoModalProps> = ({
  aberto,
  onClose,
  onAbrirContatoAdmin,
}) => {
  const { usuario, atualizarDadosUsuario } = useAuth();
  const [concursosCadastrados] = useState<Concurso[]>(() => certamStore.getConcursos());

  // Form State
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [emailContato, setEmailContato] = useState('');
  const [outrosConcursos, setOutrosConcursos] = useState<OutroConcursoAprovado[]>([]);

  // Novo item de outro concurso sendo adicionado
  const [novoConcNome, setNovoConcNome] = useState('');
  const [novoConcAno, setNovoConcAno] = useState('2025');
  const [novoConcCargo, setNovoConcCargo] = useState('');
  const [novoConcPos, setNovoConcPos] = useState('');

  // Diff / Revisão
  const [modalDiffAberto, setModalDiffAberto] = useState(false);
  const [diffAlteracoes, setDiffAlteracoes] = useState<AlteracaoCampoItem[]>([]);
  const [submetidoSucesso, setSubmetidoSucesso] = useState(false);
  const [primeiroCadastro, setPrimeiroCadastro] = useState(false);

  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome || '');
      setCpf(usuario.cpf || '');
      setDataNascimento(usuario.data_nascimento || '');
      setWhatsapp(usuario.whatsapp || usuario.telefone || '');
      setEmailContato(usuario.email_contato || usuario.email || '');
      setOutrosConcursos(usuario.outros_concursos || []);

      // Se for a primeira vez que preenche dados (sem CPF ou sem data de nascimento gravada)
      const isSemDados = !usuario.cpf && !usuario.data_nascimento;
      setPrimeiroCadastro(isSemDados);
    }
  }, [usuario, aberto]);

  if (!aberto || !usuario) return null;

  // Manter e-mail de login
  const handleManterEmailLogin = () => {
    setEmailContato(usuario.email);
  };

  // Formatar CPF
  const handleCpfChange = (val: string) => {
    const limpo = val.replace(/\D/g, '').slice(0, 11);
    let formatado = limpo;
    if (limpo.length > 9) {
      formatado = `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
    } else if (limpo.length > 6) {
      formatado = `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6)}`;
    } else if (limpo.length > 3) {
      formatado = `${limpo.slice(0, 3)}.${limpo.slice(3)}`;
    }
    setCpf(formatado);
  };

  // Formatar WhatsApp
  const handleWhatsappChange = (val: string) => {
    const limpo = val.replace(/\D/g, '').slice(0, 11);
    let formatado = limpo;
    if (limpo.length > 6) {
      formatado = `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    } else if (limpo.length > 2) {
      formatado = `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
    }
    setWhatsapp(formatado);
  };

  // Adicionar outro concurso à lista
  const handleAdicionarOutroConcurso = () => {
    if (!novoConcNome || !novoConcCargo || !novoConcPos) return;
    const item: OutroConcursoAprovado = {
      concurso_nome: novoConcNome,
      ano: novoConcAno || '2025',
      cargo: novoConcCargo,
      classificacao: parseInt(novoConcPos, 10) || 1,
    };
    setOutrosConcursos((prev) => [...prev, item]);
    setNovoConcNome('');
    setNovoConcCargo('');
    setNovoConcPos('');
  };

  const handleRemoverOutroConcurso = (idx: number) => {
    setOutrosConcursos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calcular Diffs entre os dados do usuário e o formulário
  const calcularDiffs = (): AlteracaoCampoItem[] => {
    const diffs: AlteracaoCampoItem[] = [];

    if (nome.trim() !== (usuario.nome || '').trim()) {
      diffs.push({
        campo: 'nome',
        campo_label: 'Nome Completo',
        valor_antigo: usuario.nome || '(não informado)',
        valor_novo: nome.trim(),
      });
    }

    if (cpf.trim() !== (usuario.cpf || '').trim()) {
      diffs.push({
        campo: 'cpf',
        campo_label: 'CPF',
        valor_antigo: usuario.cpf || '(não informado)',
        valor_novo: cpf.trim(),
      });
    }

    if (dataNascimento !== (usuario.data_nascimento || '')) {
      diffs.push({
        campo: 'data_nascimento',
        campo_label: 'Data de Nascimento',
        valor_antigo: usuario.data_nascimento || '(não informado)',
        valor_novo: dataNascimento || '(não informado)',
      });
    }

    if (whatsapp.trim() !== (usuario.whatsapp || usuario.telefone || '').trim()) {
      diffs.push({
        campo: 'whatsapp',
        campo_label: 'WhatsApp de Contato',
        valor_antigo: usuario.whatsapp || usuario.telefone || '(não informado)',
        valor_novo: whatsapp.trim(),
      });
    }

    if (emailContato.trim() !== (usuario.email_contato || usuario.email || '').trim()) {
      diffs.push({
        campo: 'email_contato',
        campo_label: 'E-mail para Comunicação',
        valor_antigo: usuario.email_contato || usuario.email || '(não informado)',
        valor_novo: emailContato.trim(),
      });
    }

    // Compara outros concursos
    const antigosConc = JSON.stringify(usuario.outros_concursos || []);
    const novosConc = JSON.stringify(outrosConcursos);
    if (antigosConc !== novosConc) {
      diffs.push({
        campo: 'outros_concursos',
        campo_label: 'Outros Concursos e Cargos Aprovados',
        valor_antigo: `${(usuario.outros_concursos || []).length} concurso(s) cadastrado(s)`,
        valor_novo: `${outrosConcursos.length} concurso(s) selecionado(s)`,
      });
    }

    return diffs;
  };

  const handleSubmeterOuSalvar = (e: React.FormEvent) => {
    e.preventDefault();

    // Se for o primeiro preenchimento inicial (setup inicial da conta), grava diretamente
    if (primeiroCadastro) {
      atualizarDadosUsuario({
        nome: sanitizeInput(nome, 100),
        cpf: sanitizeInput(cpf, 20),
        data_nascimento: sanitizeInput(dataNascimento, 15),
        whatsapp: sanitizeInput(whatsapp, 25),
        telefone: sanitizeInput(whatsapp, 25),
        email_contato: sanitizeInput(emailContato, 80),
        outros_concursos: outrosConcursos,
      });
      setSubmetidoSucesso(true);
      setTimeout(() => {
        setSubmetidoSucesso(false);
        onClose();
      }, 2000);
      return;
    }

    // Se já havia dados gravados, calcula diff e abre modal de confirmação para submeter ao admin
    const diffs = calcularDiffs();
    if (diffs.length === 0) {
      onClose();
      return;
    }

    setDiffAlteracoes(diffs);
    setModalDiffAberto(true);
  };

  const handleConfirmarSubmissaoAdmin = () => {
    auditStore.submeterSolicitacaoAlteracao({
      usuario_email: usuario.email,
      usuario_nome: usuario.nome,
      cpf: usuario.cpf || cpf,
      alteracoes: diffAlteracoes,
    });

    setModalDiffAberto(false);
    setSubmetidoSucesso(true);
    setTimeout(() => {
      setSubmetidoSucesso(false);
      onClose();
    }, 2800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Cadastro e Perfil do Candidato</h3>
              <p className="text-2xs text-slate-300">
                Informações para cruzamento no cadastro geral e notificações oficiais
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
        {submetidoSucesso ? (
          <div className="p-10 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-[#2DD4AA] mx-auto animate-bounce" />
            <h4 className="font-serif font-bold text-lg text-slate-900">
              {primeiroCadastro ? 'Dados Cadastrados com Sucesso!' : 'Alterações Submetidas ao Administrador!'}
            </h4>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              {primeiroCadastro
                ? 'Seu cadastro foi salvo e sincronizado com a Master List de classificação do CERTAM.'
                : 'As alterações solicitadas foram enviadas para a fila de moderação do administrador. Assim que conferidas, serão homologadas.'}
            </p>
          </div>
        ) : modalDiffAberto ? (
          /* MODAL INTERMEDIÁRIO DE DIFF ANTES DA SUBMISSÃO */
          <div className="p-6 overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
              <div>
                <span className="font-bold block">Revisão de Modificações no Cadastro</span>
                <span className="text-2xs text-amber-700">
                  Para garantir a integridade dos rankings oficiais, suas alterações serão analisadas pelo administrador antes de serem aplicadas.
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              <div className="grid grid-cols-12 bg-slate-50 px-3.5 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <span className="col-span-4">Campo</span>
                <span className="col-span-4 text-rose-700">Dado Anterior</span>
                <span className="col-span-4 text-teal-700">Nova Informação</span>
              </div>
              {diffAlteracoes.map((diff, i) => (
                <div key={i} className="grid grid-cols-12 px-3.5 py-2.5 items-center gap-2 hover:bg-slate-50">
                  <span className="col-span-4 font-semibold text-slate-800">{diff.campo_label}</span>
                  <span className="col-span-4 font-mono text-slate-500 line-through text-[11px] truncate">
                    {diff.valor_antigo}
                  </span>
                  <span className="col-span-4 font-mono text-teal-800 font-bold text-[11px] truncate flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-teal-600 shrink-0" />
                    {diff.valor_novo}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModalDiffAberto(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Voltar e Ajustar
              </button>
              <button
                type="button"
                onClick={handleConfirmarSubmissaoAdmin}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#07192B] text-[#2DD4AA] font-bold rounded-xl hover:bg-[#0C2640] transition-colors cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirmar e Submeter ao Admin</span>
              </button>
            </div>
          </div>
        ) : (
          /* FORMULÁRIO COMPLETO */
          <form onSubmit={handleSubmeterOuSalvar} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
            {/* Aviso de Auditoria */}
            {!primeiroCadastro && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-2xs text-slate-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    Qualquer alteração em seus dados cadastrais será auditada e submetida para aprovação da administração.
                  </span>
                </div>
              </div>
            )}

            {/* Nome Completo e CPF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  CPF <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-mono font-medium"
                  required
                />
              </div>
            </div>

            {/* Data de Nascimento e WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data de Nascimento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  WhatsApp para Contato <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => handleWhatsappChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-mono font-medium"
                  required
                />
              </div>
            </div>

            {/* E-mail de Contato com Botão de Manter E-mail de Login */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  E-mail para Notificações e Contato <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleManterEmailLogin}
                  className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 cursor-pointer underline"
                >
                  Manter e-mail de login ({usuario.email})
                </button>
              </div>
              <input
                type="email"
                value={emailContato}
                onChange={(e) => setEmailContato(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-medium"
                required
              />
            </div>

            {/* Outros Concursos e Cargos em que também está aprovado */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">
                    Outros Concursos e Cargos em que também está Aprovado
                  </h4>
                  <p className="text-2xs text-slate-500">
                    Permite mapear candidatos com múltiplas aprovações e projetar desistências
                  </p>
                </div>

                {onAbrirContatoAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onAbrirContatoAdmin('inclusao_concurso');
                    }}
                    className="text-2xs text-amber-700 hover:text-amber-900 font-bold bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Seu concurso não está na lista? Acione o admin
                  </button>
                )}
              </div>

              {/* Lista dos outros concursos já adicionados */}
              {outrosConcursos.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {outrosConcursos.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-slate-800">{c.concurso_nome}</span>
                        <span className="text-slate-400">({c.ano})</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-600">{c.cargo}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-teal-700 font-bold">{c.classificacao}º lugar</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoverOutroConcurso(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar novo concurso à lista */}
              <div className="p-3 bg-teal-50/40 border border-teal-100 rounded-xl space-y-2">
                <span className="text-2xs font-bold text-teal-800 block">Adicionar Outra Aprovação:</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <select
                      value={novoConcNome}
                      onChange={(e) => setNovoConcNome(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:border-teal-600 focus:outline-hidden"
                    >
                      <option value="">Selecione o concurso vigente...</option>
                      {concursosCadastrados.map((conc) => (
                        <option key={conc.id} value={conc.nome}>
                          {conc.nome} ({conc.ano})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Cargo aprovado"
                      value={novoConcCargo}
                      onChange={(e) => setNovoConcCargo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:border-teal-600 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      placeholder="Posição (ex: 5)"
                      value={novoConcPos}
                      onChange={(e) => setNovoConcPos(e.target.value)}
                      className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:border-teal-600 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleAdicionarOutroConcurso}
                      className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-bold py-1.5 px-2 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Incluir</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações Inferiores */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-2xs text-slate-400">
                Campos com asterisco (<span className="text-rose-500">*</span>) são obrigatórios
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Fechar
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {primeiroCadastro
                      ? 'Salvar Dados Iniciais'
                      : 'Submeter Alterações ao Administrador'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
