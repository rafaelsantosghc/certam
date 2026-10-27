import React, { useState, useMemo } from 'react';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { useAuth } from '../store/authContext';
import { Concurso, Cargo, Candidato } from '../types';
import { PerfilCandidatoModal } from '../components/PerfilCandidatoModal';
import { ContatoAdminModal } from '../components/ContatoAdminModal';
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
  Calendar,
  Layers,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';

interface PortalHomeProps {
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => void;
}

export const PortalHome: React.FC<PortalHomeProps> = ({ onNavigate }) => {
  const {
    usuario,
    isAdmin,
    loginGoogle,
    loginAdmin,
    loginCandidato,
    simularEmailCandidato,
    inscreverConcurso,
    desinscreverConcurso,
    logout,
  } = useAuth();

  const [concursos, setConcursos] = useState<Concurso[]>(() => certamStore.getConcursos());
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<
    'todos' | 'em_andamento' | 'homologados' | 'previstos' | 'encerrados'
  >('todos');
  const [filtroRegiao, setFiltroRegiao] = useState<string>('todas');

  // Modais
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const [modalContatoAberto, setModalContatoAberto] = useState(false);
  const [motivoContato, setMotivoContato] = useState<any>('inclusao_concurso');

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Inscrições vinculadas ao candidato atual
  const inscricoesCandidato = useMemo(() => {
    if (!usuario) return [];
    const resultado: {
      concurso: Concurso;
      cargo: Cargo;
      candidato?: Candidato;
      dataInscricao: string;
    }[] = [];

    const inscricoesSet = new Set<string>();

    concursos.forEach((conc) => {
      conc.cargos?.forEach((cg) => {
        const cands = lotesStore.getCandidatos(conc.id, cg.id);
        const candEncontrado = cands.find(
          (c) =>
            (usuario.candidato_id && c.id === usuario.candidato_id) ||
            (usuario.email && c.email?.toLowerCase() === usuario.email.toLowerCase()) ||
            (usuario.cpf && c.cpf && c.cpf.replace(/\D/g, '') === usuario.cpf.replace(/\D/g, '')) ||
            (usuario.nome && c.nome.toLowerCase() === usuario.nome.toLowerCase())
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

  // Filtros de Concursos: Status e Região
  const concursosFiltrados = useMemo(() => {
    return concursos.filter((c) => {
      const matchTexto =
        !filtroTexto.trim() ||
        c.nome.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        c.orgao.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        c.cargos?.some((cg) => cg.nome.toLowerCase().includes(filtroTexto.toLowerCase()));

      let matchStatus = true;
      if (filtroStatus === 'em_andamento') {
        matchStatus = c.status === 'ativo' || c.status === 'Convocando';
      } else if (filtroStatus === 'homologados') {
        matchStatus = c.homologado || c.status === 'Homologado';
      } else if (filtroStatus === 'previstos') {
        matchStatus = c.status === 'previsto' || c.status === 'Inscrições Abertas';
      } else if (filtroStatus === 'encerrados') {
        matchStatus = c.status === 'encerrado';
      }

      const matchRegiao = filtroRegiao === 'todas' || c.regiao === filtroRegiao;

      return matchTexto && matchStatus && matchRegiao;
    });
  }, [concursos, filtroTexto, filtroStatus, filtroRegiao]);

  return (
    <div className="space-y-8 max-w-[1880px] w-full mx-auto">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#07192B] text-white px-5 py-3 rounded-xl shadow-2xl border border-teal-400 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-[#2DD4AA] shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* CABEÇALHO DO PORTAL CERTAM */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2DD4AA]/15 text-[#135A7A] text-xs font-semibold mb-2">
            <span>🏛️</span>
            <span>CERTAM • Portal do Concurseiro do Brasil</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight font-serif">
            Acompanhamento de Concursos & Nomeações
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Consulte cronogramas oficiais em linha do tempo, rankings de classificação, quantitativo de cargos vagos, comunicados e preferências de comarcas.
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMotivoContato('inclusao_concurso');
              setModalContatoAberto(true);
            }}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold px-3.5 py-2.5 rounded-xl text-xs border border-slate-300 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-teal-600" />
            <span>Sugerir Concurso / Cargo</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('admin', { tab: 'concursos' })}
              className="inline-flex items-center gap-2 bg-[#07192B] hover:bg-[#0C2640] text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#2DD4AA]" />
              <span>Novo Concurso (Admin)</span>
            </button>
          )}
        </div>
      </div>

      {/* SEÇÃO 1: PERFIL DO CANDIDATO / LOGIN */}
      <div className="bg-white rounded-2xl border border-slate-200/90 card-shadow p-5 sm:p-6">
        {!usuario ? (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-serif font-bold text-lg">
                  <LogIn className="w-5 h-5 text-[#135A7A]" />
                  <span>Acesse sua conta de concurseiro</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Identifique-se com sua conta Google para vincular seu CPF ao cadastro geral, acessar chats de aprovados e simular escolhas de comarcas.
                </p>
              </div>

              {/* Botão de Acesso Exclusivo Google */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loginGoogle()}
                  className="inline-flex items-center gap-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold px-5 py-2.5 rounded-xl text-xs border border-slate-300 shadow-sm transition-all cursor-pointer hover:border-teal-500"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Entrar com o Google</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* USUÁRIO AUTENTICADO */
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-xs text-white uppercase relative ${
                    isAdmin ? 'bg-amber-600 border-2 border-amber-300' : 'bg-[#135A7A] border-2 border-teal-500'
                  }`}
                >
                  {usuario.nome ? usuario.nome.slice(0, 2) : 'US'}
                  {usuario.cpf_verificado && (
                    <span
                      className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] text-white"
                      title="CPF Verificado no Cadastro Geral"
                    >
                      ✓
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold font-serif text-slate-900">
                      Olá, {usuario.nome}!
                    </h2>
                    {usuario.cpf_verificado ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        CPF Vinculado
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        Cadastro em Validação
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {usuario.email_contato || usuario.email} · WhatsApp: {usuario.whatsapp || 'Não informado'} · CPF: {usuario.cpf || 'Pendente'}
                  </p>
                </div>
              </div>

              {/* Ações do Usuário */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalPerfilAberto(true)}
                  className="inline-flex items-center gap-1.5 bg-[#135A7A] hover:bg-[#0C2640] text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-teal-300" />
                  <span>Editar Meu Cadastro (Auditado)</span>
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            </div>

            {/* Aviso de Preenchimento Inicial caso falte CPF */}
            {!usuario.cpf && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800">
                <span>
                  <strong>Atenção:</strong> Preencha seu CPF e data de nascimento para cruzar seus dados automaticamente com a lista de aprovados e liberar o acesso aos chats de comarcas.
                </span>
                <button
                  type="button"
                  onClick={() => setModalPerfilAberto(true)}
                  className="font-bold underline text-amber-900 shrink-0 cursor-pointer"
                >
                  Completar agora
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SEÇÃO 2: MEUS CONCURSOS VINCULADOS */}
      {usuario && inscricoesCandidato.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 card-shadow p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-teal-600" />
              <h2 className="text-base sm:text-lg font-bold font-serif text-slate-900">
                Meus Concursos em Acompanhamento
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 text-xs font-bold font-mono">
                {inscricoesCandidato.length}
              </span>
            </div>
          </div>

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

                  <div>
                    <h3 className="text-sm sm:text-base font-bold font-serif text-slate-900">
                      {item.concurso.nome}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-[#135A7A] font-semibold mt-1">
                      <Briefcase className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.cargo.nome}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">
                        Classificação
                      </span>
                      <span className="font-bold text-[#135A7A] text-sm font-mono">
                        {item.candidato ? `${item.candidato.posicao}º lugar` : 'Acompanhando'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">
                        Comarca Preferencial
                      </span>
                      <span className="font-semibold text-slate-800 text-xs truncate block">
                        {item.candidato?.comarca_desejada_1 || 'Pendente de escolha'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Links Diretos */}
                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => desinscreverConcurso(item.concurso.id, item.cargo.id)}
                    className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold cursor-pointer"
                  >
                    Remover
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate('concurso', {
                          concursoId: item.concurso.id,
                          cargoId: item.cargo.id,
                          tab: 'classificacao',
                        })
                      }
                      className="text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <ListOrdered className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ranking</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onNavigate('concurso_geral', {
                          concursoId: item.concurso.id,
                        })
                      }
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
        </div>
      )}

      {/* SEÇÃO 3: DIRETÓRIO DE CONCURSOS CADASTRADOS (COM FILTROS COMPLETOS) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-slate-900">
            Concursos Cadastrados no Portal
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Consulte os certames oficiais em andamento, homologados e previstos. Navegue diretamente pelos cargos e lotes específicos.
          </p>
        </div>

        {/* BARRA DE FILTROS */}
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
                placeholder="Pesquisar por órgão, concurso ou cargo (ex: TJRS, MPRS, Analista, Técnico)..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-[#2DD4AA]"
              />
            </div>

            {/* Filtro por Região */}
            <select
              value={filtroRegiao}
              onChange={(e) => setFiltroRegiao(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden"
            >
              <option value="todas">Todas as Regiões</option>
              <option value="Sul">Região Sul (RS, SC, PR)</option>
              <option value="Sudeste">Região Sudeste</option>
              <option value="Nacional">Nacional / Federal</option>
            </select>

            {/* Filtros por Status */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/60 overflow-x-auto shrink-0">
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
                onClick={() => setFiltroStatus('em_andamento')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  filtroStatus === 'em_andamento'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                Em Andamento
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('homologados')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  filtroStatus === 'homologados'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                Homologados
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('previstos')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  filtroStatus === 'previstos'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                Previstos para Abrir
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('encerrados')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  filtroStatus === 'encerrados'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                Encerrados
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
                className="text-teal-700 font-bold hover:underline cursor-pointer"
              >
                Limpar busca
              </button>
            )}
          </div>
        </div>

        {/* LISTAGEM DOS CONCURSOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {concursosFiltrados.map((conc) => {
            const cargosAtivos = conc.cargos?.filter((cg) => cg.ativo) || [];

            return (
              <div
                key={conc.id}
                className="bg-white rounded-2xl border border-slate-200 card-shadow p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-teal-500/50 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#07192B] text-teal-300 text-xs font-bold font-mono uppercase">
                        {conc.orgao} • {conc.ano}
                      </span>
                      <span className="text-2xs font-semibold text-slate-500">{conc.esfera}</span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        conc.homologado || conc.status === 'Homologado'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : conc.status === 'Convocando'
                          ? 'bg-amber-50 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {conc.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-bold font-serif text-slate-900 leading-snug">
                      {conc.nome}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {conc.descricao}
                    </p>
                  </div>

                  {/* Cargos deste Concurso com Links Diretos */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block">
                      Cargos Disponíveis ({cargosAtivos.length})
                    </span>

                    <div className="space-y-1.5">
                      {cargosAtivos.map((cg) => (
                        <div
                          key={cg.id}
                          onClick={() =>
                            onNavigate('concurso', {
                              concursoId: conc.id,
                              cargoId: cg.id,
                              tab: 'dashboard',
                            })
                          }
                          className="p-2.5 bg-slate-50 hover:bg-teal-50/50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs cursor-pointer group transition-all"
                          title={`Acessar página do cargo ${cg.nome}`}
                        >
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700" />
                            <span className="font-semibold text-slate-800 group-hover:text-teal-900">
                              {cg.nome}
                            </span>
                            <span className="text-[10px] text-slate-400">({cg.nivel})</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {cg.vagas_reais_abertas && (
                              <span className="text-[10px] font-mono font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                                {cg.vagas_reais_abertas} vagas abertas
                              </span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rodapé do Card do Concurso com Ações de Acesso */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate('concurso', {
                          concursoId: conc.id,
                          cargoId: cargosAtivos[0]?.id || 'geral',
                          tab: 'cronograma',
                        })
                      }
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      <span>Cronograma</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onNavigate('lote', {
                          concursoId: conc.id,
                          cargoId: cargosAtivos[0]?.id || 'geral',
                        })
                      }
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-teal-600" />
                      <span>Lotes</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('concurso_geral', {
                        concursoId: conc.id,
                      })
                    }
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    <span>Acessar Concurso</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modais da Home */}
      <PerfilCandidatoModal
        aberto={modalPerfilAberto}
        onClose={() => setModalPerfilAberto(false)}
        onAbrirContatoAdmin={() => {
          setMotivoContato('inclusao_concurso');
          setModalContatoAberto(true);
        }}
      />

      <ContatoAdminModal
        aberto={modalContatoAberto}
        onClose={() => setModalContatoAberto(false)}
        motivoInicial={motivoContato}
      />
    </div>
  );
};
