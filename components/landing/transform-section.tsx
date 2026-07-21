'use client';

import { motion } from 'framer-motion';

const transformations = [
  { before: 'Passo o dia apagando incêndios.', after: 'Agora sei exatamente como minha loja está.' },
  { before: 'Será que vendi?', after: 'Já vi no celular.' },
  { before: 'Será que tenho dinheiro?', after: 'Já sei como está meu caixa.' },
  { before: 'Não sei por onde começar.', after: 'O sistema já mostrou minhas prioridades.' },
];

export function TransformSection() {
  return (
    <section className="py-24 lg:py-32 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            A transformação
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Do caos à clareza em poucos dias.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {transformations.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg">😓</span>
                  <p className="text-sm text-gray-400 line-through">{item.before}</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-lg">😌</span>
                  <p className="text-sm text-gray-900 font-medium">{item.after}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
