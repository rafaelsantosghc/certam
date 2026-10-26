import React, { useState } from 'react';
import { X, ExternalLink, ShieldCheck, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import { MASTER_CADASTRO_GERAL } from '../data/defaultCandidates';
import { GOOGLE_CLIENT_ID_PADRAO } from '../store/authContext';

interface GoogleAuthModalProps {
  aberto: boolean;
  onFechar: () => void;
  onLoginCustom: (email: string, nome?: string, cpf?: string) => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  aberto,
  onFechar,
  onLoginCustom,
}) => {
  const [emailGoogle, setEmailGoogle] = useState('rafasms0@hotmail.com');
  const [nomeGoogle, setNomeGoogle] = useState('Rafael Santos da Silva');
  const [clientId, setClientId] = useState(() => {
    return (
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      localStorage.getItem('certam_google_client_id') ||
      GOOGLE_CLIENT_ID_PADRAO
    );
  });
  const [aba, setAba] = useState<'oauth' | 'direto'>('oauth');
  const [copiadoOrigem, setCopiadoOrigem] = useState(false);
  const [copiadoRedirect, setCopiadoRedirect] = useState(false);

  if (!aberto) return null;

  const handleRedirecionarGoogleOAuth = () => {
    const finalClientId = clientId.trim();
    if (!finalClientId) {
      alert('Por favor, informe o Google Client ID para redirecionar à tela oficial do Google OAuth.');
      return;
    }
    try {
      localStorage.setItem('certam_google_client_id', finalClientId);
    } catch {
      // ignore
    }

    const redirectUri = window.location.origin + window.location.pathname;
    const scope = encodeURIComponent('openid email profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      finalClientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=token&scope=${scope}&prompt=select_account`;

    window.location.href = authUrl;
  };

  const handleSubmeterLoginDireto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailGoogle.trim()) return;
    onLoginCustom(emailGoogle.trim(), nomeGoogle.trim() || undefined);
    onFechar();
  };

  const handleSelecionarAprovado = (nome: string, email: string, cpf?: string) => {
    onLoginCustom(email, nome, cpf);
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Topo com Identidade Visual Google */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Fazer login com o Google
              </h2>
              <p className="text-xs text-slate-500">
                Acesse o CERTAM com sua conta autenticada
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas: Acesso por Conta Google ou Redirecionamento OAuth 2.0 */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setAba('direto')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all cursor-pointer ${
              aba === 'direto'
                ? 'border-[#135A7A] text-[#135A7A] bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Sua Conta Google
          </button>
          <button
            type="button"
            onClick={() => setAba('oauth')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all cursor-pointer ${
              aba === 'oauth'
                ? 'border-[#135A7A] text-[#135A7A] bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Redirecionar OAuth 2.0 (Google)
          </button>
        </div>

        <div className="p-6">
          {aba === 'direto' ? (
            <div className="space-y-4">
              <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Identificação com base no Cadastro Mestre</span>
                  Ao informar seu e-mail do Google, o CERTAM cruzará seus dados com a lista de aprovados do certame para habilitar permissões de lotação e fóruns restritos.
                </div>
              </div>

              <form onSubmit={handleSubmeterLoginDireto} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail da sua conta Google <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={emailGoogle}
                    onChange={(e) => setEmailGoogle(e.target.value)}
                    placeholder="ex: seu.email@gmail.com ou hotmail"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:border-teal-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Completo do Candidato
                  </label>
                  <input
                    type="text"
                    value={nomeGoogle}
                    onChange={(e) => setNomeGoogle(e.target.value)}
                    placeholder="Seu nome completo para cruzamento"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:border-teal-600 focus:outline-hidden"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[#07192B] hover:bg-[#0C2640] text-white font-bold rounded-xl text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Conectar com esta Conta Google</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <ExternalLink className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Redirecionamento Oficial Google OAuth 2.0</span>
                  O botão redireciona para a tela oficial de login do Google (
                  <code className="text-2xs font-mono bg-blue-100 px-1 py-0.5 rounded">
                    accounts.google.com/o/oauth2/v2/auth
                  </code>
                  ). Após escolher sua conta Google, o retorno autentica seu perfil no portal.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Google Client ID (Google Cloud Console)
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Ex: 893072513173-detf69cldt4cefhbg8ta3cpi5hb73rma.apps.googleusercontent.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:border-teal-600 focus:outline-hidden"
                />
              </div>

              {/* Informações para cadastrar no Google Cloud Console */}
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-2xs">
                <span className="font-bold text-slate-700 block uppercase tracking-wide">
                  Configuração no Google Cloud Console:
                </span>
                <div>
                  <span className="text-slate-500 block mb-0.5">1. Origem JavaScript Autorizada:</span>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 font-mono text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 truncate">
                      {window.location.origin}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin);
                        setCopiadoOrigem(true);
                        setTimeout(() => setCopiadoOrigem(false), 2000);
                      }}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded shrink-0 cursor-pointer"
                    >
                      {copiadoOrigem ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block mb-0.5">2. URI de Redirecionamento Autorizada:</span>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 font-mono text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 truncate">
                      {window.location.origin + window.location.pathname}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + window.location.pathname);
                        setCopiadoRedirect(true);
                        setTimeout(() => setCopiadoRedirect(false), 2000);
                      }}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded shrink-0 cursor-pointer"
                    >
                      {copiadoRedirect ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleRedirecionarGoogleOAuth}
                  className="w-full py-2.5 px-4 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold rounded-xl text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Ir para autenticação Google</span>
                </button>
              </div>

              <div className="text-2xs text-slate-500 text-center">
                Se você ainda não cadastrou a URL no Google Cloud, faça isso no console em Credenciais OAuth 2.0.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
