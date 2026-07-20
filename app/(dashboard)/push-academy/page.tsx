'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { ACADEMY_MODULES, getTotalStepsForModule } from '@/lib/academy/modules';
import { GraduationCap, Clock, ChevronRight, RotateCcw, CheckCircle2, PlayCircle } from 'lucide-react';

interface ProgressItem {
  moduleId: string;
  status: string;
  currentStep: number;
  totalSteps: number;
}

export default function PushAcademyPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/academy-progress')
      .then(res => res.json())
      .then(data => setProgress(data.progress || []))
      .catch(err => console.error('Erro ao carregar progresso:', err))
      .finally(() => setLoading(false));
  }, []);

  const getModuleStatus = (moduleId: string) => {
    const p = progress.find(item => item.moduleId === moduleId);
    if (!p) return 'not_started';
    return p.status;
  };

  const getModuleProgress = (moduleId: string) => {
    const p = progress.find(item => item.moduleId === moduleId);
    if (!p) return 0;
    if (p.totalSteps === 0) return 0;
    return Math.round((p.currentStep / p.totalSteps) * 100);
  };

  const handleStartModule = (moduleId: string) => {
    router.push(`/push-academy/${moduleId}`);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Concluído
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-0.5 rounded-full">
            <PlayCircle className="w-3 h-3" /> Em andamento
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <AppHeader title="Push Academy" />
      <div className="p-4 lg:p-6 space-y-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 border border-border rounded-2xl p-6 lg:p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Aprenda fazendo.</h1>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed max-w-xl">
                Domine o PushSisten com exercícios práticos nas telas reais do sistema.
                Cada módulo ensina uma habilidade que você usará no dia a dia.
              </p>
            </div>
          </div>
        </div>

        {/* Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ACADEMY_MODULES.map((mod) => {
            const status = getModuleStatus(mod.id);
            const progressPercent = getModuleProgress(mod.id);
            const totalSteps = getTotalStepsForModule(mod.id);

            return (
              <div
                key={mod.id}
                onClick={() => handleStartModule(mod.id)}
                className="group bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{mod.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {mod.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {mod.estimatedTime}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          • {totalSteps} passos
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {mod.description}
                </p>

                {/* Progress bar + status */}
                <div className="flex items-center justify-between">
                  {status !== 'not_started' ? (
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            status === 'completed' ? 'bg-emerald-500' : 'bg-primary'
                          }`}
                          style={{ width: `${status === 'completed' ? 100 : progressPercent}%` }}
                        />
                      </div>
                      {statusBadge(status)}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Não iniciado</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
