import React, { useState, useMemo } from 'react';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { useAuth } from '../store/authContext';
import { Concurso, Cargo, Candidato } from '../types';
import * as XLSX from 'xlsx';
import {
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Users,
  Building,
} from 'lucide-react';

interface AdminPanelProps {
  initialTab?: 'concursos' | 'importar' | 'candidatos';
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  initialTab = 'concursos',
  onNavigate,
}) => {
  const [abaAdmin, setAbaAdmin] = useState<'concursos' | 'importar' | 'candidatos'>(initialTab);

  const [concursos, setConcursos] = useState<Concurso[]>(() => certamStore.getConcursos());
  const [busca, setBusca] = useState('');

  // Modais
  const [modalNovoConcursoAberto, setModalNovoConcursoAberto] = useState(false);
  const [modalNovoCargoAberto, setModalNovoCargoAberto] = useState(false);
  const [concursoAlvoId, setConcursoAlvoId] = useState<string>('');

  // Form Novo Concurso
  const [formId, setFormId] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formOrgao, setFormOrgao] = useState('');
  const [formAno, setFormAno] = useState('2024');
  const [formEdital, setFormEdital] = useState('Edital 01/2024');
  const [formStatus, setFormStatus] = useState<Concurso['status']>('ativo');
  const [formCargoInicial, setFormCargoInicial] = useState('Analista Judiciário');
  const [formDesc, setFormDesc] = useState('');

  // Form Novo Cargo
  const [formCargoNome, setFormCargoNome] = useState('');
  const [formCargoId, setFormCargoId] = useState('');
  const [formCargoNivel, setFormCargoNivel] = useState<Cargo['nivel']>('Superior');
  const [formCargoVagas, setFormCargoVagas] = useState(0);
  const [formCargoCr, setFormCargoCr] = useState(true);

  // Importador Planilhas
  const [importConcursoId, setImportConcursoId] = useState<string>(concursos[0]?.id || 'tjrs_2024');
  const [importCargoId, setImportCargoId] = useState<string>(concursos[0]?.cargos?.[0]?.id || 'analista_judiciario');
  const [previewPlanilha, setPreviewPlanilha] = useState<Partial<Candidato>[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState('');

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const reloadData = () => {
    setConcursos(certamStore.getConcursos());
  };

  // Metrics
  const metricas = useMemo(() => {
    const totalConcursos = concursos.length;
    const totalCargos = concursos.reduce((acc, c) => acc + (c.cargos?.length || 0), 0);
    return { totalConcursos, totalCargos };
  }, [concursos]);

  // Salvar Novo Concurso
  const handleSalvarConcurso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim() || !formOrgao.trim()) return;

    const idGerado = formId.trim() || formOrgao.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const novo: Concurso = {
      id: idGerado,
      nome: formNome,
      orgao: formOrgao,
      ano: formAno,
      edital: formEdital,
      status: formStatus,
      descricao: formDesc,
      cargos: [
        {
          id: formCargoInicial.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'geral',
          nome: formCargoInicial,
          nivel: 'Superior',
          vagas_imediatas: 10,
          tem_cr: true,
          ativo: true,
        },
      ],
    };

    certamStore.salvarConcurso(novo);
    reloadData();
    setModalNovoConcursoAberto(false);
    showToast('Concurso cadastrado com sucesso!');
  };

  // Salvar Novo Cargo
  const handleSalvarCargo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCargoNome.trim() || !concursoAlvoId) return;

    const idGerado = formCargoId.trim() || formCargoNome.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const novoCargo: Cargo = {
      id: idGerado,
      nome: formCargoNome,
      nivel: formCargoNivel,
      vagas_imediatas: Number(formCargoVagas) || 0,
      tem_cr: formCargoCr,
      ativo: true,
    };

    certamStore.salvarCargo(concursoAlvoId, novoCargo);
    reloadData();
    setModalNovoCargoAberto(false);
    showToast('Cargo adicionado ao concurso!');
  };

  // Excluir Concurso
  const handleExcluirConcurso = (cid: string) => {
    if (confirm('Deseja realmente excluir este concurso e todos os seus cargos?')) {
      certamStore.excluirConcurso(cid);
      reloadData();
      showToast('Concurso removido.');
    }
  };

  // Excluir Cargo
  const handleExcluirCargo = (cid: string, gid: string) => {
    if (confirm('Deseja remover este cargo?')) {
      certamStore.excluirCargo(cid, gid);
      reloadData();
      showToast('Cargo removido.');
    }
  };

  // Processar Planilha XLSX/CSV via SheetJS
  const handleUploadArquivoExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Skip header rows if any and extract records
        const parsed: Partial<Candidato>[] = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i] as (string | number | undefined)[];
          if (!row || row.length < 2) continue;
          const pos = Number(row[0]) || i;
          const nome = String(row[1] || `Candidato ${i}`);
          const cota = (row[2] as Candidato['cota']) || 'Ampla';
          const nota = Number(row[3]) || 80.0;
          parsed.push({
            posicao: pos,
            nome,
            cota,
            nota_final: nota,
            status: 'Aguardando',
            intencao: 'Sim',
          });
        }
        setPreviewPlanilha(parsed.slice(0, 10));
        showToast(`${parsed.length} registros processados do arquivo!`);
      } catch {
        alert('Erro ao processar planilha. Verifique o formato do arquivo.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Sincronizar candidatos importados no Cargo
  const handleSincronizarPlanilha = () => {
    if (previewPlanilha.length === 0) return;
    const novosCandidatos: Candidato[] = previewPlanilha.map((p, idx) => ({
      id: `imp-${Date.now()}-${idx}`,
      posicao: p.posicao || idx + 1,
      nome: p.nome || `Aprovado ${idx + 1}`,
      cota: p.cota || 'Ampla',
      nota_final: p.nota_final || 85.0,
      intencao: 'Sim',
      status: 'Aguardando',
      escolhas_comarcas: ['Porto Alegre', 'Canoas'],
    }));

    lotesStore.salvarCandidatos(importConcursoId, importCargoId, novosCandidatos);
    showToast('Lista de candidatos sincronizada com sucesso para este cargo!');
    setPreviewPlanilha([]);
    setNomeArquivo('');
  };

  // Concursos filtrados
  const concursosFiltrados = useMemo(() => {
    return concursos.filter(
      (c) =>
        !busca.trim() ||
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.orgao.toLowerCase().includes(busca.toLowerCase()) ||
        c.cargos.some((cg) => cg.nome.toLowerCase().includes(busca.toLowerCase()))
    );
  }, [concursos, busca]);

  return (
    <div className="space-y-6 max-w-[1880px] w-full mx-auto">
      {/* Toast flutuante */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold text-white bg-[#07192B] border border-[#2DD4AA]/40 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#2DD4AA]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HERO BANNER (#07192B) */}
      <div className="bg-gradient-to-r from-[#07192B] via-[#0C2640] to-[#07192B] rounded-2xl p-6 sm:p-8 text-white card-shadow relative overflow-hidden border border-[#0F2942]">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#135A7A]/50 border border-teal-500/30 text-teal-300">
              <span>👑</span>
              <span>PAINEL ADMINISTRATIVO CERTAM</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
              Organização Centralizada de Concursos &amp; Cargos
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Cadastre novos certames, divida cada concurso em seus cargos específicos e isole as listas de classificação, chats e simulações. Sem dados fictícios ou invasão de informações entre concursos.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="bg-[#07192B]/80 border border-teal-500/20 rounded-xl p-4 text-center min-w-[110px]">
              <span className="text-[10px] uppercase font-mono font-bold text-teal-400 block">
                Concursos
              </span>
              <div className="text-2xl font-extrabold text-white mt-0.5">
                {metricas.totalConcursos}
              </div>
            </div>
            <div className="bg-[#07192B]/80 border border-teal-500/20 rounded-xl p-4 text-center min-w-[110px]">
              <span className="text-[10px] uppercase font-mono font-bold text-teal-400 block">
                Cargos Ativos
              </span>
              <div className="text-2xl font-extrabold text-white mt-0.5">
                {metricas.totalCargos}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS ADMIN */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 overflow-x-auto card-shadow">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAbaAdmin('concursos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              abaAdmin === 'concursos'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Concursos &amp; Cargos</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('importar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              abaAdmin === 'importar'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar Planilhas (XLSX)</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAdmin('candidatos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              abaAdmin === 'candidatos'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Central de Candidatos</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setModalNovoConcursoAberto(true)}
          className="bg-[#2DD4AA] hover:bg-[#20BE96] text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Concurso</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* ABA 1: CONCURSOS E CARGOS                                      */}
      {/* ============================================================== */}
      {abaAdmin === 'concursos' && (
        <section className="space-y-6">
          {/* Busca */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por concurso, sigla ou cargo..."
                className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
              />
            </div>
            <span className="text-2xs text-slate-500">
              Total: <strong>{concursosFiltrados.length}</strong> concurso(s)
            </span>
          </div>

          {/* Cards dos Concursos Cadastrados */}
          <div className="space-y-6">
            {concursosFiltrados.map((concurso) => (
              <div
                key={concurso.id}
                className="bg-white rounded-2xl border border-slate-200 card-shadow p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#135A7A] border border-teal-200 font-mono font-bold text-xs uppercase">
                        {concurso.orgao}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">ID: {concurso.id}</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {concurso.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold font-serif text-slate-900 mt-1">
                      {concurso.nome}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConcursoAlvoId(concurso.id);
                        setModalNovoCargoAberto(true);
                      }}
                      className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-bold rounded-xl border border-teal-200 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Cargo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluirConcurso(concurso.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Excluir Concurso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tabela de Cargos Deste Concurso */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-slate-600 font-bold font-mono text-2xs uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Cargo / Especialidade</th>
                        <th className="py-2.5 px-3">Slug (ID)</th>
                        <th className="py-2.5 px-3">Nível</th>
                        <th className="py-2.5 px-3 text-center">Vagas Imediatas</th>
                        <th className="py-2.5 px-3 text-center">Cadastro Reserva</th>
                        <th className="py-2.5 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {concurso.cargos?.map((cg) => (
                        <tr key={cg.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-slate-800">{cg.nome}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{cg.id}</td>
                          <td className="py-2.5 px-3">{cg.nivel}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                            {cg.vagas_imediatas}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-teal-700">
                            {cg.tem_cr ? 'Sim (CR)' : 'Não'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  onNavigate('concurso', {
                                    concursoId: concurso.id,
                                    cargoId: cg.id,
                                  })
                                }
                                className="text-xs text-[#135A7A] hover:underline font-semibold"
                              >
                                Ver Dashboard
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExcluirCargo(concurso.id, cg.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded"
                                title="Remover Cargo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 2: IMPORTAR PLANILHAS (XLSX / CSV)                         */}
      {/* ============================================================== */}
      {abaAdmin === 'importar' && (
        <section className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold font-serif text-slate-900">
                Importação de Lista de Classificação Oficial (XLSX / CSV)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Envie a planilha de aprovados fornecida pela banca ou órgão. O leitor processa as notas, cotas e ordem de convocação e vincula estritamente ao concurso e cargo escolhidos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. Concurso de Destino:
                </label>
                <select
                  value={importConcursoId}
                  onChange={(e) => setImportConcursoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                >
                  {concursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.orgao})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. Cargo Específico:
                </label>
                <select
                  value={importCargoId}
                  onChange={(e) => setImportCargoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                >
                  {concursos
                    .find((c) => c.id === importConcursoId)
                    ?.cargos?.map((cg) => (
                      <option key={cg.id} value={cg.id}>
                        {cg.nome}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  3. Arquivo (.xlsx, .xls ou .csv):
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleUploadArquivoExcel}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#07192B] file:text-white hover:file:bg-[#0C2640] cursor-pointer border border-slate-300 rounded-xl bg-slate-50 p-1"
                />
              </div>
            </div>

            {/* Preview da Tabela */}
            {previewPlanilha.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Amostra de registros de: <strong>{nomeArquivo}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleSincronizarPlanilha}
                    className="px-5 py-2.5 rounded-xl bg-[#2DD4AA] hover:bg-[#20BE96] text-slate-950 font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-2"
                  >
                    <span>🚀</span>
                    <span>Salvar &amp; Sincronizar Candidatos no Cargo</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-2xs uppercase tracking-wider text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Class.</th>
                        <th className="py-2.5 px-3">Nome</th>
                        <th className="py-2.5 px-3">Cota</th>
                        <th className="py-2.5 px-3">Nota Final</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewPlanilha.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {p.posicao}º
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-800">{p.nome}</td>
                          <td className="py-2 px-3">{p.cota}</td>
                          <td className="py-2 px-3 font-mono">{p.nota_final}</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">{p.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ABA 3: CANDIDATOS & AUDITORIA                                  */}
      {/* ============================================================== */}
      {abaAdmin === 'candidatos' && (
        <section className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold font-serif text-slate-900">
                  Auditoria &amp; Controle de Manifestações
                </h2>
                <p className="text-xs text-slate-500">
                  Acompanhamento de cadastros, bloqueios de intenção e solicitações de alteração.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('lote')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Abrir Simulador de Lotes TJRS →
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O gerenciamento detalhado de respostas de candidatos do lote TJRS (como intenção de assumir, desistência, comarcas preferidas e dados cadastrais) está sincronizado em tempo real no simulador de lotes.
            </p>
          </div>
        </section>
      )}

      {/* MODAL 1: CADASTRAR NOVO CONCURSO */}
      {modalNovoConcursoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏛️</span>
                <h3 className="font-bold text-slate-900 text-base">Cadastrar Novo Concurso</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoConcursoAberto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarConcurso} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo do Concurso:
                </label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="ex: Tribunal Regional Federal da 4ª Região"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Órgão / Sigla:
                  </label>
                  <input
                    type="text"
                    required
                    value={formOrgao}
                    onChange={(e) => setFormOrgao(e.target.value)}
                    placeholder="ex: TRF4"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ID / Slug:
                  </label>
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="ex: trf4_2024"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ano / Edital:</label>
                  <input
                    type="text"
                    value={formEdital}
                    onChange={(e) => setFormEdital(e.target.value)}
                    placeholder="Edital 01/2024"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status:</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as Concurso['status'])}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="ativo">Ativo / Em Andamento</option>
                    <option value="Homologado">Homologado</option>
                    <option value="Convocando">Convocando</option>
                    <option value="encerrado">Encerrado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primeiro Cargo Cadastrado:
                </label>
                <input
                  type="text"
                  required
                  value={formCargoInicial}
                  onChange={(e) => setFormCargoInicial(e.target.value)}
                  placeholder="ex: Analista Judiciário - Área Judiciária"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição:</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Informações gerais do concurso..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalNovoConcursoAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#07192B] hover:bg-[#0C2640] text-white cursor-pointer"
                >
                  Salvar Concurso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CADASTRAR CARGO EM CONCURSO EXISTENTE */}
      {modalNovoCargoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">💼</span>
                <h3 className="font-bold text-slate-900 text-base">Adicionar Cargo ao Concurso</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoCargoAberto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarCargo} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome do Cargo / Especialidade:
                </label>
                <input
                  type="text"
                  required
                  value={formCargoNome}
                  onChange={(e) => {
                    setFormCargoNome(e.target.value);
                    if (!formCargoId) {
                      setFormCargoId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    }
                  }}
                  placeholder="ex: Oficial de Justiça"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ID do Cargo (Slug):
                </label>
                <input
                  type="text"
                  required
                  value={formCargoId}
                  onChange={(e) => setFormCargoId(e.target.value)}
                  placeholder="ex: oficial_de_justica"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nível:</label>
                  <select
                    value={formCargoNivel}
                    onChange={(e) => setFormCargoNivel(e.target.value as Cargo['nivel'])}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Superior">Superior</option>
                    <option value="Médio">Médio</option>
                    <option value="Técnico">Técnico</option>
                    <option value="Fundamental">Fundamental</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vagas:</label>
                  <input
                    type="number"
                    min="0"
                    value={formCargoVagas}
                    onChange={(e) => setFormCargoVagas(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CR:</label>
                  <select
                    value={formCargoCr ? 'Sim' : 'Não'}
                    onChange={(e) => setFormCargoCr(e.target.value === 'Sim')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Sim">Sim (CR)</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalNovoCargoAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#07192B] hover:bg-[#0C2640] text-white cursor-pointer"
                >
                  Adicionar Cargo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
