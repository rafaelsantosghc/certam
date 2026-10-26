import React, { useState, useMemo, useEffect } from 'react';
import { certamStore } from '../store/certamStore';
import { lotesStore } from '../store/lotesStore';
import { faqStore } from '../store/faqStore';
import { useAuth } from '../store/authContext';
import { Concurso, Cargo, Candidato, FaqItem, FaqCategoria } from '../types';
import { sanitizeInput, sanitizeFileName } from '../utils/security';
import * as XLSX from 'xlsx';
import {
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Users,
  Building,
  Pencil,
  Check,
  HelpCircle,
  Bookmark,
  Sparkles,
} from 'lucide-react';

interface AdminPanelProps {
  initialTab?: 'concursos' | 'importar' | 'candidatos' | 'faq';
  onNavigate: (view: string, params?: { concursoId?: string; cargoId?: string; tab?: string }) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  initialTab = 'concursos',
  onNavigate,
}) => {
  const [abaAdmin, setAbaAdmin] = useState<'concursos' | 'importar' | 'candidatos' | 'faq'>(initialTab);

  const [concursos, setConcursos] = useState<Concurso[]>(() => certamStore.getConcursos());
  const [busca, setBusca] = useState('');

  // Modais e Estados de FAQ
  const [faqs, setFaqs] = useState<FaqItem[]>(() => faqStore.getFaqs());
  const [buscaFaq, setBuscaFaq] = useState('');
  const [modalNovoFaqAberto, setModalNovoFaqAberto] = useState(false);
  const [modalEditarFaqAberto, setModalEditarFaqAberto] = useState(false);
  const [faqEditandoId, setFaqEditandoId] = useState<string>('');
  const [faqPergunta, setFaqPergunta] = useState('');
  const [faqResposta, setFaqResposta] = useState('');
  const [faqCategoria, setFaqCategoria] = useState<FaqCategoria>('Remuneração e Benefícios');
  const [faqConcursoId, setFaqConcursoId] = useState<string>('tjrs_2024');
  const [faqDestaque, setFaqDestaque] = useState(false);
  const [faqTags, setFaqTags] = useState('');

  useEffect(() => {
    const handleFaqUpdate = () => setFaqs(faqStore.getFaqs());
    window.addEventListener('certam_faq_updated', handleFaqUpdate);
    return () => window.removeEventListener('certam_faq_updated', handleFaqUpdate);
  }, []);

  // Modais de Criação
  const [modalNovoConcursoAberto, setModalNovoConcursoAberto] = useState(false);
  const [modalNovoCargoAberto, setModalNovoCargoAberto] = useState(false);
  const [concursoAlvoId, setConcursoAlvoId] = useState<string>('');

  // Modais de Edição
  const [modalEditarConcursoAberto, setModalEditarConcursoAberto] = useState(false);
  const [concursoEditando, setConcursoEditando] = useState<Concurso | null>(null);
  const [editConcursoNome, setEditConcursoNome] = useState('');
  const [editConcursoOrgao, setEditConcursoOrgao] = useState('');
  const [editConcursoAno, setEditConcursoAno] = useState('');
  const [editConcursoEdital, setEditConcursoEdital] = useState('');
  const [editConcursoStatus, setEditConcursoStatus] = useState<Concurso['status']>('ativo');
  const [editConcursoDesc, setEditConcursoDesc] = useState('');

  const [modalEditarCargoAberto, setModalEditarCargoAberto] = useState(false);
  const [cargoEditando, setCargoEditando] = useState<Cargo | null>(null);
  const [cargoEditandoConcursoId, setCargoEditandoConcursoId] = useState<string>('');
  const [editCargoNome, setEditCargoNome] = useState('');
  const [editCargoNivel, setEditCargoNivel] = useState<Cargo['nivel']>('Superior');
  const [editCargoVagas, setEditCargoVagas] = useState(0);
  const [editCargoCr, setEditCargoCr] = useState(true);
  const [editCargoAtivo, setEditCargoAtivo] = useState(true);

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

  // Abrir Modal de Edição de Concurso
  const abrirEdicaoConcurso = (conc: Concurso) => {
    setConcursoEditando(conc);
    setEditConcursoNome(conc.nome);
    setEditConcursoOrgao(conc.orgao);
    setEditConcursoAno(conc.ano || '2024');
    setEditConcursoEdital(conc.edital || '');
    setEditConcursoStatus(conc.status || 'ativo');
    setEditConcursoDesc(conc.descricao || '');
    setModalEditarConcursoAberto(true);
  };

  // Salvar Edição de Concurso
  const handleSalvarEdicaoConcurso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!concursoEditando) return;
    const atualizado: Concurso = {
      ...concursoEditando,
      nome: editConcursoNome,
      orgao: editConcursoOrgao,
      ano: editConcursoAno,
      edital: editConcursoEdital,
      status: editConcursoStatus,
      descricao: editConcursoDesc,
    };
    certamStore.salvarConcurso(atualizado);
    reloadData();
    setModalEditarConcursoAberto(false);
    showToast('Concurso atualizado com sucesso!');
  };

  // Abrir Modal de Edição de Cargo
  const abrirEdicaoCargo = (cid: string, cg: Cargo) => {
    setCargoEditandoConcursoId(cid);
    setCargoEditando(cg);
    setEditCargoNome(cg.nome);
    setEditCargoNivel(cg.nivel);
    setEditCargoVagas(cg.vagas_imediatas);
    setEditCargoCr(cg.tem_cr);
    setEditCargoAtivo(cg.ativo ?? true);
    setModalEditarCargoAberto(true);
  };

  // Salvar Edição de Cargo
  const handleSalvarEdicaoCargo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoEditando || !cargoEditandoConcursoId) return;
    const atualizado: Cargo = {
      ...cargoEditando,
      nome: editCargoNome,
      nivel: editCargoNivel,
      vagas_imediatas: Number(editCargoVagas) || 0,
      tem_cr: editCargoCr,
      ativo: editCargoAtivo,
    };
    certamStore.salvarCargo(cargoEditandoConcursoId, atualizado);
    reloadData();
    setModalEditarCargoAberto(false);
    showToast('Cargo atualizado com sucesso!');
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

  // FAQ Handlers
  const handleSalvarNovoFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqPergunta.trim() || !faqResposta.trim()) return;
    const tagsArray = faqTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    faqStore.salvarFaq({
      id: `faq-${Date.now()}`,
      pergunta: faqPergunta.trim(),
      resposta: faqResposta.trim(),
      categoria: faqCategoria,
      concurso_id: faqConcursoId === 'geral' ? '' : faqConcursoId,
      destaque: faqDestaque,
      tags: tagsArray,
    });
    setModalNovoFaqAberto(false);
    setFaqPergunta('');
    setFaqResposta('');
    setFaqTags('');
    setFaqDestaque(false);
    showToast('Dúvida adicionada à Central de FAQ!');
  };

  const abrirEdicaoFaq = (f: FaqItem) => {
    setFaqEditandoId(f.id);
    setFaqPergunta(f.pergunta);
    setFaqResposta(f.resposta);
    setFaqCategoria(f.categoria);
    setFaqConcursoId(f.concurso_id || 'geral');
    setFaqDestaque(Boolean(f.destaque));
    setFaqTags(f.tags?.join(', ') || '');
    setModalEditarFaqAberto(true);
  };

  const handleSalvarEdicaoFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqEditandoId || !faqPergunta.trim() || !faqResposta.trim()) return;
    const tagsArray = faqTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    faqStore.salvarFaq({
      id: faqEditandoId,
      pergunta: faqPergunta.trim(),
      resposta: faqResposta.trim(),
      categoria: faqCategoria,
      concurso_id: faqConcursoId === 'geral' ? '' : faqConcursoId,
      destaque: faqDestaque,
      tags: tagsArray,
    });
    setModalEditarFaqAberto(false);
    showToast('Dúvida do FAQ atualizada!');
  };

  const handleAlternarDestaqueFaq = (f: FaqItem) => {
    faqStore.salvarFaq({ ...f, destaque: !f.destaque });
    showToast(f.destaque ? 'Destaque removido.' : 'Pergunta marcada como destaque!');
  };

  const handleExcluirFaq = (id: string) => {
    if (confirm('Deseja realmente excluir esta dúvida do FAQ?')) {
      faqStore.excluirFaq(id);
      showToast('Dúvida removida do FAQ.');
    }
  };

  // Processar Planilha XLSX/CSV via SheetJS
  const handleUploadArquivoExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Protecao contra exaustao de memoria e DoS (limite maximo de 10 MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('O arquivo selecionado ultrapassa o limite seguro de 10 MB.');
      return;
    }

    const nomeSeguro = sanitizeFileName(file.name);
    setNomeArquivo(nomeSeguro);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Skip header rows if any and extract records (com sanitizacao rigorosa)
        const parsed: Partial<Candidato>[] = [];
        const maxLinhas = Math.min(data.length, 10000); // Limite de seguranca contra congelamento do navegador
        for (let i = 1; i < maxLinhas; i++) {
          const row = data[i] as (string | number | undefined)[];
          if (!row || row.length < 2) continue;
          const pos = Math.max(1, Math.min(100000, Number(row[0]) || i));
          const nome = sanitizeInput(String(row[1] || `Candidato ${i}`), 100);
          const cota = (sanitizeInput(String(row[2] || 'Ampla'), 30) as Candidato['cota']) || 'Ampla';
          const nota = Math.max(0, Math.min(100, Number(row[3]) || 80.0));
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
        showToast(`${parsed.length} registros processados do arquivo com sucesso!`);
      } catch {
        showToast('Erro ao processar planilha. Verifique o formato do arquivo.');
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

          <button
            type="button"
            onClick={() => setAbaAdmin('faq')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              abaAdmin === 'faq'
                ? 'bg-[#0C2640] text-[#2DD4AA]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Perguntas Frequentes (FAQ)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-teal-500/20 text-[#2DD4AA] font-mono">
              {faqs.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {abaAdmin === 'faq' ? (
            <button
              type="button"
              onClick={() => {
                setFaqPergunta('');
                setFaqResposta('');
                setFaqTags('');
                setFaqDestaque(false);
                setFaqCategoria('Remuneração e Benefícios');
                setFaqConcursoId(concursos[0]?.id || 'tjrs_2024');
                setModalNovoFaqAberto(true);
              }}
              className="bg-[#2DD4AA] hover:bg-[#20BE96] text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Dúvida / FAQ</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalNovoConcursoAberto(true)}
              className="bg-[#2DD4AA] hover:bg-[#20BE96] text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Concurso</span>
            </button>
          )}
        </div>
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
                      onClick={() => abrirEdicaoConcurso(concurso)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200"
                      title="Editar dados deste concurso"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      <span>Editar Concurso</span>
                    </button>
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
                                onClick={() => abrirEdicaoCargo(concurso.id, cg)}
                                className="px-2 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-200"
                                title="Editar dados deste cargo"
                              >
                                <Pencil className="w-3 h-3 text-slate-600" />
                                <span>Editar</span>
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

      {/* ============================================================== */}
      {/* ABA 4: CENTRAL DE PERGUNTAS FREQUENTES (FAQ)                   */}
      {/* ============================================================== */}
      {abaAdmin === 'faq' && (
        <section className="space-y-6">
          {/* Header e Estatísticas do FAQ */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Base de Conhecimento Oficial</span>
              </div>
              <h2 className="text-xl font-bold font-serif text-slate-900">
                Perguntas Frequentes &amp; Orientações Cadastradas
              </h2>
              <p className="text-xs text-slate-500">
                Tire as dúvidas dos candidatos antes das audiências. Cadastre orientações sobre posse, salário, comarcas e recursos.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-2xl font-mono font-extrabold text-slate-900">{faqs.length}</span>
                <span className="block text-[11px] text-slate-400">perguntas ativas</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFaqPergunta('');
                  setFaqResposta('');
                  setFaqTags('');
                  setFaqDestaque(false);
                  setFaqCategoria('Remuneração e Benefícios');
                  setFaqConcursoId(concursos[0]?.id || 'tjrs_2024');
                  setModalNovoFaqAberto(true);
                }}
                className="bg-[#07192B] hover:bg-[#0C2640] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4 text-[#2DD4AA]" />
                <span>Adicionar Dúvida</span>
              </button>
            </div>
          </div>

          {/* Campo de Busca de Dúvidas */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 card-shadow">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={buscaFaq}
                onChange={(e) => setBuscaFaq(e.target.value)}
                placeholder="Buscar nas dúvidas e respostas cadastradas..."
                className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
              />
            </div>
          </div>

          {/* Lista de FAQs Cadastrados */}
          <div className="space-y-3.5">
            {faqs
              .filter((f) => {
                if (!buscaFaq.trim()) return true;
                const b = buscaFaq.toLowerCase();
                return (
                  f.pergunta.toLowerCase().includes(b) ||
                  f.resposta.toLowerCase().includes(b) ||
                  f.categoria.toLowerCase().includes(b)
                );
              })
              .map((faq) => {
                const conc = concursos.find((c) => c.id === faq.concurso_id);
                return (
                  <div
                    key={faq.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 card-shadow hover:border-slate-300 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {faq.categoria}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                            {conc ? conc.orgao : 'Geral / Todos os Concursos'}
                          </span>
                          {faq.destaque && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <Bookmark className="w-3 h-3 fill-amber-500 text-amber-500" />
                              Destaque
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          {faq.pergunta}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAlternarDestaqueFaq(faq)}
                          className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                            faq.destaque
                              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Alternar Destaque"
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${faq.destaque ? 'fill-amber-500 text-amber-500' : ''}`} />
                          <span className="hidden sm:inline">{faq.destaque ? 'Em Destaque' : 'Destacar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => abrirEdicaoFaq(faq)}
                          className="p-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Editar Dúvida"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-500" />
                          <span className="hidden sm:inline">Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExcluirFaq(faq.id)}
                          className="p-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Excluir Dúvida"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100 whitespace-pre-line">
                      {faq.resposta}
                    </p>

                    {faq.tags && faq.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-400">
                        <span>Tags:</span>
                        {faq.tags.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* Modal Editar Concurso */}
      {modalEditarConcursoAberto && concursoEditando && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Editar Concurso</h3>
                  <p className="text-[11px] text-slate-500">ID: {concursoEditando.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarConcursoAberto(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoConcurso} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo do Concurso:
                </label>
                <input
                  type="text"
                  required
                  value={editConcursoNome}
                  onChange={(e) => setEditConcursoNome(e.target.value)}
                  placeholder="ex: Concurso TJRS - Tribunal de Justiça do RS"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Órgão / Sigla:</label>
                  <input
                    type="text"
                    required
                    value={editConcursoOrgao}
                    onChange={(e) => setEditConcursoOrgao(e.target.value)}
                    placeholder="ex: TJRS"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ano:</label>
                  <input
                    type="text"
                    required
                    value={editConcursoAno}
                    onChange={(e) => setEditConcursoAno(e.target.value)}
                    placeholder="ex: 2024"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Edital:</label>
                  <input
                    type="text"
                    value={editConcursoEdital}
                    onChange={(e) => setEditConcursoEdital(e.target.value)}
                    placeholder="ex: Edital 01/2024"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status:</label>
                  <select
                    value={editConcursoStatus}
                    onChange={(e) => setEditConcursoStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="ativo">Ativo (Em Andamento)</option>
                    <option value="Homologado">Homologado</option>
                    <option value="Convocando">Convocando</option>
                    <option value="Inscrições Abertas">Inscrições Abertas</option>
                    <option value="encerrado">Encerrado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição:</label>
                <textarea
                  rows={3}
                  value={editConcursoDesc}
                  onChange={(e) => setEditConcursoDesc(e.target.value)}
                  placeholder="Informações adicionais do certame..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalEditarConcursoAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#07192B] hover:bg-[#0C2640] text-white flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow"
                >
                  <Check className="w-3.5 h-3.5 text-[#2DD4AA]" />
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Cargo */}
      {modalEditarCargoAberto && cargoEditando && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Editar Cargo</h3>
                  <p className="text-[11px] text-slate-500 font-mono">ID: {cargoEditando.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarCargoAberto(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoCargo} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome do Cargo:
                </label>
                <input
                  type="text"
                  required
                  value={editCargoNome}
                  onChange={(e) => setEditCargoNome(e.target.value)}
                  placeholder="ex: Analista Judiciário"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nível:</label>
                  <select
                    value={editCargoNivel}
                    onChange={(e) => setEditCargoNivel(e.target.value as Cargo['nivel'])}
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
                    value={editCargoVagas}
                    onChange={(e) => setEditCargoVagas(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CR:</label>
                  <select
                    value={editCargoCr ? 'Sim' : 'Não'}
                    onChange={(e) => setEditCargoCr(e.target.value === 'Sim')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Sim">Sim (CR)</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Situação / Status:</label>
                <select
                  value={editCargoAtivo ? 'ativo' : 'inativo'}
                  onChange={(e) => setEditCargoAtivo(e.target.value === 'ativo')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="ativo">Ativo (visível no portal e simulações)</option>
                  <option value="inativo">Inativo (ocultar)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalEditarCargoAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#07192B] hover:bg-[#0C2640] text-white flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow"
                >
                  <Check className="w-3.5 h-3.5 text-[#2DD4AA]" />
                  Salvar Cargo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO FAQ */}
      {modalNovoFaqAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Cadastrar Dúvida / FAQ</h3>
                  <p className="text-[11px] text-slate-500">Adicione orientações práticas para os candidatos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoFaqAberto(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarNovoFaq} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pergunta / Título da Dúvida:
                </label>
                <input
                  type="text"
                  required
                  value={faqPergunta}
                  onChange={(e) => setFaqPergunta(e.target.value)}
                  placeholder="ex: Qual a remuneração inicial e auxílios?"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria:</label>
                  <select
                    value={faqCategoria}
                    onChange={(e) => setFaqCategoria(e.target.value as FaqCategoria)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Remuneração e Benefícios">Remuneração e Benefícios</option>
                    <option value="Escolha de Lotação">Escolha de Lotação</option>
                    <option value="Posse e Documentos">Posse e Documentos</option>
                    <option value="Carreira e Teletrabalho">Carreira e Teletrabalho</option>
                    <option value="Recursos e Classificação">Recursos e Classificação</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Concurso:</label>
                  <select
                    value={faqConcursoId}
                    onChange={(e) => setFaqConcursoId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="geral">Geral (Todos os Concursos)</option>
                    {concursos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.orgao} - {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Resposta Completa:</label>
                <textarea
                  rows={4}
                  required
                  value={faqResposta}
                  onChange={(e) => setFaqResposta(e.target.value)}
                  placeholder="Explique com detalhes e precisão as orientações, normas do tribunal e dicas..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tags de Busca (separadas por vírgula):
                </label>
                <input
                  type="text"
                  value={faqTags}
                  onChange={(e) => setFaqTags(e.target.value)}
                  placeholder="ex: salário, benefícios, pós-graduação"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="faqNovoDestaque"
                  checked={faqDestaque}
                  onChange={(e) => setFaqDestaque(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-[#2DD4AA]"
                />
                <label htmlFor="faqNovoDestaque" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Destacar no topo da central de FAQ (Mais Acessada)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalNovoFaqAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#07192B] hover:bg-[#0C2640] text-white flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow"
                >
                  <Check className="w-3.5 h-3.5 text-[#2DD4AA]" />
                  Cadastrar Dúvida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR FAQ */}
      {modalEditarFaqAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Editar Pergunta do FAQ</h3>
                  <p className="text-[11px] text-slate-500 font-mono">ID: {faqEditandoId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarFaqAberto(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoFaq} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pergunta / Título da Dúvida:
                </label>
                <input
                  type="text"
                  required
                  value={faqPergunta}
                  onChange={(e) => setFaqPergunta(e.target.value)}
                  placeholder="ex: Qual a remuneração inicial e auxílios?"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria:</label>
                  <select
                    value={faqCategoria}
                    onChange={(e) => setFaqCategoria(e.target.value as FaqCategoria)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Remuneração e Benefícios">Remuneração e Benefícios</option>
                    <option value="Escolha de Lotação">Escolha de Lotação</option>
                    <option value="Posse e Documentos">Posse e Documentos</option>
                    <option value="Carreira e Teletrabalho">Carreira e Teletrabalho</option>
                    <option value="Recursos e Classificação">Recursos e Classificação</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Concurso:</label>
                  <select
                    value={faqConcursoId}
                    onChange={(e) => setFaqConcursoId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="geral">Geral (Todos os Concursos)</option>
                    {concursos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.orgao} - {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Resposta Completa:</label>
                <textarea
                  rows={4}
                  required
                  value={faqResposta}
                  onChange={(e) => setFaqResposta(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-[#2DD4AA]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tags de Busca (separadas por vírgula):
                </label>
                <input
                  type="text"
                  value={faqTags}
                  onChange={(e) => setFaqTags(e.target.value)}
                  placeholder="ex: salário, benefícios, pós-graduação"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="faqEditarDestaque"
                  checked={faqDestaque}
                  onChange={(e) => setFaqDestaque(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-[#2DD4AA]"
                />
                <label htmlFor="faqEditarDestaque" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Destacar no topo da central de FAQ (Mais Acessada)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalEditarFaqAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#07192B] hover:bg-[#0C2640] text-white flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow"
                >
                  <Check className="w-3.5 h-3.5 text-[#2DD4AA]" />
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
