'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export function CtaSection() {
  return (
    <section className="py-24 lg:py-32 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
            Sua loja já está falando com você{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
              todos os dias.
            </span>
          </h2>

          <p className="mt-6 text-lg text-gray-500">
            Está na hora de começar a escutar.
          </p>

          <div className="mt-10">
            <Link href="/signup">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-10 h-14 text-base font-medium shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all">
                Começar teste grátis
              </Button>
            </Link>
            <p className="mt-4 text-sm text-gray-400">
              Sem cartão de crédito • Cancele quando quiser
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
