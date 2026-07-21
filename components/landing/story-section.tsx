'use client';

import { motion } from 'framer-motion';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-100px' },
  transition: { duration: 0.7, ease: [0.25, 0.1, 0, 1] },
};

export function StorySection() {
  return (
    <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div {...fadeUp}>
          <p className="text-lg sm:text-xl text-gray-400 leading-relaxed">
            Você abriu sua loja para vender, crescer e realizar seus sonhos.
          </p>

          <p className="mt-8 text-lg sm:text-xl text-gray-500 leading-relaxed">
            Mas, com o tempo, vieram as dúvidas:
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-12 space-y-4"
        >
          {[
            'Quanto eu vendi hoje?',
            'Será que estou tendo lucro?',
            'Como está meu caixa?',
            'Qual produto preciso repor?',
            'Quem preciso cobrar?',
            'O que precisa da minha atenção agora?',
          ].map((question, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              className="text-xl sm:text-2xl font-medium text-gray-800"
            >
              "{question}"
            </motion.p>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-16"
        >
          <p className="text-lg text-gray-400">
            Sua loja responde essas perguntas todos os dias.
          </p>
          <p className="mt-3 text-lg text-gray-400">
            O problema é que ninguém traduz essas informações.
          </p>
          <p className="mt-6 text-2xl sm:text-3xl font-bold text-gray-900">
            Até agora.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
