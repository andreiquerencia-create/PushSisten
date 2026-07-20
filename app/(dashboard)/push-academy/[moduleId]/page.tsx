'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAcademy } from '@/components/academy/academy-context';
import { getModuleById } from '@/lib/academy/modules';

export default function AcademyModulePage() {
  const params = useParams();
  const router = useRouter();
  const { startModule } = useAcademy();
  const moduleId = params.moduleId as string;
  const mod = getModuleById(moduleId);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!mod || initialized) return;

    // Carregar progresso salvo e ativar o módulo
    fetch('/api/academy-progress')
      .then(res => res.json())
      .then(data => {
        const p = (data.progress || []).find((item: any) => item.moduleId === moduleId);
        const fromStep = (p && p.status === 'in_progress') ? p.currentStep : 0;

        startModule(moduleId, fromStep);
        setInitialized(true);

        // Navegar para a rota do step atual
        const stepData = mod.steps[fromStep];
        if (stepData?.route) {
          router.replace(stepData.route);
        } else {
          router.replace('/hoje');
        }
      })
      .catch(err => {
        console.error('Erro ao carregar progresso:', err);
        startModule(moduleId, 0);
        setInitialized(true);

        const firstStep = mod.steps[0];
        if (firstStep?.route) {
          router.replace(firstStep.route);
        } else {
          router.replace('/hoje');
        }
      });
  }, [mod, moduleId, initialized, startModule, router]);

  if (!mod) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Módulo não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-2">
        <div className="text-3xl">{mod.icon}</div>
        <p className="text-sm text-muted-foreground animate-pulse">Iniciando {mod.title}...</p>
      </div>
    </div>
  );
}
