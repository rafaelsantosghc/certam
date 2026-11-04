import React, { useState, useMemo, useEffect } from 'react';
import { Concurso, Cargo, Candidato } from '../types';
import { cloudSync } from '../store/cloudSync';
import {
  Calendar,
  CheckSquare,
  DollarSign,
  Download,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Printer,
} from 'lucide-react';

interface FerramentasAprovadoPanelProps {
  concurso: Concurso;
  cargo: Cargo;
  usuarioEmail: string;
  meuCandidato: Candidato | null;
}

interface ChecklistItem {
  id: string;
  categoria: 'Documentação Civil & Certidões' | 'Exames Laboratoriais & Médicos';
  titulo: string;
  status: 'pendente' | 'agendado' | 'pronto';
}

const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'doc-1', categoria: 'Documentação Civil & Certidões', titulo: 'RG, CPF e Comprovante de Situação Cadastral na Receita Federal', status: 'pendente' },
  { id: 'doc-2', categoria: 'Documentação Civil & Certidões', titulo: 'Diploma ou Certificado de Conclusão do Nível Exigido no Edital', status: 'pendente' },
  { id: 'doc-3', categoria: 'Documentação Civil & Certidões', titulo: 'Certidão de Quitação Eleitoral e Comprovante de Votação (TSE)', status: 'pendente' },
  { id: 'doc-4', categoria: 'Documentação Civil & Certidões', titulo: 'Certidões Negativas Cível e Criminal (Justiça Estadual e Federal)', status: 'pendente' },
  { id: 'doc-5', categoria: 'Documentação Civil & Certidões', titulo: 'Declaração de Bens e Valores / Última Declaração de IRPF', status: 'pendente' },
  { id: 'doc-6', categoria: 'Documentação Civil & Certidões', titulo: 'Declaração de Não Acumulação Ilícita de Cargos Públicos', status: 'pendente' },
  { id: 'exm-1', categoria: 'Exames Laboratoriais & Médicos', titulo: 'Hemograma Completo, Glicemia de Jejum, Creatinina e Lipidograma', status: 'pendente' },
  { id: 'exm-2', categoria: 'Exames Laboratoriais & Médicos', titulo: 'Eletrocardiograma (ECG) com Laudo Cardiológico', status: 'pendente' },
  { id: 'exm-3', categoria: 'Exames Laboratoriais & Médicos', titulo: 'Avaliação Oftalmológica Completa (Acuidade Visual e Tonometria)', status: 'pendente' },
  { id: 'exm-4', categoria: 'Exames Laboratoriais & Médicos', titulo: 'Laudo de Sanidade Física e Mental / Avaliação Psiquiátrica Oficial', status: 'pendente' },
];

function extrairValorNumericoRemuneracao(remStr?: string): number {
  if (!remStr) return 10250.8;
  const limpo = remStr.replace(/[^\d,]/g, '').replace(',', '.');
  const val = parseFloat(limpo);
  return !Number.isNaN(val) && val > 500 ? val : 10250.8;
}

