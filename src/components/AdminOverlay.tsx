import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { isDebugMode } from '../utils/environment';
import { useAuth } from '../store/authContext';
import { useNotifications } from '../store/notificationContext';
import { auditStore } from '../store/auditStore';
import { notificationStore } from '../store/notificationStore';
import { lotesStore } from '../store/lotesStore';
import { ModalAdicionarCandidatoAdmin } from './ModalAdicionarCandidatoAdmin';
import { ModalGerenciarDropdowns } from './ModalGerenciarDropdowns';
import {
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  UserPlus,
  SlidersHorizontal,
  FileText,
  Briefcase,
  Bell,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ClipboardList,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Layers,
} from 'lucide-react';

interface AdminOverlayProps {
  onNavigate?: (view: string, params?: any) => void;
  concursoAtualId?: string;
  cargoAtualId?: string;
}

export const AdminOverlay: React.FC<AdminOverlayProps> = ({
  onNavigate,
  concursoAtualId = 'tjrs_2025',
  cargoAtualId = 'analista_judiciario',
}) => {
  const { usuario, isAdmin, alternarModoAdminPreview, loginAdminPreview } = useAuth();
  const { dispararNotificacao, exibirToast } = useNotifications();
  
  // Aberto por padrão no preview para que o usuário localize o painel imediatamente
  const [expandido, setExpandido] = useState(() => {
    try {
      return sessionStorage.getItem('certam_admin_overlay_minimized') !== 'true';
    } catch {
      return true;
    }
  });

  // Escuta evento global para abrir o painel de testes pelo cabeçalho
  useEffect(() => {
    const handleAbrir = () => {
      setExpandido(true);
      try {
        sessionStorage.removeItem('certam_admin_overlay_minimized');
      } catch {}
    };
    window.addEventListener('certam_abrir_admin_overlay', handleAbrir);
    return () => window.removeEventListener('certam_abrir_admin_overlay', handleAbrir);
  }, []);

  const alternarMinimizar = (novoEstado: boolean) => {
    setExpandido(novoEstado);
    try {
      if (!novoEstado) {
        sessionStorage.setItem('certam_admin_overlay_minimized', 'true');
      } else {
        sessionStorage.removeItem('certam_admin_overlay_minimized');
      }
    } catch {}
  };

  // Modais administrativos rápidos acessíveis via overlay
  const [modalAdicionarCandidato, setModalAdicionarCandidato] = useState(false);
  const [modalDropdowns, setModalDropdowns] = useState(false);

  // Monitorar solicitações de auditoria pendentes
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState<number>(() => {
    const requests = auditStore.getAuditRequests();
    return requests.filter((r) => r.status === 'pendente').length;
  });

  useEffect(() => {
    const handleAuditUpdate = () => {
      const requests = auditStore.getAuditRequests();
      setSolicitacoesPendentes(requests.filter((r) => r.status === 'pendente').length);
    };

    window.addEventListener('certam_audit_updated', handleAuditUpdate);
    window.addEventListener('certam_audit_approved', handleAuditUpdate);
    window.addEventListener('storage', handleAuditUpdate);

    return () => {
      window.removeEventListener('certam_audit_updated', handleAuditUpdate);
      window.removeEventListener('certam_audit_approved', handleAuditUpdate);
      window.removeEventListener('storage', handleAuditUpdate);
    };
  }, []);

  // Renderiza EXCLUSIVAMENTE no visualizador do Google AI Studio (isDebugMode)
  if (!isDebugMode()) {
    return null;
  }

  const handleDispararNotificacaoTeste = (tipo: 'info' | 'sucesso' | 'alerta') => {
    const dataHoraAtual =
      new Date().toLocaleDateString('pt-BR') +
      ' ' +
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (tipo === 'sucesso') {
      exibirToast({
        id: `notif-teste-sucesso-${Date.now()}`,
        data_hora: dataHoraAtual,
        destinatario_papel: 'candidato',
        destinatario_email: usuario?.email || 'cand.aprovado@exemplo.com',
        destinatario_nome: usuario?.nome || 'Candidato Teste',
        titulo: 'Alteração Cadastral Deferida (Teste)',
        mensagem:
          'Sua solicitação de atualização cadastral (Nome e CPF) foi deferida pela moderação e consolidada no portal.',
        tipo: 'aprovacao_perfil',
        urgente: false,
      });
    } else if (tipo === 'alerta') {
      exibirToast({
        id: `notif-teste-alerta-${Date.now()}`,
        data_hora: dataHoraAtual,
        destinatario_papel: 'candidato',
        destinatario_email: usuario?.email || 'cand.aprovado@exemplo.com',
        destinatario_nome: usuario?.nome || 'Candidato Teste',
        titulo: 'Alteração Cadastral Indeferida (Teste)',
        mensagem:
          'Sua solicitação de alteração cadastral foi indeferida pela moderação. Acesse seu perfil para revisar.',
        tipo: 'indeferimento_perfil',
        urgente: true,
        motivo_justificativa: 'Documento comprobatório ilegível ou divergência de dígitos no CPF informado.',
      });
    } else {
      exibirToast({
        id: `notif-teste-info-${Date.now()}`,
        data_hora: dataHoraAtual,
        destinatario_papel: 'todos',
        titulo: 'Novo Comunicado da Banca Examinadora (Teste)',
        mensagem:
          'Publicada a retificação do cronograma de heteroidentificação e perícia médica para o próximo lote de convocação.',
        tipo: 'convocacao',
        urgente: false,
        link_destino: `/?id=${concursoAtualId}&cargo=${cargoAtualId}&tab=documentos`,
      });
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="fixed bottom-5 right-5 z-[999999] select-none font-sans no-print">
        {/* Painel Lateral Retrátil Flutuante */}
        {expandido ? (
          <aside 
            aria-label="Painel de Testes do Administrador"
            className="w-80 sm:w-96 bg-[#07192B]/98 text-white rounded-2xl border-2 border-teal-500/60 shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 ring-4 ring-teal-500/10"
          >
            {/* Header do Overlay */}
            <div className="p-3.5 bg-[#0C2640] border-b border-teal-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold font-serif text-white flex items-center gap-1.5">
                    Modo Admin • Preview AI Studio
                  </h3>
                  <p className="text-[10px] text-teal-400 font-mono">
                    {isAdmin ? '● Privilégios Ativos' : '○ Modo Candidato / Visitante'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => alternarMinimizar(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Minimizar painel de testes"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Painel */}
            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto text-xs divide-y divide-slate-800">
              {/* Seção 1: Toggle de Modo Admin */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Alternar Papel no Preview
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      isAdmin
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {isAdmin ? 'ADMIN ATIVO' : 'CANDIDATO'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => alternarModoAdminPreview()}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                    isAdmin
                      ? 'bg-amber-600/90 hover:bg-amber-500 text-white border border-amber-400/40'
                      : 'bg-[#2DD4AA] hover:bg-[#20BE96] text-slate-950 border border-teal-300'
                  }`}
                >
                  {isAdmin ? (
                    <>
                      <ToggleRight className="w-4 h-4" />
                      <span>Desativar Modo Administrador</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4" />
                      <span>Ativar Modo Administrador</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Ativa a visualização imediata de todos os botões de edição de abas, listas, tabelas e quantitativos.
                </p>
              </div>

              {/* Seção 2: Testes de Notificação Toast (5 Segundos) */}
              <div className="pt-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-teal-400" />
                    Testar Resumo Toast (5s no topo)
                  </span>
                  <span className="text-[9px] font-mono text-teal-400/80 bg-teal-500/10 px-1.5 py-0.5 rounded">
                    5 Segundos
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDispararNotificacaoTeste('sucesso')}
                    className="p-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 font-semibold text-[10px] text-center transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-400" />
                    <span>Deferido (Verde)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDispararNotificacaoTeste('alerta')}
                    className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 font-semibold text-[10px] text-center transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5 mx-auto mb-1 text-rose-400" />
                    <span>Indeferido (Rosa)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDispararNotificacaoTeste('info')}
                    className="p-2 rounded-lg bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 border border-teal-500/30 font-semibold text-[10px] text-center transition-colors cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 mx-auto mb-1 text-teal-400" />
                    <span>Informativo (Azul)</span>
                  </button>
                </div>
              </div>

              {/* Seção 3: Controles de Edição de Abas e Listas */}
              <div className="pt-3.5 space-y-2">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-400" />
                  Ações de Edição do Administrador
                </span>

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdmin) loginAdminPreview();
                      setModalAdicionarCandidato(true);
                    }}
                    className="w-full text-left p-2 rounded-lg bg-[#0C2640] hover:bg-[#12365B] text-slate-200 border border-slate-700/60 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <UserPlus className="w-3.5 h-3.5 text-[#2DD4AA]" />
                      Adicionar Candidato na Classificação
                    </span>
                    <span className="text-2xs text-teal-400">Novo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdmin) loginAdminPreview();
                      setModalDropdowns(true);
                    }}
                    className="w-full text-left p-2 rounded-lg bg-[#0C2640] hover:bg-[#12365B] text-slate-200 border border-slate-700/60 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                      Gerenciar Listas Suspensas (Dropdowns)
                    </span>
                    <span className="text-2xs text-amber-400">Opções</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdmin) loginAdminPreview();
                      if (onNavigate) {
                        onNavigate('concurso', {
                          concursoId: concursoAtualId,
                          cargoId: cargoAtualId,
                          tab: 'documentos',
                        });
                      }
                    }}
                    className="w-full text-left p-2 rounded-lg bg-[#0C2640] hover:bg-[#12365B] text-slate-200 border border-slate-700/60 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                      Aba: Documentos Oficiais (Editais)
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdmin) loginAdminPreview();
                      if (onNavigate) {
                        onNavigate('concurso', {
                          concursoId: concursoAtualId,
                          cargoId: cargoAtualId,
                          tab: 'vagas',
                        });
                      }
                    }}
                    className="w-full text-left p-2 rounded-lg bg-[#0C2640] hover:bg-[#12365B] text-slate-200 border border-slate-700/60 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                      Aba: Quadro de Vagas e Quantitativos
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdmin) loginAdminPreview();
                      if (onNavigate) {
                        onNavigate('admin');
                      }
                    }}
                    className="w-full text-left p-2 rounded-lg bg-[#0C2640] hover:bg-[#12365B] text-slate-200 border border-slate-700/60 flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <ClipboardList className="w-3.5 h-3.5 text-teal-300" />
                      Painel do Administrador Geral
                    </span>
                    {solicitacoesPendentes > 0 ? (
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-rose-500 text-white">
                        {solicitacoesPendentes} pendente{solicitacoesPendentes > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Rodapé Informativo */}
            <div className="px-4 py-2.5 bg-[#0C2640]/90 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1 text-teal-400">
                <Sparkles className="w-3 h-3" />
                Exclusivo Google AI Studio
              </span>
              <span>v8.2 Preview</span>
            </div>
          </aside>
        ) : (
          /* Botão Flutuante Compacto */
          <button
            type="button"
            onClick={() => setExpandido(true)}
            className="flex items-center gap-2.5 bg-[#0C2640]/95 hover:bg-[#07192B] text-white px-3.5 py-2.5 rounded-2xl shadow-2xl border-2 border-teal-500/40 backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95 group"
            title="Abrir Painel de Testes do Administrador no Preview"
          >
            <div className="relative">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  isAdmin ? 'bg-emerald-500 text-slate-950' : 'bg-teal-500/20 text-[#2DD4AA]'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0C2640] ${
                  isAdmin ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
            </div>

            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                <span>Modo Admin</span>
                <span
                  className={`text-[9px] font-mono font-bold px-1 rounded ${
                    isAdmin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {isAdmin ? 'ATIVO' : 'PREVIEW'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {solicitacoesPendentes > 0
                  ? `${solicitacoesPendentes} auditoria(s)`
                  : 'Controles de teste'}
              </p>
            </div>

            <ChevronUp className="w-4 h-4 text-teal-400 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        )}
      </div>

      {/* Modais Administrativos Rápido */}
      {modalAdicionarCandidato && (
        <ModalAdicionarCandidatoAdmin
          aberto={modalAdicionarCandidato}
          concursoId={concursoAtualId}
          cargoId={cargoAtualId}
          proximaPosicao={lotesStore.getCandidatos(concursoAtualId, cargoAtualId).length + 1}
          onAdicionar={(cand) => {
            lotesStore.salvarCandidato(concursoAtualId, cargoAtualId, cand);
            setModalAdicionarCandidato(false);
          }}
          onFechar={() => setModalAdicionarCandidato(false)}
        />
      )}

      {modalDropdowns && (
        <ModalGerenciarDropdowns
          aberto={modalDropdowns}
          onFechar={() => setModalDropdowns(false)}
        />
      )}
    </>,
    document.body
  );
};
