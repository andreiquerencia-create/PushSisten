'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'É difícil de usar?',
    answer: 'Não. O PushSisten foi feito para quem nunca usou sistema antes. Tem um guia prático (Push Academy) que te ensina tudo em poucos minutos, usando as telas reais do sistema.',
  },
  {
    question: 'Preciso de computador?',
    answer: 'Não. O sistema funciona 100% no celular. Você pode vender, consultar relatórios e gerenciar tudo pelo smartphone. Se quiser, também funciona no computador.',
  },
  {
    question: 'Quanto tempo leva para começar?',
    answer: 'Menos de 10 minutos. Crie a conta, cadastre seus primeiros produtos e já pode fazer sua primeira venda.',
  },
  {
    question: 'E se eu precisar de ajuda?',
    answer: 'Você tem o Push Academy (guia interativo dentro do sistema) e suporte via WhatsApp. Não vai ficar perdido.',
  },
  {
    question: 'Posso cancelar a qualquer momento?',
    answer: 'Sim. Sem multa, sem burocracia. Cancele quando quiser direto pelo sistema.',
  },
  {
    question: 'Meus dados ficam seguros?',
    answer: 'Sim. Seus dados são armazenados em servidores seguros com backup diário. Ninguém além de você tem acesso.',
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Perguntas frequentes
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
              >
                <span className="text-sm font-medium text-gray-900 pr-4">{faq.question}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-5 pb-4 pt-2"
                >
                  <p className="text-sm text-gray-500 leading-relaxed">{faq.answer}</p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
