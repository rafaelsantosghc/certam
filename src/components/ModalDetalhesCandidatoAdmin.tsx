import React, { useState } from 'react';
import { Usuario, Candidato, RegistroAcessoUsuario, RegistroModificacaoUsuario } from '../types';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import {
  X,
  User,
  ShieldCheck,
  Calendar,
  Phone,
  Mail,
  Award,
  Clock,
  History,
  FileText,
  MapPin,
  Lock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface ModalDetalhesCandidatoAdminProps {
  usuario: Usuario | null;
  aberto: boolean;
  onClose: () => void;
  onEditar?: (usuario: Usuario) => void;
}

export const ModalDetalhesCandidatoAdmin: React.FC<ModalDetalhesCandidatoAdminProps> = ({
  usuario,
  aberto,
  onClose,
  onEditar,
}) => {
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'concursos' | 'acessos' | 'modificacoes'>('geral');

  if (!aberto || !usuario) return null;

  const cpfLimpo = usuario.cpf ? usuario.cpf.replace(/\D/g, '') : '';
  const cpfFormatado =
    cpfLimpo.length === 11
      ? cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : usuario.cpf || 'Não informado';

  // Buscar todos os concursos e cargos onde este candidato consta como aprovado/inscrito
  const concursos = certamStore.getConcursos();
  const dadosClassificacoes: {
    concursoId: string;
    concursoNome: string;
    orgao: string;
    cargoId: string;
    cargoNome: string;
    candidato: Candidato;
  }[] = [];

  try {
    for (const conc of concursos) {
      for (const cg of conc.cargos || []) {
        const cands = lotesStore.getCandidatos(conc.id, cg.id);
        const match = cands.find((c) => {
          const cCpfLimpo = c.cpf ? c.cpf.replace(/\D/g, '') : '';
          return (
            (cpfLimpo.length >= 9 && cCpfLimpo.length >= 9 && cCpfLimpo === cpfLimpo) ||
            (c.id && (c.id === usuario.id || c.id === usuario.candidato_id)) ||
            (c.email && usuario.email && c.email.toLowerCase().trim() === usuario.email.toLowerCase().trim()) ||
            (c.nome && usuario.nome && c.nome.toLowerCase().trim() === usuario.nome.toLowerCase().trim())
          );
        });

        if (match) {
          dadosClassificacoes.push({
            concursoId: conc.id,
            concursoNome: conc.nome,
            orgao: conc.orgao,
            cargoId: cg.id,
            cargoNome: cg.nome,
            candidato: match,
          });
        }
      }
    }
  } catch {
    // ignore
  }

  // Lista de concursos acompanhados
  const acompanhados = (usuario.concursos_acompanhados || [])
    .map((id) => certamStore.getConcurso(id))
    .filter(Boolean);

  // Lista de acessos
  const acessos: RegistroAcessoUsuario[] = usuario.historico_acessos || [
    {
      id: 'acc-padrao',
      data_hora: usuario.ultimo_acesso || new Date().toLocaleString('pt-BR'),
      duracao_segundos: usuario.tempo_ativo_total_segundos || 180,
      duracao_formatada: usuario.tempo_ativo_total_segundos
        ? `${Math.floor(usuario.tempo_ativo_total_segundos / 60)}m`
        : '3m 00s',
      dispositivo: 'Navegador Web Desktop',
    },
  ];

  // Lista de modificações feitas pelo usuário
  const modificacoes: RegistroModificacaoUsuario[] = usuario.historico_modificacoes || [
    {
      id: 'mod-1',
      data_hora: new Date().toLocaleDateString('pt-BR') + ' 10:15',
      acao: 'Definição de 1º Acesso',
      detalhe: 'Preenchimento e validação de Nome Completo e CPF no portal.',
    },
  ];

  const formatarTempoTotal = (segundos = 0) => {
    if (segundos <= 0) return 'Ativo recentemente';
    const horas = Math.floor(segundos / 3600);
    const min = Math.floor((segundos % 3600) / 60);
    const seg = segundos % 60;
    if (horas > 0) return `${horas}h ${min}m`;
    if (min > 0) return `${min}m ${seg}s`;
    return `${seg}s`;
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="bg-white w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Superior */}
        <div className="p-4 sm:p-5 bg-[#07192B] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-[#2DD4AA] flex items-center justify-center font-bold text-lg border border-teal-500/40">
              {usuario.nome ? usuario.nome.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif font-bold text-base text-white">{usuario.nome}</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                    usuario.role === 'admin'
                      ? 'bg-purple-900/80 text-purple-200 border border-purple-500/40'
                      : 'bg-teal-900/80 text-[#2DD4AA] border border-teal-500/40'
                  }`}
                >
                  {usuario.role === 'admin' ? 'Administrador' : 'Candidato'}
                </span>
                {usuario.bloqueado && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-900/80 text-rose-200 border border-rose-500/40">
                    Bloqueado
                  </span>
                )}
              </div>
              <p className="text-2xs text-slate-300 font-mono mt-0.5">
                CPF (Chave Única / ID Oficial): <strong className="text-white">{cpfFormatado}</strong>
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

        {/* Abas Internas da Ficha do Candidato */}
        <div className="flex items-center gap-1 border-b border-slate-200 px-4 bg-slate-50/80 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setAbaAtiva('geral')}
            className={`py-3 px-3.5 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              abaAtiva === 'geral'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Dados Cadastrais</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('concursos')}
            className={`py-3 px-3.5 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              abaAtiva === 'concursos'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Concursos &amp; Situação ({dadosClassificacoes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('acessos')}
            className={`py-3 px-3.5 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              abaAtiva === 'acessos'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Histórico de Acessos ({acessos.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('modificacoes')}
            className={`py-3 px-3.5 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              abaAtiva === 'modificacoes'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Últimas Modificações ({modificacoes.length})</span>
          </button>
        </div>

        {/* Conteúdo da Ficha */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* ABA GERAL: DADOS CADASTRAIS */}
          {abaAtiva === 'geral' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                    Nome Completo
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{usuario.nome}</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                    CPF (Chave Única do Candidato)
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 font-mono text-sm break-all">{cpfFormatado}</span>
                    {usuario.cpf_verificado && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        Verificado
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                    E-mail de Login Oficial
                  </span>
                  <span className="font-mono text-slate-800 break-all">{usuario.email || '—'}</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                    E-mail Alternativo de Contato
                  </span>
                  <span className="font-mono text-slate-800 break-all">{usuario.email_contato || usuario.email || '—'}</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                    Telefone / WhatsApp
                  </span>
                  <span className="font-mono text-slate-800 break-all">
                    {usuario.telefone || usuario.whatsapp || 'Não informado'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                    Data de Nascimento
                  </span>
                  <span className="font-mono text-slate-800">{usuario.data_nascimento || 'Não informada'}</span>
                </div>
              </div>

              {/* Status do Cadastro e Sessão */}
              <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-2xs font-bold uppercase text-teal-800 block">Situação no Portal</span>
                  <span className="font-bold text-teal-950">
                    {usuario.bloqueado ? 'Acesso Bloqueado' : usuario.status_cadastro === 'ativo' ? 'Ativo e Homologado' : 'Aguardando 1º Acesso'}
                  </span>
                </div>
                <div>
                  <span className="text-2xs font-bold uppercase text-teal-800 block">Último Acesso</span>
                  <span className="font-mono text-slate-800">{usuario.ultimo_acesso || 'Sessão ativa'}</span>
                </div>
                <div>
                  <span className="text-2xs font-bold uppercase text-teal-800 block">Tempo Total em Sessão</span>
                  <span className="font-mono text-slate-800">{formatarTempoTotal(usuario.tempo_ativo_total_segundos)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ABA CONCURSOS: SITUAÇÃO, APROVAÇÕES E REPROVAÇÕES */}
          {abaAtiva === 'concursos' && (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900 font-serif flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-600" />
                <span>Classificações Oficiais Vinculadas ({dadosClassificacoes.length})</span>
              </h4>

              {dadosClassificacoes.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500">
                  Nenhuma aprovação oficial vinculada diretamente a este CPF nas listas carregadas.
                </div>
              ) : (
                <div className="space-y-3">
                  {dadosClassificacoes.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 hover:border-teal-300 transition-colors"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <span className="font-bold text-slate-900 text-sm block">
                            {item.concursoNome} • {item.cargoNome}
                          </span>
                          <span className="text-2xs font-mono text-slate-500">{item.orgao}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-[#07192B] text-[#2DD4AA] font-bold font-mono text-xs rounded-lg">
                            {item.candidato.posicao}º Lugar
                          </span>
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-semibold text-2xs rounded">
                            {item.candidato.cota || 'Ampla'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs pt-1 border-t border-slate-200/80">
                        <div>
                          <span className="text-slate-400 block">Nota Final:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {item.candidato.nota_final ?? '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Status Oficial:</span>
                          <span
                            className={`font-semibold ${
                              item.candidato.status === 'Nomeado' || item.candidato.status === 'Posse' || item.candidato.status === 'Exercício'
                                ? 'text-emerald-700'
                                : String(item.candidato.status).toLowerCase().includes('convocado')
                                ? 'text-amber-700'
                                : item.candidato.status === 'Desistente' || item.candidato.status === 'Desistência'
                                ? 'text-rose-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {item.candidato.status || 'Aguardando Convocação'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Intenção de Posse:</span>
                          <span className="font-semibold text-slate-800">
                            {item.candidato.intencao || 'Não manifestada'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Comarca Desejada:</span>
                          <span className="font-semibold text-slate-800">
                            {item.candidato.comarca_definitiva || item.candidato.comarca_desejada_1 || 'Pendente'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Concursos Acompanhados */}
              {acompanhados.length > 0 && (
                <div className="pt-2 space-y-2">
                  <h5 className="font-bold text-slate-800 text-xs">Concursos Marcados para Acompanhar:</h5>
                  <div className="flex flex-wrap gap-2">
                    {acompanhados.map((c) => (
                      <span
                        key={c!.id}
                        className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-900 rounded-lg text-2xs font-semibold"
                      >
                        {c!.nome} ({c!.orgao})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA ACESSOS: HISTÓRICO COM DATA, HORA E DURAÇÃO */}
          {abaAtiva === 'acessos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-slate-500 text-xs">
                  Registro cronológico dos acessos efetuados pelo candidato ao portal:
                </span>
                <span className="font-mono text-teal-800 font-bold text-2xs">
                  Tempo acumulado: {formatarTempoTotal(usuario.tempo_ativo_total_segundos)}
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {acessos.map((acc) => (
                  <div key={acc.id} className="p-3 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block">{acc.data_hora}</span>
                        <span className="text-2xs text-slate-400">{acc.dispositivo || 'Dispositivo Web'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {acc.duracao_formatada || `${acc.duracao_segundos || 60}s em sessão`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA MODIFICAÇÕES: AUDITORIA DE ALTERAÇÕES FEITAS */}
          {abaAtiva === 'modificacoes' && (
            <div className="space-y-3">
              <span className="text-slate-500 text-xs block pb-1">
                Trilha de auditoria das últimas alterações de cadastro, escolha de comarcas e solicitações feitas pelo candidato:
              </span>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {modificacoes.map((m) => (
                  <div key={m.id} className="p-3 hover:bg-slate-50 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{m.acao}</span>
                      <span className="text-2xs font-mono text-slate-400">{m.data_hora}</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-2xs">{m.detalhe}</p>
                    {m.valor_anterior && m.valor_novo && (
                      <div className="text-2xs font-mono bg-slate-100 p-1.5 rounded flex items-center gap-2">
                        <span className="text-rose-600 line-through">{m.valor_anterior}</span>
                        <span>→</span>
                        <span className="text-emerald-700 font-bold">{m.valor_novo}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-2xs text-slate-400 font-mono">
            Registro gerenciado pelo CERTAM • ID oficial: {cpfFormatado}
          </span>
          <div className="flex items-center gap-2">
            {onEditar && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditar(usuario);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Editar Cadastro
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl text-xs cursor-pointer transition-colors"
            >
              Fechar Dossiê
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
