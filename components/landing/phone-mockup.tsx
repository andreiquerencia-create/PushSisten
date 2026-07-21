'use client';

export function PhoneMockup() {
  return (
    <div className="relative w-[280px] sm:w-[320px]">
      {/* Phone frame */}
      <div className="relative bg-gray-900 rounded-[3rem] p-3 shadow-2xl shadow-black/20">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-10" />

        {/* Screen */}
        <div className="relative bg-white rounded-[2.25rem] overflow-hidden aspect-[9/19.5]">
          {/* Status bar */}
          <div className="h-12 bg-gradient-to-r from-emerald-600 to-teal-600 flex items-end px-6 pb-2">
            <span className="text-white text-xs font-semibold">PushSisten</span>
          </div>

          {/* Content — Saúde da Loja */}
          <div className="p-4 space-y-4">
            {/* Push Score */}
            <div className="text-center py-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Saúde da Loja</p>
              <div className="mt-2 relative w-20 h-20 mx-auto">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="35" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                  <circle cx="40" cy="40" r="35" fill="none" stroke="#10b981" strokeWidth="6" strokeDasharray="220" strokeDashoffset="44" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">78</span>
                </div>
              </div>
              <p className="text-[10px] text-emerald-600 font-medium mt-1">Saudável</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-xl p-2.5">
                <p className="text-[9px] text-gray-400">Faturamento Hoje</p>
                <p className="text-sm font-bold text-gray-900">R$ 2.847</p>
                <p className="text-[9px] text-emerald-600">↑ 12%</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2.5">
                <p className="text-[9px] text-gray-400">Lucro Líquido</p>
                <p className="text-sm font-bold text-gray-900">R$ 1.240</p>
                <p className="text-[9px] text-emerald-600">↑ 8%</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2.5">
                <p className="text-[9px] text-gray-400">Caixa</p>
                <p className="text-sm font-bold text-gray-900">R$ 15.420</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2.5">
                <p className="text-[9px] text-gray-400">Vendas</p>
                <p className="text-sm font-bold text-gray-900">14</p>
                <p className="text-[9px] text-gray-500">hoje</p>
              </div>
            </div>

            {/* IA Suggestion */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-[8px]">IA</span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-700 leading-relaxed">
                    O estoque da <strong>Calça Jeans Skinny</strong> está acabando. Reponha antes do fim de semana.
                  </p>
                </div>
              </div>
            </div>

            {/* O que fazer hoje */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-400 font-medium">O que fazer hoje</p>
              <div className="flex items-center gap-2 bg-amber-50 rounded-lg p-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <p className="text-[9px] text-gray-700">Cobrar 3 parcelas vencidas</p>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <p className="text-[9px] text-gray-700">Repor 2 produtos em baixa</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Glow effect */}
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-200/20 to-teal-200/20 rounded-[4rem] blur-2xl -z-10" />
    </div>
  );
}
