import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/authContext';
import { auditStore } from '../store/auditStore';
import { sanitizeInput } from '../utils/security';
import { X, Send, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

interface SolicitarVinculacaoModalProps {
  aberto: boolean;
  onClose: () => void;
  concursoId: string;
  concursoNome: string;
  cargoId: string;
  cargoNome: string;
}

export const SolicitarVinculacaoModal: React.FC<SolicitarVinculacaoModalProps> = ({
  aberto,
  onClose,
  concursoId,
  concursoNome,
  cargoId,
  cargoNome,
}) => {
  const { usuario } = useAuth();
  const [nome, setNome] = useState(usuario?.nome || '');
  const [cpf, setCpf] = useState(usuario?.cpf || '');
  const [posicao, setPosicao] = useState('');
  const [cotaDeclarada, setCotaDeclarada] = useState('Ampla');
  const [nota, setNota] = useState('');
  const [comprovanteInfo, setComprovanteInfo] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto && usuario) {
      setNome(usuario.nome || '');
      setCpf(usuario.cpf || '');
    }
  }, [aberto, usuario]);

  if (!aberto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('Informe seu nome completo conforme a lista oficial de aprovados.');
      return;
    }
    if (!cpf.trim()) {
      setErro('Informe seu CPF.');
      return;
    }
    if (!posicao.trim()) {
      setErro('Informe a sua classificação oficial obtida na homologação.');
      return;
    }

    auditStore.solicitarVinculacao({
      usuario_email: usuario?.email || 'candidato@certam.com.br',
      usuario_nome: sanitizeInput(nome, 100),
      cpf: sanitizeInput(cpf, 20),
      concurso_id: concursoId,
      concurso_nome: concursoNome,
      cargo_id: cargoId,
      cargo_nome: cargoNome,
      posicao_declarada: parseInt(posicao, 10) || 1,
      cota_declarada: cotaDeclarada,
      nota_declarada: nota ? parseFloat(nota.replace(',', '.')) : undefined,
      comprovante_info: sanitizeInput(comprovanteInfo, 500),
    });

    setSucesso(true);
    setTimeout(() => {
      setSucesso(false);
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Informar Aprovação Oficial ao Admin</h3>
              <p className="text-2xs text-slate-300">{concursoNome} • {cargoNome}</p>
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

        {sucesso ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#2DD4AA] mx-auto animate-bounce" />
            <h4 className="font-serif font-bold text-lg text-slate-900">Aviso Enviado à Administração!</h4>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              O administrador recebeu seu alerta e analisará sua classificação oficial para vincular sua conta ao registro de aprovado no Cadastro Geral.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs">
            {erro && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl text-teal-900 text-2xs leading-relaxed">
              Você está aprovado neste concurso, mas o sistema não reconheceu automaticamente seu vínculo? Preencha sua classificação oficial abaixo para que o administrador analise e vincule seu perfil ao aprovado correspondente no cadastro geral.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome Completo no Edital <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden"
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
                  onChange={(e) => setCpf(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Classificação Oficial <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="Ex: 8"
                  value={posicao}
                  onChange={(e) => setPosicao(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lista / Cota
                </label>
                <select
                  value={cotaDeclarada}
                  onChange={(e) => setCotaDeclarada(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-semibold"
                >
                  <option value="Ampla">Ampla Concorrência</option>
                  <option value="PPP">PPP / Negros</option>
                  <option value="PCD">PCD</option>
                  <option value="PCD + PPP">PCD + PPP (Ambas)</option>
                  <option value="Indígena">Indígena</option>
                  <option value="Trans">Trans</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nota Final (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 91.50"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Observações / Informações Comprobatórias (Inscrição / Diário Oficial)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Aprovado em 8º lugar na Ampla Concorrência, publicação no DOE de 18/10/2025..."
                value={comprovanteInfo}
                onChange={(e) => setComprovanteInfo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden leading-relaxed"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Aviso para Administração</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
