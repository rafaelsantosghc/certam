import React, { useState } from 'react';
import { useAuth } from '../store/authContext';
import { contactStore, MOTIVOS_LABELS } from '../store/contactStore';
import { MotivoContato } from '../types';
import { sanitizeInput } from '../utils/security';
import { X, Send, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';

interface ContatoAdminModalProps {
  aberto: boolean;
  onClose: () => void;
  motivoInicial?: MotivoContato;
  concursoNomePreenchido?: string;
}

export const ContatoAdminModal: React.FC<ContatoAdminModalProps> = ({
  aberto,
  onClose,
  motivoInicial = 'inclusao_concurso',
  concursoNomePreenchido = '',
}) => {
  const { usuario } = useAuth();

  const [motivo, setMotivo] = useState<MotivoContato>(motivoInicial);
  const [concursoNome, setConcursoNome] = useState(concursoNomePreenchido);
  const [anoConcurso, setAnoConcurso] = useState(new Date().getFullYear().toString());
  const [cargoNome, setCargoNome] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const emailAutor = usuario?.email || usuario?.email_contato || 'visitante@certam.com.br';
    const nomeAutor = usuario?.nome || 'Usuário Concurseiro';

    if (motivo === 'inclusao_concurso') {
      if (!concursoNome.trim()) {
        setErro('Por favor, informe o nome do concurso.');
        return;
      }
      if (!cargoNome.trim()) {
        setErro('Por favor, informe o cargo em que você foi aprovado.');
        return;
      }
      if (!classificacao.trim()) {
        setErro('Por favor, informe a sua classificação.');
        return;
      }
    } else {
      if (!mensagem.trim()) {
        setErro('Por favor, descreva sua solicitação ou mensagem para o administrador.');
        return;
      }
    }

    contactStore.enviarMensagem({
      usuario_email: emailAutor,
      usuario_nome: nomeAutor,
      motivo,
      concurso_nome: sanitizeInput(concursoNome, 100),
      ano_concurso: sanitizeInput(anoConcurso, 10),
      cargo_nome: sanitizeInput(cargoNome, 100),
      classificacao: sanitizeInput(classificacao, 50),
      mensagem: sanitizeInput(
        mensagem || `Solicitação de cadastro do concurso ${concursoNome} (${anoConcurso}) no cargo ${cargoNome} com classificação ${classificacao}.`,
        1000
      ),
    });

    setSucesso(true);
    setTimeout(() => {
      setSucesso(false);
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Fale com o Administrador</h3>
              <p className="text-2xs text-slate-300">Solicitação de novos concursos, dúvidas ou suporte</p>
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

        {/* Form Body */}
        {sucesso ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#2DD4AA] mx-auto animate-bounce" />
            <h4 className="font-serif font-bold text-lg text-slate-900">Solicitação Enviada com Sucesso!</h4>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              O administrador do CERTAM já recebeu sua mensagem e processará a inclusão ou resposta na caixa de moderação.
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

            {/* Motivo do Contato */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Motivo do Contato <span className="text-rose-500">*</span>
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoContato)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden font-medium"
              >
                {Object.entries(MOTIVOS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Campos Específicos para Inclusão de Concurso */}
            {motivo === 'inclusao_concurso' && (
              <div className="p-3.5 bg-teal-50/50 border border-teal-200 rounded-xl space-y-3">
                <div className="text-2xs font-bold text-teal-800 uppercase tracking-wider">
                  Dados do Certame para Cadastro
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nome do Concurso / Órgão <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: TJSC, TJPR, TRF4, SEFAZ/RS..."
                      value={concursoNome}
                      onChange={(e) => setConcursoNome(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Ano do Concurso <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 2024"
                      value={anoConcurso}
                      onChange={(e) => setAnoConcurso(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Cargo Aprovado <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Técnico Judiciário"
                      value={cargoNome}
                      onChange={(e) => setCargoNome(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Sua Classificação <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 12º Lugar (Ampla Concorrência)"
                      value={classificacao}
                      onChange={(e) => setClassificacao(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-teal-600 focus:outline-hidden font-medium"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Mensagem / Detalhes Adicionais */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {motivo === 'inclusao_concurso' ? 'Observações Adicionais (opcional)' : 'Mensagem Detalhada'}
                {motivo !== 'inclusao_concurso' && <span className="text-rose-500"> *</span>}
              </label>
              <textarea
                rows={3}
                placeholder={
                  motivo === 'inclusao_concurso'
                    ? 'Informe links do edital ou informações para auxiliar o cadastro...'
                    : 'Descreva sua dúvida ou solicitação...'
                }
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-600 focus:outline-hidden leading-relaxed font-medium"
                required={motivo !== 'inclusao_concurso'}
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
                <span>Enviar para o Administrador</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
