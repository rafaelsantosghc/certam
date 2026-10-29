import React, { useState, useEffect } from 'react';
import { Lote, Candidato } from '../types';
import { lotesStore } from '../store/lotesStore';
import { certamStore } from '../store/certamStore';
import {
  X,
  MapPin,
  Check,
  ArrowUp,
  ArrowDown,
  Lock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  HelpCircle,
} from 'lucide-react';

interface ModalEscolhaComarcasLoteProps {
  aberto: boolean;
  onClose: () => void;
  lote: Lote;
  candidato: Candidato | null;
  concursoId: string;
  cargoId: string;
  onSalvo?: () => void;
}

export const ModalEscolhaComarcasLote: React.FC<ModalEscolhaComarcasLoteProps> = ({
  aberto,
  onClose,
  lote,
  candidato,
  concursoId,
  cargoId,
  onSalvo,
}) => {
  const concurso = certamStore.getConcurso(concursoId);
  const tipoLotacao = concurso?.tipo_lotacao || 'Lotação';
  const [intencao, setIntencao] = useState<Candidato['intencao']>('Sim');
  const [escolhas, setEscolhas] = useState<string[]>([]);
  const [possuiFg, setPossuiFg] = useState(false);
  const [fgRegistro, setFgRegistro] = useState('');
  const [fgCargo, setFgCargo] = useState('');
  const [fgComarca, setFgComarca] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState(false);

  const comarcasOfertadas = lote.comarcas || [];
  const loteTravado = Boolean(lote.travado);

  useEffect(() => {
    if (candidato) {
      setIntencao(candidato.intencao || 'Sim');
      // Filtra as escolhas anteriores para comarcas que realmente pertencem a este lote
      const nomesValidos = new Set(comarcasOfertadas.map((c) => c.nome));
      const escolhasIniciais = (candidato.escolhas_comarcas || []).filter((nome) => nomesValidos.has(nome));

      // Se não tinha escolhas ou sobraram poucas, preenche com as comarcas do lote
      if (escolhasIniciais.length === 0) {
        setEscolhas(comarcasOfertadas.map((c) => c.nome));
      } else {
        // Garante que todas as comarcas do lote estejam na lista
        const naoListadas = comarcasOfertadas.map((c) => c.nome).filter((n) => !escolhasIniciais.includes(n));
        setEscolhas([...escolhasIniciais, ...naoListadas]);
      }

      if (candidato.fg_cc) {
        setPossuiFg(candidato.fg_cc.possui || false);
        setFgRegistro(candidato.fg_cc.registro_funcional || '');
        setFgCargo(candidato.fg_cc.cargo_atual || '');
        setFgComarca(candidato.fg_cc.comarca_atual || '');
      }
    } else {
      setEscolhas(comarcasOfertadas.map((c) => c.nome));
    }
    setMensagemSucesso(false);
  }, [candidato, lote, aberto]);

  if (!aberto) return null;

  const moverOpcao = (index: number, direcao: 'cima' | 'baixo') => {
    if (loteTravado) return;
    const novoArray = [...escolhas];
    const target = direcao === 'cima' ? index - 1 : index + 1;
    if (target < 0 || target >= novoArray.length) return;
    const temp = novoArray[index];
    novoArray[index] = novoArray[target];
    novoArray[target] = temp;
    setEscolhas(novoArray);
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidato) return;

    const statusAtualizado =
      intencao === 'Não'
        ? 'Desistente'
        : intencao === 'final_fila'
        ? 'Final de lista'
        : candidato.status;

    const candidatoAtualizado: Candidato = {
      ...candidato,
      intencao,
      status: statusAtualizado as any,
      escolhas_comarcas: escolhas,
      comarca_desejada_1: escolhas[0] || candidato.comarca_desejada_1,
      numero_lote_convocado: lote.numero_lote || lote.nome,
      fg_cc: {
        possui: possuiFg,
        registro_funcional: fgRegistro,
        cargo_atual: fgCargo,
        comarca_atual: fgComarca,
        pretende_continuar: possuiFg ? 'Sim' : 'Não',
      },
    };

    lotesStore.salvarCandidato(concursoId, cargoId, candidatoAtualizado);
    setMensagemSucesso(true);
    if (onSalvo) onSalvo();

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const comarcaDefinida =
    candidato?.comarca_definitiva ||
    (lote.definicoes_escolhas && candidato?.id && lote.definicoes_escolhas[candidato.id]) ||
    (lote.definicoes_escolhas && candidato?.nome && lote.definicoes_escolhas[candidato.nome]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in-50">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 my-8 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#07192B] text-teal-300 font-mono text-[10px] font-bold uppercase">
                  {lote.nome}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    lote.status_lote === 'escolhas_definidas'
                      ? 'bg-purple-100 text-purple-800'
                      : lote.travado
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {lote.status_lote === 'escolhas_definidas'
                    ? '✓ Escolhas Definidas pelo Órgão'
                    : lote.travado
                    ? '🔒 Escolhas Travadas'
                    : '🟢 Aberto para Manifestação'}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base font-serif mt-1">
                Manifestação e Escolha de {tipoLotacao}s do Lote
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {mensagemSucesso && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">Suas preferências foram salvas com sucesso!</span>
          </div>
        )}

        {comarcaDefinida && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-purple-900 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-purple-950">
              <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0" />
              <span>Comarca Definitivamente Homologada</span>
            </div>
            <p className="text-purple-800">
              Sua alocação oficial após o encerramento da audiência deste lote foi fixada em:{' '}
              <strong className="text-purple-950 underline text-sm">{comarcaDefinida}</strong>.
            </p>
          </div>
        )}

        {loteTravado && !comarcaDefinida && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Este lote está com as manifestações temporariamente bloqueadas para consolidação da audiência.
            </span>
          </div>
        )}

        <form onSubmit={handleSalvar} className="space-y-5 text-xs">
          {/* Seção 1: Intenção de Posse */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <label className="block font-bold text-slate-800 text-xs">
              Sua Intenção em Relação à Posse neste Lote:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  intencao === 'Sim'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="intencao"
                  value="Sim"
                  checked={intencao === 'Sim'}
                  onChange={() => setIntencao('Sim')}
                  disabled={loteTravado}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>Pretendo Assumir (Posse)</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  intencao === 'final_fila'
                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="intencao"
                  value="final_fila"
                  checked={intencao === 'final_fila'}
                  onChange={() => setIntencao('final_fila')}
                  disabled={loteTravado}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span>Pedir Final de Fila</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  intencao === 'Não'
                    ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="intencao"
                  value="Não"
                  checked={intencao === 'Não'}
                  onChange={() => setIntencao('Não')}
                  disabled={loteTravado}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>Desistir do Concurso</span>
              </label>
            </div>
          </div>

          {/* Seção 2: Ordenação das Lotações deste Lote */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">
                  Ordem de Preferência de {tipoLotacao}s ({comarcasOfertadas.length} {tipoLotacao.toLowerCase()}s disponíveis)
                </h4>
                <p className="text-2xs text-slate-500">
                  Use as setas para posicionar suas opções prioritárias no topo (1ª opção, 2ª opção, etc.).
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto bg-white">
              {escolhas.map((comarcaNome, idx) => {
                const infoComarca = comarcasOfertadas.find((c) => c.nome === comarcaNome);
                const vagasQtd = infoComarca?.vagas || 1;

                return (
                  <div
                    key={comarcaNome}
                    className={`flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors ${
                      idx === 0 ? 'bg-teal-50/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                          idx === 0
                            ? 'bg-teal-700 text-white'
                            : idx === 1
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {idx + 1}º
                      </span>
                      <div>
                        <span className="font-bold text-slate-800">{comarcaNome}</span>
                        <span className="text-2xs text-slate-400 ml-2 font-mono">
                          ({vagasQtd} {vagasQtd === 1 ? 'vaga ofertada' : 'vagas ofertadas'})
                        </span>
                      </div>
                    </div>

                    {!loteTravado && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moverOpcao(idx, 'cima')}
                          className="p-1 rounded hover:bg-slate-200 disabled:opacity-20 text-slate-600 cursor-pointer"
                          title="Subir prioridade"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === escolhas.length - 1}
                          onClick={() => moverOpcao(idx, 'baixo')}
                          className="p-1 rounded hover:bg-slate-200 disabled:opacity-20 text-slate-600 cursor-pointer"
                          title="Descer prioridade"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seção 3: FG / CC Opcional */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={possuiFg}
                onChange={(e) => setPossuiFg(e.target.checked)}
                disabled={loteTravado}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
              />
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-teal-600" />
                <span>Já exerço Função Gratificada (FG) ou Cargo em Comissão (CC) no Tribunal</span>
              </span>
            </label>

            {possuiFg && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-2xs font-bold text-slate-600 mb-0.5">Registro Funcional:</label>
                  <input
                    type="text"
                    value={fgRegistro}
                    onChange={(e) => setFgRegistro(e.target.value)}
                    disabled={loteTravado}
                    placeholder="Ex: 123456"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-600 mb-0.5">Cargo / Função Atual:</label>
                  <input
                    type="text"
                    value={fgCargo}
                    onChange={(e) => setFgCargo(e.target.value)}
                    disabled={loteTravado}
                    placeholder="Ex: Assessor de Juiz"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-600 mb-0.5">Comarca de Exercício Atual:</label>
                  <input
                    type="text"
                    value={fgComarca}
                    onChange={(e) => setFgComarca(e.target.value)}
                    disabled={loteTravado}
                    placeholder="Ex: Porto Alegre"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-700 font-semibold cursor-pointer transition-colors"
            >
              Fechar
            </button>
            {!loteTravado && (
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#07192B] hover:bg-[#0C2640] text-[#2DD4AA] font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Preferências no Lote</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
