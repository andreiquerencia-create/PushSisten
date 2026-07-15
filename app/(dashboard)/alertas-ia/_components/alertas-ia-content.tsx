'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert, AlertTriangle, Eye, CheckCircle2, RefreshCw, Brain,
  Filter, Clock, Lightbulb, X, Sparkles, Zap,
} from 'lucide-react';
import { toast } from 'sonner';

const alertIcons: Record<string, any> = { critical: ShieldAlert, important: AlertTriangle, observation: Eye };
const alertLabels: Record<string, string> = { critical: 'Crítico', important: 'Importante', observation: 'Observação' };
const alertColors: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-50/60',
  important: 'border-l-amber-500 bg-amber-50/60',
  observation: 'border-l-blue-500 bg-blue-50/60',
};
const alertBadgeColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  important: 'bg-amber-100 text-amber-700',
  observation: 'bg-blue-100 text-blue-700',
};
const catLabels: Record<string, string> = {
  financial: 'Financeiro', stock: 'Estoque', crm: 'CRM', commercial: 'Comercial', sellers: 'Vendedores', general: 'Geral',
};

interface Alert {
  id: string; type: string; category: string; title: string; description: string;
  suggestion: string | null; impact: string | null; isResolved: boolean;
  resolvedAt: string | null; resolvedBy: string | null; createdAt: string;
}

export function AlertasIAContent() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState({ critical: 0, important: 0, observation: 0, total: 0 });
  const [filter, setFilter] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      if (!showResolved) params.set('resolved', 'false');
      params.set('limit', '100');
      const res = await fetch(`/api/ia-gerente/alerts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts ?? []);
        setCounts(data.counts ?? { critical: 0, important: 0, observation: 0, total: 0 });
      }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, [filter, showResolved]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/ia-gerente/analyze', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Análise concluída: ${data.newAlertsCount} novos alertas`);
      }
      await fetchAlerts();
    } catch (e: any) { console.error(e); } finally { setAnalyzing(false); }
  }, [fetchAlerts]);

  const resolveAlert = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/ia-gerente/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isResolved: true }),
      });
      if (res.ok) {
        toast.success('Alerta resolvido');
        fetchAlerts();
      }
    } catch (e: any) { console.error(e); }
  }, [fetchAlerts]);

  const filters = [
    { key: 'all', label: 'Todos', count: counts.total },
    { key: 'critical', label: 'Críticos', count: counts.critical, icon: ShieldAlert, color: 'text-red-600' },
    { key: 'important', label: 'Importantes', count: counts.important, icon: AlertTriangle, color: 'text-amber-600' },
    { key: 'observation', label: 'Observações', count: counts.observation, icon: Eye, color: 'text-blue-600' },
  ];

  return (
    <div className="min-h-screen"><AppHeader title="Central de Alertas IA" />
      <div className="p-4 lg:p-6 space-y-6">
        {/* Stats */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {filters.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}>
                {f.icon && <f.icon className={`w-3.5 h-3.5 ${filter === f.key ? '' : f.color}`} />}
                {f.label}
                {f.count > 0 && <Badge variant="secondary" className="text-xs ml-1 h-5">{f.count}</Badge>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={showResolved ? 'default' : 'outline'} onClick={() => setShowResolved(!showResolved)} className="gap-1 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />{showResolved ? 'Ocultar resolvidos' : 'Ver resolvidos'}
            </Button>
            <Button size="sm" onClick={runAnalysis} disabled={analyzing} className="gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
              {analyzing ? 'Analisando...' : 'Nova Análise'}
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Brain className="w-10 h-10 text-blue-600 animate-pulse" /></div>
        ) : alerts.length === 0 ? (
          <Card className="border-0 shadow-sm"><CardContent className="p-10 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
            <h3 className="font-display font-bold text-lg mb-1">Tudo sob controle!</h3>
            <p className="text-sm text-muted-foreground">Nenhum alerta pendente. Clique em &quot;Nova Análise&quot; para verificar.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => {
              const AlertIcon = alertIcons[alert.type] ?? Eye;
              return (
                <Card key={alert.id} className={`border-0 border-l-4 shadow-sm ${alert.isResolved ? 'opacity-60 bg-muted/30' : alertColors[alert.type] ?? ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5"><AlertIcon className="w-5 h-5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold text-sm">{alert.title}</h4>
                          <Badge variant="outline" className={`text-[10px] ${alertBadgeColors[alert.type] ?? ''}`}>{alertLabels[alert.type] ?? alert.type}</Badge>
                          <Badge variant="outline" className="text-[10px]">{catLabels[alert.category] ?? alert.category}</Badge>
                          {alert.isResolved && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Resolvido</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                        {alert.suggestion && (
                          <div className="flex items-start gap-1.5 text-xs bg-blue-50/50 rounded-lg p-2 mb-2">
                            <Lightbulb className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span className="text-blue-700">{alert.suggestion}</span>
                          </div>
                        )}
                        {alert.impact && <p className="text-xs text-red-600"><Zap className="w-3 h-3 inline mr-1" />Impacto: {alert.impact}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-muted-foreground"><Clock className="w-3 h-3 inline mr-1" />{new Date(alert.createdAt).toLocaleDateString('pt-BR')} {new Date(alert.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          {alert.resolvedBy && <span className="text-[10px] text-emerald-600">Resolvido por {alert.resolvedBy}</span>}
                        </div>
                      </div>
                      {!alert.isResolved && (
                        <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)} className="text-xs gap-1 flex-shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolver
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