export const FerramentasAprovadoPanel: React.FC<FerramentasAprovadoPanelProps> = ({
  concurso,
  cargo,
  usuarioEmail,
  meuCandidato,
}) => {
  // =========================================================================
  // MELHORIA 2: CALCULADORA DE PREVISÃO DE POSSE E EXERCÍCIO (.ICS)
  // =========================================================================
  const [dataNomeacaoInput, setDataNomeacaoInput] = useState<string>(() => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  });
  const [regimePrazo, setRegimePrazo] = useState<'30_30_15' | '15_15_5'>('30_30_15');

  const prazosCalculados = useMemo(() => {
    const base = new Date(`${dataNomeacaoInput}T12:00:00`);
    if (Number.isNaN(base.getTime())) return null;

    const diasPosse = regimePrazo === '30_30_15' ? 30 : 15;
    const diasProrrogacao = regimePrazo === '30_30_15' ? 30 : 15;
    const diasExercicio = regimePrazo === '30_30_15' ? 15 : 5;

    const addDays = (d: Date, days: number) => {
      const copy = new Date(d.getTime());
      copy.setDate(copy.getDate() + days);
      return copy;
    };

    const dataLimiteExames = addDays(base, Math.max(7, diasPosse - 7));
    const dataPosseInicial = addDays(base, diasPosse);
    const dataPosseProrrogada = addDays(base, diasPosse + diasProrrogacao);
    const dataExercicioFinal = addDays(dataPosseProrrogada, diasExercicio);

    const fmt = (d: Date) => d.toLocaleDateString('pt-BR');
    const fmtIcs = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    return {
      dataNomeacao: fmt(base),
      dataLimiteExames: fmt(dataLimiteExames),
      dataPosseInicial: fmt(dataPosseInicial),
      dataPosseProrrogada: fmt(dataPosseProrrogada),
      dataExercicioFinal: fmt(dataExercicioFinal),
      raw: {
        base,
        dataLimiteExames,
        dataPosseInicial,
        dataPosseProrrogada,
        dataExercicioFinal,
        fmtIcs,
      },
    };
  }, [dataNomeacaoInput, regimePrazo]);

  const handleBaixarIcs = () => {
    if (!prazosCalculados) return;
    const { raw } = prazosCalculados;
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CERTAM Portal do Concurseiro//PT-BR',
      'BEGIN:VEVENT',
      `UID:certam-exames-${Date.now()}@portalcertam.com.br`,
      `DTSTAMP:${raw.fmtIcs(new Date())}`,
      `DTSTART:${raw.fmtIcs(raw.dataLimiteExames)}`,
      `DTEND:${raw.fmtIcs(raw.dataLimiteExames)}`,
      `SUMMARY:[CERTAM] Entrega Recomendada de Exames e Documentos - ${concurso.orgao}`,
      `DESCRIPTION:Prazo recomendado para protocolo dos exames médicos e certidões para posse no cargo ${cargo.nome}.`,
      'END:VEVENT',
      'BEGIN:VEVENT',
      `UID:certam-posse-${Date.now()}@portalcertam.com.br`,
      `DTSTAMP:${raw.fmtIcs(new Date())}`,
      `DTSTART:${raw.fmtIcs(raw.dataPosseInicial)}`,
      `DTEND:${raw.fmtIcs(raw.dataPosseInicial)}`,
      `SUMMARY:[CERTAM] Prazo Legal de Posse (1º Vencimento) - ${concurso.orgao}`,
      `DESCRIPTION:Data limite ordinária para posse ou protocolo de pedido de prorrogação no cargo ${cargo.nome}.`,
      'END:VEVENT',
      'BEGIN:VEVENT',
      `UID:certam-posse-prorrog-${Date.now()}@portalcertam.com.br`,
      `DTSTAMP:${raw.fmtIcs(new Date())}`,
      `DTSTART:${raw.fmtIcs(raw.dataPosseProrrogada)}`,
      `DTEND:${raw.fmtIcs(raw.dataPosseProrrogada)}`,
      `SUMMARY:[CERTAM] Prazo Final de Posse Prorrogada - ${concurso.orgao}`,
      `DESCRIPTION:Data limite improrrogável para assinatura do termo de posse em ${concurso.orgao}.`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prazos-posse-${concurso.orgao.toLowerCase()}-${cargo.id}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // MELHORIA 3: CHECKLIST INTERATIVO DE DOCUMENTOS E EXAMES MÉDICOS
  // =========================================================================
  const checklistKey = `certam_checklist_posse_v1_${concurso.id}_${usuarioEmail.toLowerCase().trim()}`;
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem(checklistKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_CHECKLIST_ITEMS;
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(checklistKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChecklist(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setChecklist(DEFAULT_CHECKLIST_ITEMS);
  }, [checklistKey]);

  const alternarStatusChecklist = (id: string) => {
    const proximoStatus: Record<ChecklistItem['status'], ChecklistItem['status']> = {
      pendente: 'agendado',
      agendado: 'pronto',
      pronto: 'pendente',
    };
    const atualizado = checklist.map((item) =>
      item.id === id ? { ...item, status: proximoStatus[item.status] } : item
    );
    setChecklist(atualizado);
    try {
      localStorage.setItem(checklistKey, JSON.stringify(atualizado));
    } catch {
      // ignore
    }
    void cloudSync.pushKey(checklistKey, atualizado);
  };

  const progressoChecklist = useMemo(() => {
    const total = checklist.length;
    const prontos = checklist.filter((i) => i.status === 'pronto').length;
    const agendados = checklist.filter((i) => i.status === 'agendado').length;
    const perc = total > 0 ? Math.round((prontos / total) * 100) : 0;
    return { total, prontos, agendados, perc };
  }, [checklist]);

  // =========================================================================
  // MELHORIA 4: SIMULADOR DE REMUNERAÇÃO LÍQUIDA E BENEFÍCIOS
  // =========================================================================
  const [vencimentoBruto, setVencimentoBruto] = useState<number>(() =>
    extrairValorNumericoRemuneracao(cargo.remuneracao_inicial)
  );
  const [auxilioAlimentacao, setAuxilioAlimentacao] = useState<number>(1960);
  const [auxilioSaude, setAuxilioSaude] = useState<number>(680);
  const [adicionalQualificacaoPerc, setAdicionalQualificacaoPerc] = useState<number>(0);

  useEffect(() => {
    setVencimentoBruto(extrairValorNumericoRemuneracao(cargo.remuneracao_inicial));
  }, [cargo.remuneracao_inicial]);

  const calculoRemuneracao = useMemo(() => {
    const valorAdicionalQualificacao = vencimentoBruto * (adicionalQualificacaoPerc / 100);
    const baseTributavel = vencimentoBruto + valorAdicionalQualificacao;
    // RPPS estimado em 14%
    const descontoPrevidencia = baseTributavel * 0.14;
    // Base IRRF = Bruto Tributável - Previdência
    const baseIrrf = Math.max(0, baseTributavel - descontoPrevidencia);
    // Tabela progressiva IRRF simplificada (alíquota 27.5% com parcela a deduzir ~ R$ 896,00)
    const descontoIrrf = baseIrrf > 4664.68 ? Math.max(0, baseIrrf * 0.275 - 896) : baseIrrf * 0.15;
    const beneficiosIndenizatorios = auxilioAlimentacao + auxilioSaude;
    const totalBrutoComBeneficios = baseTributavel + beneficiosIndenizatorios;
    const liquidoMensal = baseTributavel - descontoPrevidencia - descontoIrrf + beneficiosIndenizatorios;

    return {
      valorAdicionalQualificacao,
      baseTributavel,
      descontoPrevidencia,
      descontoIrrf,
      beneficiosIndenizatorios,
      totalBrutoComBeneficios,
      liquidoMensal,
    };
  }, [vencimentoBruto, auxilioAlimentacao, auxilioSaude, adicionalQualificacaoPerc]);

  const fmtMoeda = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 pt-2">
      {/* CABEÇALHO DO PAINEL DE FERRAMENTAS DO APROVADO */}
      <div className="bg-gradient-to-r from-[#07192B] to-[#0C2640] text-white rounded-2xl p-5 sm:p-6 border border-[#135A7A]/60 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#2DD4AA]/15 border border-[#2DD4AA]/40 text-[#2DD4AA] text-[10px] font-mono font-bold uppercase">
            Central de Planejamento da Posse
          </span>
          <h3 className="text-base sm:text-lg font-bold font-serif text-white mt-1">
            Ferramentas Exclusivas de Posse, Checklist Documental &amp; Simulador Salarial
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Planeje seus prazos estatutários, organize exames e certidões obrigatórias e simule sua remuneração líquida em {concurso.orgao}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors no-print"
          title="Imprimir ou salvar seu planejamento e boletim em PDF"
        >
          <Printer className="w-3.5 h-3.5 text-[#2DD4AA]" />
          <span>Imprimir / Salvar Meu Boletim (PDF)</span>
        </button>
      </div>

      {/* GRID DUPLO: CALCULADORA DE PRAZOS LEGAIS (MELHORIA 2) + SIMULADOR DE REMUNERAÇÃO (MELHORIA 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* MELHORIA 2: CALCULADORA DE PRAZOS LEGAIS DE POSSE E EXERCÍCIO */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 card-shadow flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-2">
              <div>
                <h4 className="font-serif font-bold text-base text-[#07192B] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>Calculadora de Prazos de Posse e Exercício</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Simule as datas limites a partir da publicação da nomeação no Diário Oficial
                </p>
              </div>
              <Clock className="w-5 h-5 text-slate-300 shrink-0" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Data da Nomeação (ou Previsão):
                </label>
                <input
                  type="date"
                  value={dataNomeacaoInput}
                  onChange={(e) => setDataNomeacaoInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Regime Estatutário de Prazos:
                </label>
                <select
                  value={regimePrazo}
                  onChange={(e) => setRegimePrazo(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                >
                  <option value="30_30_15">30 dias Posse + 30 Prorrog. + 15 Exercício</option>
                  <option value="15_15_5">15 dias Posse + 15 Prorrog. + 5 Exercício</option>
                </select>
              </div>
            </div>

            {prazosCalculados && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                  <span className="text-[10px] font-mono uppercase text-amber-800 font-bold block">
                    Limite Recomendado Exames
                  </span>
                  <strong className="text-sm font-mono font-bold text-amber-950 mt-0.5 block">
                    {prazosCalculados.dataLimiteExames}
                  </strong>
                  <span className="text-[10px] text-amber-700">Protocolo médico/documental</span>
                </div>

                <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200">
                  <span className="text-[10px] font-mono uppercase text-teal-800 font-bold block">
                    Prazo Ordinário de Posse
                  </span>
                  <strong className="text-sm font-mono font-bold text-teal-950 mt-0.5 block">
                    {prazosCalculados.dataPosseInicial}
                  </strong>
                  <span className="text-[10px] text-teal-700">Ou pedir prorrogação até esta data</span>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                  <span className="text-[10px] font-mono uppercase text-indigo-800 font-bold block">
                    Posse Com Prorrogação
                  </span>
                  <strong className="text-sm font-mono font-bold text-indigo-950 mt-0.5 block">
                    {prazosCalculados.dataPosseProrrogada}
                  </strong>
                  <span className="text-[10px] text-indigo-700">Data máxima improrrogável</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] font-mono uppercase text-emerald-800 font-bold block">
                    Limite Entrada em Exercício
                  </span>
                  <strong className="text-sm font-mono font-bold text-emerald-950 mt-0.5 block">
                    {prazosCalculados.dataExercicioFinal}
                  </strong>
                  <span className="text-[10px] text-emerald-700">Início efetivo na comarca</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              {meuCandidato ? `Candidato: ${meuCandidato.nome} (${meuCandidato.posicao}º)` : 'Simulação aberta'}
            </span>
            <button
              type="button"
              onClick={handleBaixarIcs}
              className="px-3.5 py-2 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Prazos (.ICS / Agenda)</span>
            </button>
          </div>
        </div>

        {/* MELHORIA 4: SIMULADOR DE REMUNERAÇÃO LÍQUIDA E BENEFÍCIOS */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 card-shadow flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-2">
              <div>
                <h4 className="font-serif font-bold text-base text-[#07192B] flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Simulador de Remuneração Líquida Mensal</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cálculo estimado com descontos de Previdência Oficial (14%), IRRF e auxílios indenizatórios
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">Vencimento (R$):</label>
                <input
                  type="number"
                  step="50"
                  value={vencimentoBruto}
                  onChange={(e) => setVencimentoBruto(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">Aux. Alimentação:</label>
                <input
                  type="number"
                  step="50"
                  value={auxilioAlimentacao}
                  onChange={(e) => setAuxilioAlimentacao(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs text-teal-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">Aux. Saúde (R$):</label>
                <input
                  type="number"
                  step="50"
                  value={auxilioSaude}
                  onChange={(e) => setAuxilioSaude(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs text-teal-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">Qualificação (%):</label>
                <select
                  value={adicionalQualificacaoPerc}
                  onChange={(e) => setAdicionalQualificacaoPerc(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs"
                >
                  <option value={0}>0% (Sem Adic.)</option>
                  <option value={5}>+5% (Especialização)</option>
                  <option value={7.5}>+7,5% (Mestrado)</option>
                  <option value={10}>+10% (Doutorado)</option>
                </select>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Remuneração Bruta + Auxílios Indenizatórios:</span>
                <span className="font-mono font-bold text-slate-900">
                  {fmtMoeda(calculoRemuneracao.totalBrutoComBeneficios)}
                </span>
              </div>
              <div className="flex items-center justify-between text-rose-700">
                <span>(-) Previdência Oficial RPPS (~14%):</span>
                <span className="font-mono font-semibold">
                  - {fmtMoeda(calculoRemuneracao.descontoPrevidencia)}
                </span>
              </div>
              <div className="flex items-center justify-between text-rose-700">
                <span>(-) Imposto de Renda Retido na Fonte (IRRF):</span>
                <span className="font-mono font-semibold">
                  - {fmtMoeda(calculoRemuneracao.descontoIrrf)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                  Valor Líquido Estimado em Conta:
                </span>
                <span className="text-base sm:text-lg font-mono font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                  {fmtMoeda(calculoRemuneracao.liquidoMensal)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>* Os auxílios alimentação e saúde são isentos de IRRF e Previdência.</span>
          </div>
        </div>
      </div>

      {/* MELHORIA 3: CHECKLIST INTERATIVO DE DOCUMENTOS E EXAMES MÉDICOS PARA POSSE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 card-shadow space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h4 className="font-serif font-bold text-base sm:text-lg text-[#07192B] flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-teal-600" />
              <span>Checklist Pessoal de Documentos e Exames Médicos para Posse</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Clique em cada item para alternar entre <strong>Pendente</strong>, <strong>Agendado</strong> e <strong>Pronto</strong>. Seu progresso fica salvo automaticamente na sua conta.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-xs font-bold text-slate-900 block">
                {progressoChecklist.prontos} de {progressoChecklist.total} concluídos ({progressoChecklist.perc}%)
              </span>
              <span className="text-[11px] text-amber-700 font-medium">
                {progressoChecklist.agendados} em andamento / agendados
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${progressoChecklist.perc}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['Documentação Civil & Certidões', 'Exames Laboratoriais & Médicos'] as const).map((cat) => (
            <div key={cat} className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                {cat}
              </h5>
              {checklist
                .filter((i) => i.categoria === cat)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => alternarStatusChecklist(item.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      item.status === 'pronto'
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                        : item.status === 'agendado'
                        ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.status === 'pronto' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : item.status === 'agendado' ? (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span className={`text-xs font-medium ${item.status === 'pronto' ? 'line-through opacity-80' : ''}`}>
                        {item.titulo}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0 ${
                        item.status === 'pronto'
                          ? 'bg-emerald-200/80 text-emerald-900'
                          : item.status === 'agendado'
                          ? 'bg-amber-200/80 text-amber-900'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.status === 'pronto'
                        ? '✓ Pronto'
                        : item.status === 'agendado'
                        ? '⏳ Agendado'
                        : 'Pendente'}
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
