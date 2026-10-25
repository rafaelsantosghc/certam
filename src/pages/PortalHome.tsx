import React, { useState, useMemo } from 'react';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { useAuth } from '../store/authContext';
import { Concurso, Cargo, Candidato } from '../types';
import {
  Search,
  Plus,
  ArrowRight,
  Briefcase,
  LogIn,
  LogOut,
  Edit3,
  CheckCircle2,
  Phone,
  Mail,
  ShieldCheck,
  Building2,
  BookmarkCheck,
  Check,
  X,
  MapPin,
  ListOrdered,
} from 'lucide-react';

interface PortalHomeProps {
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => void;
}

export const PortalHome: React.FC<PortalHomeProps> = ({ onNavigate }) => {
  const {
    usuario,
    isAdmin,
    loginGoogle,
    loginAdminPreview,
    simularEmailCandidato,
    atualizarDadosUsuario,
    inscreverConcurso,
    desinscreverConcurso,
    logout,
  } = useAuth();

  const [concursos] = useState<Concurso[]>(() => certamStore.getConcursos());
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos'>('todos');

  // Modal de Atualização de Dados Gerais do Candidato
  const [modalDadosAberto, setModalDadosAberto] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formCpf, setFormCpf] = useState('');

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Abrir modal de dados gerais
  const abrirModalDados = () => {
    if (usuario) {
      setFormNome(usuario.nome || '');
      setFormEmail(usuario.email || '');
      setFormWhatsapp(usuario.whatsapp || usuario.telefone || '');
      setFormCpf(usuario.cpf || '');
      setModalDadosAberto(true);
    }
  };

  // Salvar atualização dos dados gerais do usuário/candidato
  const handleSalvarDados = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;

    atualizarDadosUsuario({
      nome: formNome.trim() || usuario.nome,
      email: formEmail.trim() || usuario.email,
      whatsapp: formWhatsapp.trim(),
      telefone: formWhatsapp.trim(),
      cpf: formCpf.trim(),
    });

    // Sincronizar nome/contato na lista oficial de candidatos se o usuário já estiver vinculado
    concursos.forEach((c) => {
      c.cargos?.forEach((cg) => {
        const cands = lotesStore.getCandidatos(c.id, cg.id);
        const match = cands.find(
          (cand) =>
            cand.id === usuario.candidato_id ||
            cand.email?.toLowerCase() === usuario.email?.toLowerCase() ||
            cand.email?.toLowerCase() === formEmail.trim().toLowerCase()
        );
        if (match) {
          lotesStore.salvarCandidato(c.id, cg.id, {
            ...match,
            nome: formNome.trim() || match.nome,
            whatsapp: formWhatsapp.trim() || match.whatsapp,
            cpf: formCpf.trim() || match.cpf,
          });
        }
      });
    });

    setModalDadosAberto(false);
    showToast('Dados cadastrais atualizados com sucesso!');
  };

  // Login rápido por email
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginNomeInput, setLoginNomeInput] = useState('');
  const [showEmailLoginForm, setShowEmailLoginForm] = useState(false);

  const handleLoginEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmailInput.trim()) return;
    simularEmailCandidato(
      loginEmailInput.trim(),
      loginNomeInput.trim() || loginEmailInput.split('@')[0]
    );
    setShowEmailLoginForm(false);
    setLoginEmailInput('');
    setLoginNomeInput('');
    showToast('Login realizado com sucesso!');
  };

  // Identificar quais concursos e cargos o candidato atual está cadastrado/inscrito
  const inscricoesCandidato = useMemo(() => {
    if (!usuario) return [];

    interface InscricaoItem {
      concurso: Concurso;
      cargo: Cargo;
      candidato?: Candidato;
      dataInscricao?: string;
    }

    const resultado: InscricaoItem[] = [];
    const inscricoesSet = new Set<string>();

    // 1. Procurar nas listas oficiais de candidatos por email ou candidato_id
    concursos.forEach((conc) => {
      conc.cargos?.forEach((cg) => {
        const cands = lotesStore.getCandidatos(conc.id, cg.id);
        const candEncontrado = cands.find(
          (c) =>
            (usuario.candidato_id && c.id === usuario.candidato_id) ||
            (usuario.email && c.email?.toLowerCase() === usuario.email.toLowerCase())
        );

        if (candEncontrado) {
          const key = `${conc.id}_${cg.id}`;
          if (!inscricoesSet.has(key)) {
            inscricoesSet.add(key);
            resultado.push({
              concurso: conc,
              cargo: cg,
              candidato: candEncontrado,
              dataInscricao: 'Homologação Oficial',
            });
          }
        }
      });
    });

    // 2. Incluir inscrições manuais registradas em usuario.concursos_inscritos
    if (usuario.concursos_inscritos && Array.isArray(usuario.concursos_inscritos)) {
      usuario.concursos_inscritos.forEach((insc) => {
        const conc = concursos.find((c) => c.id === insc.concurso_id);
        if (conc) {
          const cg = conc.cargos?.find((c) => c.id === insc.cargo_id);
          if (cg) {
            const key = `${conc.id}_${cg.id}`;
            if (!inscricoesSet.has(key)) {
              inscricoesSet.add(key);
              const cands = lotesStore.getCandidatos(conc.id, cg.id);
              const cand = cands.find(
                (c) =>
                  (usuario.candidato_id && c.id === usuario.candidato_id) ||
                  (usuario.email && c.email?.toLowerCase() === usuario.email.toLowerCase())
              );
              resultado.push({
                concurso: conc,
                cargo: cg,
                candidato: cand,
                dataInscricao: insc.data_inscricao || 'Cadastrado no portal',
              });
            }
          }
        }
      });
    }

    return resultado;
  }, [usuario, concursos]);

  // Lista filtrada de concursos disponíveis
  const concursosFiltrados = useMemo(() => {
    return concursos.filter((c) => {
      const matchTexto =
        !filtroTexto.trim() ||
        c.nome.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        c.orgao.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        c.cargos?.some((cg) => cg.nome.toLowerCase().includes(filtroTexto.toLowerCase()));

      const matchStatus = filtroStatus === 'todos' || c.status === 'ativo' || c.status === 'Convocando';

      return matchTexto && matchStatus;
    });
  }, [concursos, filtroTexto, filtroStatus]);

  return (
    <div className="space-y-8 max-w-[1880px] w-full mx-auto">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#07192B] text-white px-5 py-3 rounded-xl shadow-2xl border border-teal-400 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#2DD4AA] shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* CABEÇALHO DO PORTAL DO CANDIDATO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2DD4AA]/15 text-[#135A7A] text-xs font-semibold mb-2">
            <span>🏛️</span>
            <span>CERTAM • Portal do Candidato</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight font-serif">
            Portal do Candidato
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Acesse sua conta para atualizar seus dados de contato, acompanhe os concursos em que você está inscrito e consulte os certames cadastrados.
          </p>
        </div>

        {/* Acesso Admin */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('admin', { tab: 'concursos' })}
            className="inline-flex items-center gap-2 bg-[#07192B] hover:bg-[#0C2640] text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#2DD4AA]" />
            <span>Cadastrar Concurso</span>
          </button>
        </div>
      </div>

      {/* SEÇÃO 1: FAZER LOGIN & ATUALIZAR DADOS CADASTRAIS (DADOS GERAIS DO CANDIDATO) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 card-shadow p-5 sm:p-6">
        {!usuario ? (
          /* NÃO AUTENTICADO: FORMULÁRIO DE LOGIN DO CANDIDATO */
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-lg">
                  <LogIn className="w-5 h-5 text-[#135A7A]" />
                  <span>Acesse sua Conta de Candidato</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Faça login para gerenciar suas inscrições, salvar seus dados de contato e acompanhar suas colocações.
                </p>
              </div>

              {/* Ações de Login Rápido */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={loginGoogle}
                  className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-semibold px-4 py-2 rounded-xl text-xs border border-slate-300 shadow-2xs transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Entrar com Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowEmailLoginForm(!showEmailLoginForm)}
                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-600" />
                  <span>Entrar com E-mail</span>
                </button>

                <button
                  type="button"
                  onClick={loginAdminPreview}
                  className="inline-flex items-center gap-1.5 bg-[#07192B] hover:bg-[#0C2640] text-teal-300 font-semibold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Acesso Admin</span>
                </button>
              </div>
            </div>

            {/* Formulário retrátil de login por e-mail */}
            {showEmailLoginForm && (
              <form onSubmit={handleLoginEmailSubmit} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      value={loginNomeInput}
                      onChange={(e) => setLoginNomeInput(e.target.value)}
                      placeholder="Ex.: Mariana Duarte Becker"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2DD4AA]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      E-mail do Candidato *
                    </label>
                    <input
                      type="email"
                      required
                      value={loginEmailInput}
                      onChange={(e) => setLoginEmailInput(e.target.value)}
                      placeholder="Ex.: mariana.becker@gmail.com"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2DD4AA]"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEmailLoginForm(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#135A7A] hover:bg-[#0C2640] text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
                  >
                    Confirmar Login
                  </button>
                </div>
              </form>
            )}

            {/* Atalhos para testar com candidatos simulados */}
            <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap pt-1">
              <span className="font-medium">Acesso rápido para demonstração:</span>
              <button
                type="button"
                onClick={() => simularEmailCandidato('rafasms0@hotmail.com', 'Rafael Santos da Silva')}
                className="text-[#135A7A] hover:underline font-semibold bg-teal-50 px-2 py-0.5 rounded cursor-pointer"
              >
                Rafael Santos (1º Lugar)
              </button>
              <button
                type="button"
                onClick={() => simularEmailCandidato('mariana.becker@gmail.com', 'Mariana Duarte Becker')}
                className="text-[#135A7A] hover:underline font-semibold bg-teal-50 px-2 py-0.5 rounded cursor-pointer"
              >
                Mariana Becker (2º Lugar)
              </button>
            </div>
          </div>
        ) : (
          /* AUTENTICADO: CARD COM DADOS GERAIS DO CANDIDATO E BOTÃO ATUALIZAR */
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#07192B] text-[#2DD4AA] font-bold text-lg flex items-center justify-center shrink-0 shadow-xs">
                  {usuario.nome?.charAt(0) || 'C'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold font-serif text-slate-900">
                      {usuario.nome}
                    </h2>
                    {isAdmin ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#07192B] text-[#2DD4AA]">
                        ADMINISTRADOR
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                        CANDIDATO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{usuario.email}</span>
                  </p>
                </div>
              </div>

              {/* Botões de Ação do Perfil */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={abrirModalDados}
                  className="inline-flex items-center gap-2 bg-[#135A7A] hover:bg-[#0C2640] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-teal-300" />
                  <span>Atualizar Meus Dados</span>
                </button>

                <button
                  type="button"
                  onClick={loginGoogle}
                  title="Alternar usuário para demonstração"
                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <span>Alternar Perfil</span>
                </button>

                <button
                  type="button"
                  onClick={logout}
                  title="Desconectar do portal"
                  className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            </div>

            {/* Resumo Exclusivo de Dados Pessoais do Candidato (Sem dados específicos de concursos) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  E-mail de Notificação
                </span>
                <span className="font-semibold text-slate-800 mt-1 flex items-center gap-1 truncate" title={usuario.email}>
                  <Mail className="w-3 h-3 text-teal-600 shrink-0" />
                  <span className="truncate">{usuario.email}</span>
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  Telefone / WhatsApp
                </span>
                <span className="font-semibold text-slate-800 mt-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-teal-600 shrink-0" />
                  <span>{usuario.whatsapp || usuario.telefone || 'Não informado'}</span>
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  CPF Cadastrado
                </span>
                <span className="font-semibold text-slate-800 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-teal-600 shrink-0" />
                  <span>{usuario.cpf || 'Não informado'}</span>
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  Concursos Vinculados
                </span>
                <span className="font-semibold text-slate-800 mt-1 flex items-center gap-1">
                  <BookmarkCheck className="w-3 h-3 text-teal-600 shrink-0" />
                  <span>{inscricoesCandidato.length} certame(s)</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO 2: MEUS CONCURSOS INSCRITOS */}
      {usuario && (
        <div className="bg-white rounded-2xl border border-slate-200/90 card-shadow p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-teal-600" />
                <h2 className="text-base sm:text-lg font-bold font-serif text-slate-900">
                  Meus Concursos Inscritos
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 text-xs font-bold font-mono">
                  {inscricoesCandidato.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Concursos e cargos em que você está homologado ou inscrito para acompanhamento de vagas e lotações.
              </p>
            </div>
          </div>

          {inscricoesCandidato.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                Nenhum concurso vinculado no momento
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Você ainda não adicionou nenhum concurso à sua lista de acompanhamento. Escolha um dos certames disponíveis abaixo e clique em &quot;Acompanhar&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inscricoesCandidato.map((item) => (
                <div
                  key={`${item.concurso.id}_${item.cargo.id}`}
                  className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-teal-50/20 border border-teal-200/80 shadow-2xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#07192B] text-teal-300 text-xs font-bold font-mono uppercase">
                        {item.concurso.orgao} • {item.concurso.ano}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        {item.candidato?.status || 'Inscrito / Acompanhando'}
                      </span>
                    </div>

                    <div
                      onClick={() =>
                        onNavigate('concurso', {
                          concursoId: item.concurso.id,
                          cargoId: item.cargo.id,
                          tab: 'dashboard',
                        })
                      }
                      className="cursor-pointer group/title"
                      title="Clique para acessar a página inicial do concurso"
                    >
                      <h3 className="text-sm sm:text-base font-bold font-serif text-slate-900 group-hover/title:text-[#135A7A] transition-colors">
                        {item.concurso.nome}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-[#135A7A] font-semibold mt-1">
                        <Briefcase className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.cargo.nome}</span>
                      </div>
                    </div>

                    {/* Dados Específicos deste Cargo no Concurso */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">
                          Sua Classificação
                        </span>
                        <span className="font-bold text-[#135A7A] text-sm">
                          {item.candidato ? `${item.candidato.posicao}º Lugar` : 'Acompanhando'}
                        </span>
                        {item.candidato?.cota && (
                          <span className="text-[10px] text-slate-500 block">
                            Cota: {item.candidato.cota}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">
                          Comarcas do Cargo
                        </span>
                        {item.candidato?.comarca_desejada_1 ? (
                          <span className="font-semibold text-slate-800 text-xs truncate block" title={item.candidato.comarca_desejada_1}>
                            1ª Opção: {item.candidato.comarca_desejada_1}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic block">
                            Pendente de escolha
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 block">
                          {item.candidato?.intencao ? `Intenção: ${item.candidato.intencao}` : 'Intenção: Não informada'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações Específicas para o Concurso / Cargo */}
                  <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        desinscreverConcurso(item.concurso.id, item.cargo.id)
                      }
                      className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      Remover
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('concurso', {
                            concursoId: item.concurso.id,
                            cargoId: item.cargo.id,
                            tab: 'classificacao',
                          })
                        }
                        title="Ver classificação completa e notas"
                        className="text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <ListOrdered className="w-3.5 h-3.5 text-slate-500" />
                        <span>Ranking</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('concurso', {
                            concursoId: item.concurso.id,
                            cargoId: item.cargo.id,
                            tab: 'candidato',
                          })
                        }
                        title="Acessar aba do cargo para indicar comarcas de interesse e intenção de posse"
                        className="text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-[#135A7A] border border-teal-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-teal-600" />
                        <span>Definir Comarcas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('concurso', {
                            concursoId: item.concurso.id,
                            cargoId: item.cargo.id,
                            tab: 'dashboard',
                          })
                        }
                        title="Acessar a página inicial deste concurso"
                        className="text-xs font-bold bg-[#135A7A] hover:bg-[#0C2640] text-white px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <span>Acessar Concurso</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 3: CONCURSOS CADASTRADOS NO SITE (DIRETÓRIO) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-slate-900">
              Concursos Cadastrados no Site
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Consulte os certames disponíveis no CERTAM, selecione o concurso desejado para acessar seus cargos e definir suas preferências de lotação.
            </p>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 card-shadow space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Pesquisar por órgão, concurso ou cargo cadastrado..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2DD4AA]"
              />
            </div>

            {/* Filtros por Status */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/60 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setFiltroStatus('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  filtroStatus === 'todos'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('ativos')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  filtroStatus === 'ativos'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                Ativos
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Exibindo <strong>{concursosFiltrados.length}</strong> concurso(s)
            </span>
            {filtroTexto && (
              <button
                type="button"
                onClick={() => setFiltroTexto('')}
                className="text-[#135A7A] hover:underline font-semibold cursor-pointer"
              >
                Limpar filtros de busca
              </button>
            )}
          </div>
        </div>

        {/* GRID DE CARDS DOS CONCURSOS CADASTRADOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {concursosFiltrados.map((concurso) => (
            <div
              key={concurso.id}
              className="bg-white rounded-2xl border border-slate-200/90 card-shadow card-shadow-hover overflow-hidden flex flex-col justify-between"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-[#135A7A] text-xs font-bold font-mono uppercase">
                    {concurso.orgao} • {concurso.ano}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {concurso.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold font-serif text-slate-900 leading-snug">
                    {concurso.nome}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {concurso.descricao}
                  </p>
                </div>

                {/* Cargos cadastrados deste concurso */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                    Cargos Disponíveis ({concurso.cargos?.length || 0})
                  </span>
                  <div className="space-y-1.5">
                    {concurso.cargos?.map((cargo) => {
                      const estaInscrito =
                        usuario?.concursos_inscritos?.some(
                          (i) => i.concurso_id === concurso.id && i.cargo_id === cargo.id
                        ) ||
                        inscricoesCandidato.some(
                          (i) => i.concurso.id === concurso.id && i.cargo.id === cargo.id
                        );

                      return (
                        <div
                          key={cargo.id}
                          className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-teal-300 transition-all flex items-center justify-between group"
                        >
                          <div
                            onClick={() =>
                              onNavigate('concurso', {
                                concursoId: concurso.id,
                                cargoId: cargo.id,
                                tab: 'dashboard',
                              })
                            }
                            className="min-w-0 pr-2 cursor-pointer flex-1"
                          >
                            <div className="flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5 text-[#135A7A] shrink-0" />
                              <span className="text-xs font-bold text-slate-800 truncate group-hover:text-teal-900">
                                {cargo.nome}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 ml-5 block">
                              Nível {cargo.nivel} • {cargo.vagas_imediatas} vagas {cargo.tem_cr ? '+ CR' : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {usuario && (
                              <button
                                type="button"
                                title={estaInscrito ? 'Inscrito neste cargo' : 'Acompanhar este cargo'}
                                onClick={() => {
                                  if (estaInscrito) {
                                    desinscreverConcurso(concurso.id, cargo.id);
                                    showToast('Inscrição removida do cargo.');
                                  } else {
                                    inscreverConcurso(concurso.id, cargo.id);
                                    showToast('Cargo adicionado às suas inscrições!');
                                  }
                                }}
                                className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                                  estaInscrito
                                    ? 'bg-teal-100 text-teal-800 hover:bg-rose-100 hover:text-rose-700'
                                    : 'bg-white hover:bg-teal-50 text-slate-600 hover:text-teal-800 border border-slate-200'
                                }`}
                              >
                                {estaInscrito ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                onNavigate('concurso', {
                                  concursoId: concurso.id,
                                  cargoId: cargo.id,
                                  tab: 'dashboard',
                                })
                              }
                              className="p-1.5 text-slate-400 group-hover:text-teal-700 cursor-pointer"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Rodapé do Card com Entrada para a Página do Concurso */}
              <div className="bg-slate-50/80 p-3.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">
                  {concurso.cargos?.length || 0} cargo(s) cadastrado(s)
                </span>

                <button
                  type="button"
                  onClick={() =>
                    onNavigate('concurso', {
                      concursoId: concurso.id,
                      cargoId: concurso.cargos?.[0]?.id || 'geral',
                      tab: 'dashboard',
                    })
                  }
                  className="text-xs font-bold bg-[#135A7A] hover:bg-[#0C2640] text-white px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Acessar Concurso</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: ATUALIZAR DADOS CADASTRAIS (DADOS GERAIS) */}
      {modalDadosAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#135A7A]" />
                <h3 className="text-lg font-bold font-serif text-slate-900">
                  Atualizar Dados Cadastrais
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalDadosAberto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarDados} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  E-mail do Candidato
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="text"
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    placeholder="(51) 99999-9999"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2DD4AA]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    CPF (para conferência)
                  </label>
                  <input
                    type="text"
                    value={formCpf}
                    onChange={(e) => setFormCpf(e.target.value)}
                    placeholder="***.000.000-**"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2DD4AA]"
                  />
                </div>
              </div>

              {/* Informação contextual sobre escolhas de comarcas e intenção */}
              <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-slate-700 space-y-1">
                <span className="font-bold text-[#135A7A] block">
                  ℹ️ Comarcas e Intenção de Posse
                </span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  As preferências de comarcas, ordenação de prioridade e manifestação de intenção de posse são preenchidas individualmente na página de cada cargo/concurso, garantindo que suas escolhas sejam específicas para o certame desejado.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalDadosAberto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#135A7A] hover:bg-[#0C2640] text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
