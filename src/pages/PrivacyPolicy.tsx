import React from 'react';
import { ArrowLeft, Shield } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#135A7A] hover:text-[#2DD4AA] bg-white px-3.5 py-2 rounded-xl border border-slate-200 card-shadow transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Portal</span>
        </button>

        <span className="text-2xs font-semibold text-teal-700 bg-teal-50 border border-teal-200/60 px-2.5 py-1 rounded-lg font-mono">
          LGPD • Lei nº 13.709/2018
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 card-shadow p-6 sm:p-10 space-y-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 mb-2">
              <Shield className="w-3.5 h-3.5" />
              <span>Transparência &amp; Segurança</span>
            </div>
            <h1 className="text-2xl font-bold font-serif text-slate-900">
              Política de Privacidade CERTAM
            </h1>
          </div>
          <span className="text-xs text-slate-400 font-mono">Atualizado em 2026</span>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-serif text-[#0e4a5b]">1. Sobre a CERTAM</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            A <strong>CERTAM – Portal do Concurseiro</strong> (<em>"Nunca é só uma prova."</em>) é uma plataforma independente voltada a apoiar candidatos em concursos públicos de todo o país. O módulo de <strong>Escolha de Comarcas do TJRS</strong> foi desenvolvido para auxiliar os aprovados a organizar suas preferências e simular a lotação de forma transparente e colaborativa. <strong>A CERTAM não é um canal oficial do TJRS</strong> e suas ferramentas não substituem os procedimentos, editais ou convocações oficiais dos órgãos públicos realizadores.
          </p>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Esta política explica quais dados pessoais são coletados, para que são usados e quais são os seus direitos, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-serif text-[#0e4a5b]">2. Dados Coletados</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Coletamos apenas os dados necessários ao funcionamento da simulação:
          </p>
          <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-600 space-y-1 leading-relaxed">
            <li><strong>Dados da conta Google:</strong> endereço de e-mail e nome, obtidos no login, usados exclusivamente para identificar o seu acesso;</li>
            <li><strong>Dados de identificação:</strong> nome completo, CPF e número de WhatsApp informados no cadastro;</li>
            <li><strong>Dados do concurso:</strong> posição na classificação e a lista ordenada das comarcas de sua preferência;</li>
            <li><strong>Dados funcionais (quando aplicável):</strong> cargo, número de registro/matrícula e comarca atual, para quem já ocupa função no Tribunal;</li>
            <li><strong>Dados técnicos:</strong> informações salvas no armazenamento local do seu navegador para manter a sessão e preferências de interface.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-serif text-[#0e4a5b]">3. Finalidade do Uso</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Os dados são utilizados exclusivamente para:
          </p>
          <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-600 space-y-1 leading-relaxed">
            <li>Identificar cada candidato e evitar cadastros duplicados;</li>
            <li>Calcular a simulação de lotação, considerando a ordem de classificação e as preferências de comarcas;</li>
            <li>Exibir rankings e estatísticas agregadas aos candidatos;</li>
            <li>Permitir o contato do administrador com o candidato, quando necessário.</li>
          </ul>
          <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-2">
            Os dados não são vendidos, alugados nem utilizados para fins publicitários.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-serif text-[#0e4a5b]">4. Armazenamento &amp; Segurança</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Adotamos medidas modernas para proteger as informações, incluindo conexões seguras criptografadas (HTTPS/TLS), políticas de segurança em nível de linha (Row Level Security - RLS) no banco de dados, restrição das funções administrativas ao administrador autorizado (<strong>rafasms0@hotmail.com</strong>) e bloqueio da alteração de dados pessoais após a confirmação do cadastro.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-serif text-[#0e4a5b]">5. Contato &amp; Direitos</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Conforme o art. 18 da LGPD, você pode, a qualquer momento, confirmar a existência de tratamento, corrigir dados ou solicitar a exclusão de suas manifestações contatando o administrador em <a href="mailto:rafasms0@hotmail.com" className="text-teal-700 font-semibold underline">rafasms0@hotmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
};
