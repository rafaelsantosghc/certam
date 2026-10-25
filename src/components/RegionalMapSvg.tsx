import React, { useState } from 'react';
import { REGIOES_INFO } from '../data/comarcas';

interface RegionalMapSvgProps {
  onSelectRegiao?: (regiao: string) => void;
}

export const RegionalMapSvg: React.FC<RegionalMapSvgProps> = ({ onSelectRegiao }) => {
  const [regiaoAtiva, setRegiaoAtiva] = useState<keyof typeof REGIOES_INFO>('Metropolitana');

  const handleSelect = (regiao: keyof typeof REGIOES_INFO) => {
    setRegiaoAtiva(regiao);
    if (onSelectRegiao) {
      onSelectRegiao(regiao);
    }
  };

  const infoAtual = REGIOES_INFO[regiaoAtiva] || REGIOES_INFO.Metropolitana;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <h3 className="text-base font-bold text-slate-900">Escolha de Comarca</h3>
        <select
          value={regiaoAtiva}
          onChange={(e) => handleSelect(e.target.value as keyof typeof REGIOES_INFO)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:ring-1 focus:ring-[#2DD4AA] cursor-pointer"
        >
          <option value="Metropolitana">Metropolitana</option>
          <option value="Serra">Serra Gaúcha</option>
          <option value="Norte">Norte / Noroeste</option>
          <option value="Centro">Centro-Oeste</option>
          <option value="Sul">Sul / Litoral</option>
          <option value="Fronteira">Fronteira Oeste</option>
        </select>
      </div>

      {/* Mapa Vetorial RS Interativo */}
      <div className="w-full bg-slate-50/70 rounded-xl p-4 flex flex-col items-center justify-center relative border border-slate-100">
        <svg
          viewBox="0 0 400 460"
          className="w-full max-h-[320px] drop-shadow-sm select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Região Norte / Noroeste */}
          <path
            d="M 90 25 L 140 12 L 175 48 L 220 38 L 230 100 L 165 155 L 75 150 L 22 115 L 42 65 Z"
            fill={regiaoAtiva === 'Norte' ? '#204060' : '#135A7A'}
            stroke="#FFFFFF"
            strokeWidth={regiaoAtiva === 'Norte' ? '3.5' : '2'}
            className="cursor-pointer hover:opacity-85 transition-all"
            onClick={() => handleSelect('Norte')}
          >
            <title>Região Norte / Noroeste</title>
          </path>

          {/* Região Centro-Oeste */}
          <path
            d="M 165 155 L 230 100 L 268 140 L 255 248 L 190 278 L 145 228 Z"
            fill={regiaoAtiva === 'Centro' ? '#1fb38d' : '#2DD4AA'}
            stroke="#FFFFFF"
            strokeWidth={regiaoAtiva === 'Centro' ? '3.5' : '2'}
            className="cursor-pointer hover:opacity-85 transition-all"
            onClick={() => handleSelect('Centro')}
          >
            <title>Região Centro-Oeste</title>
          </path>

          {/* Região Nordeste / Serra */}
          <path
            d="M 230 100 L 288 72 L 360 115 L 370 172 L 322 228 L 268 198 L 268 140 Z"
            fill={regiaoAtiva === 'Serra' ? '#146e6e' : '#1D8A8A'}
            stroke="#FFFFFF"
            strokeWidth={regiaoAtiva === 'Serra' ? '3.5' : '2'}
            className="cursor-pointer hover:opacity-85 transition-all"
            onClick={() => handleSelect('Serra')}
          >
            <title>Serra / Nordeste</title>
          </path>

          {/* Região Metropolitana / Sudeste */}
          <path
            d="M 255 248 L 268 198 L 322 228 L 335 288 L 278 335 L 220 308 Z"
            fill={regiaoAtiva === 'Metropolitana' ? '#0f3152' : '#07192B'}
            stroke="#FFFFFF"
            strokeWidth={regiaoAtiva === 'Metropolitana' ? '3.5' : '2'}
            className="cursor-pointer hover:opacity-85 transition-all"
            onClick={() => handleSelect('Metropolitana')}
          >
            <title>Região Metropolitana / Porto Alegre</title>
          </path>

          {/* Região Sul / Litoral */}
          <path
            d="M 220 308 L 278 335 L 255 410 L 205 455 L 175 420 L 195 358 Z"
            fill={regiaoAtiva === 'Sul' ? '#2ac99d' : '#3CE3B4'}
            stroke="#FFFFFF"
            strokeWidth={regiaoAtiva === 'Sul' ? '3.5' : '2'}
            className="cursor-pointer hover:opacity-85 transition-all"
            onClick={() => handleSelect('Sul')}
          >
            <title>Sul / Litoral</title>
          </path>

          {/* Sub-divisão Fronteira Oeste */}
          <path
            d="M 75 150 L 165 155 L 145 228 L 92 200 Z"
            fill={regiaoAtiva === 'Fronteira' ? '#0d3844' : '#155263'}
            stroke="#FFFFFF"
            strokeWidth={regiaoAtiva === 'Fronteira' ? '3.5' : '2'}
            className="cursor-pointer hover:opacity-85 transition-all"
            onClick={() => handleSelect('Fronteira')}
          >
            <title>Fronteira Oeste</title>
          </path>
        </svg>

        {/* Legenda Dinâmica da Região */}
        <div className="w-full mt-3 p-3 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs">
          <div className="flex items-center justify-between font-bold text-slate-800">
            <span>{infoAtual.nome}</span>
            <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              Comarcas Polo
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            {infoAtual.polos}
          </p>
        </div>
      </div>
    </div>
  );
};
