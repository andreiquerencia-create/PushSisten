'use client';

import { motion } from 'framer-motion';

const steps = [
  { number: '1', title: 'Crie sua conta', description: 'Leva menos de 1 minuto. Sem cartão de crédito.' },
  { number: '2', title: 'Cadastre seus produtos', description: 'Nome, preço e estoque. O Push Academy te guia.' },
  { number: '3', title: 'Comece a vender', description: 'Use o PDV no celular ou computador.' },
  { number: '4', title: 'Acompanhe tudo', description: 'O sistema organiza, analisa e orienta suas decisões.' },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-24 lg:py-32 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Simples de começar.
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Sua loja funcionando em minutos, não em dias.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <span className="text-emerald-700 font-bold text-lg">{step.number}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
