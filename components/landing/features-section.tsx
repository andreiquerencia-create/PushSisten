'use client';

import { motion } from 'framer-motion';
import { TrendingUp, ShoppingBag, Users, Wallet, Brain, HeartPulse } from 'lucide-react';

const features = [
  {
    icon: ShoppingBag,
    title: 'Você vende com agilidade.',
    description: 'PDV rápido no celular ou computador. Busca por nome, código de barras, variações. Tudo em segundos.',
  },
  {
    icon: Wallet,
    title: 'Você sabe exatamente como está seu caixa.',
    description: 'Entradas, saídas, saldos. Tudo atualiza automaticamente. Sem planilhas, sem surpresas no fim do mês.',
  },
  {
    icon: TrendingUp,
    title: 'Você entende seu lucro de verdade.',
    description: 'DRE, margem, custos, despesas. O sistema calcula tudo e mostra onde está indo seu dinheiro.',
  },
  {
    icon: Users,
    title: 'Você conhece seus clientes.',
    description: 'Histórico de compras, crediário, etiquetas, frequência. Saiba quem compra, quem sumiu e quem deve.',
  },
  {
    icon: Brain,
    title: 'Você recebe orientações todos os dias.',
    description: 'A IA Gerente analisa sua loja e sugere ações: o que repor, quem cobrar, onde economizar.',
  },
  {
    icon: HeartPulse,
    title: 'Você acompanha a saúde da loja.',
    description: 'O Push Score mede vendas, margem, estoque, clientes e financeiro em um único indicador.',
  },
];

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Tudo que sua loja precisa.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
              Em um só lugar.
            </span>
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Não são funcionalidades. São respostas para as perguntas que você faz todos os dias.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group bg-white border border-gray-100 rounded-2xl p-6 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <feature.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
