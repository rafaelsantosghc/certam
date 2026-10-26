import React, { useState } from 'react';
import { useAuth } from '../store/authContext';
import { NotificationBell } from './NotificationBell';
import { PerfilCandidatoModal } from './PerfilCandidatoModal';
import { ContatoAdminModal } from './ContatoAdminModal';
import { MensagensPrivadasDrawer } from './MensagensPrivadasDrawer';
import {
  Menu,
  Share2,
  Settings,
  Check,
  User,
  MessageSquare,
  MessageCircle,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  breadcrumbs: { label: string; onClick?: () => void }[];
  onNavigateAdmin?: () => void;
  showAdminShortcut?: boolean;
  onNavigate?: (view: string, params?: any) => void;
  concursoAtualId?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  breadcrumbs,
  onNavigateAdmin,
  showAdminShortcut = true,
  onNavigate,
  concursoAtualId,
}) => {
  const { usuario, isAdmin, loginGoogle } = useAuth();
  const [copiado, setCopiado] = useState(false);

  // Modais do Cabeçalho
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const [modalContatoAberto, setModalContatoAberto] = useState(false);
  const [modalDmAberto, setModalDmAberto] = useState(false);
  const [motivoContatoInicial, setMotivoContatoInicial] = useState<any>('duvida');

  const handleCopiarLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleAbrirContato = (motivo: any = 'duvida') => {
    setMotivoContatoInicial(motivo);
    setModalContatoAberto(true);
  };

  return (
    <>
      <header className="h-[68px] sm:h-[76px] bg-white border-b border-slate-200 sticky top-0 z-30 card-shadow flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0">
        {/* Esquerda: Hamburger Mobile e Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-slate-500 overflow-hidden truncate">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-300">/</span>}
                {crumb.onClick ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="hover:text-slate-900 transition-colors truncate cursor-pointer text-left font-medium"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-slate-900 font-bold truncate">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Direita: Ações, Sininho de Notificações, Mensagens, Fale com Admin e Perfil */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Fale com o Administrador */}
          <button
            type="button"
            onClick={() => handleAbrirContato('duvida')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Fale com a coordenação do portal"
          >
            <HelpCircle className="w-3.5 h-3.5 text-teal-600" />
            <span>Fale com o Admin</span>
          </button>

          {/* Compartilhar Link */}
          <button
            type="button"
            onClick={handleCopiarLink}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Copiar link"
          >
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiado ? 'Copiado!' : 'Compartilhar'}</span>
          </button>

          {/* Central de Notificações Internas */}
          <NotificationBell onNavigate={onNavigate} concursoAtualId={concursoAtualId} />

          {/* Mensagens Privadas (1 a 1) para candidatos autenticados */}
          {usuario && (
            <button
              type="button"
              onClick={() => setModalDmAberto(true)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer relative"
              title="Mensagens Privadas entre candidatos"
            >
              <MessageCircle className="w-5 h-5 text-[#135A7A]" />
            </button>
          )}

          {/* Botão Admin (Apenas para Administrador Autenticado) */}
          {isAdmin && showAdminShortcut && (
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer border border-amber-500/50"
              title="Abrir Gestão de Concursos, Auditoria e Validações"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Painel Admin</span>
            </button>
          )}

          {/* Autenticação / Perfil do Candidato */}
          {!usuario ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={loginGoogle}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-semibold px-3 py-1.5 rounded-xl text-xs border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Entrar com Google</span>
              </button>
            </div>
          ) : (
            <div
              onClick={() => setModalPerfilAberto(true)}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="Clique para gerenciar seu cadastro e dados auditados"
            >
              <div className="text-right hidden sm:block">
                <span className="block text-xs font-bold text-slate-800 leading-tight">
                  {usuario.nome}
                </span>
                <span className="text-[11px] font-mono text-slate-500 max-w-[130px] truncate block">
                  {usuario.email_contato || usuario.email}
                </span>
              </div>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs text-white uppercase relative ${
                  isAdmin ? 'bg-amber-600 border border-amber-300' : 'bg-[#135A7A] border border-teal-500'
                }`}
              >
                {usuario.nome ? usuario.nome.slice(0, 2) : 'US'}
                {usuario.cpf_verificado && (
                  <span
                    className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white"
                    title="CPF Verificado no Cadastro Geral"
                  >
                    ✓
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Modais Globais do Header */}
      <PerfilCandidatoModal
        aberto={modalPerfilAberto}
        onClose={() => setModalPerfilAberto(false)}
        onAbrirContatoAdmin={handleAbrirContato}
      />

      <ContatoAdminModal
        aberto={modalContatoAberto}
        onClose={() => setModalContatoAberto(false)}
        motivoInicial={motivoContatoInicial}
      />

      <MensagensPrivadasDrawer
        aberto={modalDmAberto}
        onClose={() => setModalDmAberto(false)}
      />
    </>
  );
};
