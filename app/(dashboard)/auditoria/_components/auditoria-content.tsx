'use client';

import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Shield, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

type CheckStatus = 'OK' | 'ALERTA' | 'CRÍTICO';

interface AuditCheck {
  id: string;
  title: string;
  category: string;
  status: CheckStatus;
  count: number;
  message: string;
  details?: any[];
  recommendation?: string;
}

interface AuditReport {
  companyId: string;
  generatedAt: string;
  summary: { total: number; ok: number; alerta: number; critico: number };
  checks: AuditCheck[];
}

export default function AuditoriaContent() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [reprocessing, setReprocessing] = useState(false);

  const reprocessar = async () => {
    setReprocessing(true);
    try {
      const res = await fetch('/api/reprocessar', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Erro ao reprocessar');
      const n = j?.customers?.corrigidos ?? 0;
      toast.success(n > 0 ? `Reprocessamento concluído: ${n} cliente(s) corrigido(s).` : 'Reprocessamento concluído: nenhuma divergência encontrada.');
      await fetchAudit();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao reprocessar');
    } finally {
      setReprocessing(false);
    }
  };

  const fetchAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auditoria', { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error || 'Erro ao gerar auditoria');
      }
      const data = await res.json();
      setReport(data);
    } catch (e: any) {
      setError(e?.message || 'Erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudit(); }, []);

  const toggle = (id: string) => {
    const n = new Set(expanded);
    if (n.has(id)) n.delete(id); else n.add(id);
    setExpanded(n);
  };

  const statusIcon = (s: CheckStatus) => {
    if (s === 'OK') return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (s === 'ALERTA') return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <AlertCircle className="w-5 h-5 text-red-600" />;
  };

  const statusBadge = (s: CheckStatus) => {
    if (s === 'OK') return <Badge variant="outline" className="border-green-500/50 text-green-700 bg-green-50">OK</Badge>;
    if (s === 'ALERTA') return <Badge variant="outline" className="border-yellow-500/50 text-yellow-700 bg-yellow-50">ALERTA</Badge>;
    return <Badge variant="outline" className="border-red-500/50 text-red-700 bg-red-50">CRÍTICO</Badge>;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader title="Auditoria Interna" />
      <div className="flex-1 p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Auditoria de Integridade
            </h2>
            <p className="text-sm text-muted-foreground">Verificações automáticas de integridade contábil e financeira</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={reprocessar} disabled={reprocessing || loading} variant="outline">
              <Wand2 className={`w-4 h-4 mr-2 ${reprocessing ? 'animate-spin' : ''}`} />
              {reprocessing ? 'Reprocessando...' : 'Reprocessar Dados'}
            </Button>
            <Button onClick={fetchAudit} disabled={loading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Auditando...' : 'Re-executar'}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-red-500/50 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {report && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-3xl font-bold">{report.summary.total}</p>
                </CardContent>
              </Card>
              <Card className="border-green-500/30">
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-green-700">OK</p>
                  <p className="text-3xl font-bold text-green-700">{report.summary.ok}</p>
                </CardContent>
              </Card>
              <Card className="border-yellow-500/30">
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-yellow-700">Alertas</p>
                  <p className="text-3xl font-bold text-yellow-700">{report.summary.alerta}</p>
                </CardContent>
              </Card>
              <Card className="border-red-500/30">
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-red-700">Críticos</p>
                  <p className="text-3xl font-bold text-red-700">{report.summary.critico}</p>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground">
              Gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')}
            </p>

            <div className="space-y-2">
              {report.checks.map((c) => (
                <Card key={c.id} className={
                  c.status === 'CRÍTICO' ? 'border-red-500/30' :
                  c.status === 'ALERTA' ? 'border-yellow-500/30' : ''
                }>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggle(c.id)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        {statusIcon(c.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">{c.title}</CardTitle>
                            {statusBadge(c.status)}
                            <Badge variant="secondary" className="text-xs">{c.category}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{c.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.count > 0 && <Badge>{c.count}</Badge>}
                        {c.details && c.details.length > 0 && (
                          expanded.has(c.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {expanded.has(c.id) && c.details && c.details.length > 0 && (
                    <CardContent className="border-t pt-4">
                      {c.recommendation && (
                        <p className="text-sm bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-blue-900">
                          💡 {c.recommendation}
                        </p>
                      )}
                      <div className="max-h-96 overflow-auto">
                        <pre className="text-xs bg-muted/50 p-3 rounded">{JSON.stringify(c.details, null, 2)}</pre>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
