'use client';

/**
 * FASE 7 — ETAPA 4: Painel Master de Backup e Restore.
 *
 * UI pura: apenas consome as APIs criadas nas ETAPAS 2 e 3:
 *   - GET  /api/master/backup            (listar)
 *   - POST /api/master/backup            (criar manual)
 *   - GET  /api/master/backup/[id]       (detalhes)
 *   - GET  /api/master/backup/[id]/download (URL assinada S3)
 *   - POST /api/master/restore           (dry-run / commit — NOVA EMPRESA)
 *
 * NÃO toca em Motor Financeiro, Ledger, Multiempresa, IA, Auditoria nem nas
 * correções das FASES 2/3/4. NÃO implementa restore in-place.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  DatabaseBackup, Download, Eye, Play, RotateCcw, Loader2, CheckCircle2,
  XCircle, AlertTriangle, ShieldCheck, FileJson, HardDriveDownload, Plus,
  CalendarClock, Save, Clock,
} from 'lucide-react';
import { toast } from 'sonner';

function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function fmtBytes(b: number | null | undefined) {
  if (b == null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  running:   { label: 'Em execução', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  pending:   { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  failed:    { label: 'Falhou', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};

const TYPE_LABEL: Record<string, string> = {
  manual: 'Manual',
  auto: 'Automático',
  pre_delete: 'Pré-exclusão',
};

export function BackupPanel({ companies }: { companies: any[] }) {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // criar backup
  const [createCompanyId, setCreateCompanyId] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // detalhes
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  // restore
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBackup, setRestoreBackup] = useState<any>(null);
  const [dryRunReport, setDryRunReport] = useState<any>(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<any>(null);

  const [downloadingId, setDownloadingId] = useState<string>('');

  // agendamento / retenção
  const [schedule, setSchedule] = useState<any>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch('/api/master/backup');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/master/backup-schedule');
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule);
      }
    } catch (e: any) { console.error(e); }
  }, []);

  useEffect(() => { fetchBackups(); fetchSchedule(); }, [fetchBackups, fetchSchedule]);

  const saveSchedule = async () => {
    if (!schedule) return;
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/master/backup-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: schedule.enabled,
          hourBrt: Number(schedule.hourBrt),
          retentionDaily: Number(schedule.retentionDaily),
          retentionWeekly: Number(schedule.retentionWeekly),
          retentionMonthly: Number(schedule.retentionMonthly),
        }),
      });
      const data = await res.json();
      if (res.ok) { setSchedule(data.schedule); toast.success('Configuração de backup salva.'); }
      else toast.error(data.error || 'Falha ao salvar configuração.');
    } catch (e: any) { toast.error('Erro de rede ao salvar configuração.'); }
    finally { setSavingSchedule(false); }
  };

  // auto-refresh enquanto houver backup em execução
  useEffect(() => {
    const hasRunning = backups.some((b) => b.status === 'running' || b.status === 'pending');
    if (!hasRunning) return;
    const t = setInterval(fetchBackups, 4000);
    return () => clearInterval(t);
  }, [backups, fetchBackups]);

  const handleCreate = async () => {
    if (!createCompanyId) { toast.error('Selecione uma empresa.'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/master/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: createCompanyId, type: 'manual' }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.queued) {
          toast.success('Empresa grande: backup enfileirado e sendo processado em segundo plano. Acompanhe o status na tabela.');
        } else {
          toast.success(`Backup criado: ${data.backup?.totalRecords ?? 0} registros.`);
        }
        setCreateCompanyId('');
        fetchBackups();
      } else {
        toast.error(data.error || 'Falha ao criar backup.');
        fetchBackups();
      }
    } catch (e: any) {
      toast.error('Erro de rede ao criar backup.');
    } finally { setCreating(false); }
  };

  const openDetail = async (id: string) => {
    setDetail(null);
    setDetailOpen(true);
    try {
      const res = await fetch(`/api/master/backup/${id}`);
      const data = await res.json();
      if (res.ok) setDetail(data.backup);
      else toast.error(data.error || 'Falha ao carregar detalhes.');
    } catch { toast.error('Erro ao carregar detalhes.'); }
  };

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/master/backup/${id}/download`);
      const data = await res.json();
      if (res.ok && data.url) {
        const a = document.createElement('a');
        a.href = data.url;
        a.download = data.fileName || 'backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Download iniciado.');
      } else {
        toast.error(data.error || 'Falha ao gerar link de download.');
      }
    } catch { toast.error('Erro ao baixar backup.'); }
    finally { setDownloadingId(''); }
  };

  const openRestore = (backup: any) => {
    setRestoreBackup(backup);
    setDryRunReport(null);
    setRestoreResult(null);
    setNewCompanyName(`${backup.companyName} (restaurado)`);
    setConfirmText('');
    setRestoreOpen(true);
  };

  const handleDryRun = async () => {
    if (!restoreBackup) return;
    setDryRunning(true);
    setDryRunReport(null);
    try {
      const res = await fetch('/api/master/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: restoreBackup.id, mode: 'dry-run' }),
      });
      const data = await res.json();
      if (res.ok) {
        setDryRunReport(data.report);
        toast.success('Simulação (dry-run) concluída.');
      } else {
        toast.error(data.error || 'Falha no dry-run.');
      }
    } catch { toast.error('Erro de rede no dry-run.'); }
    finally { setDryRunning(false); }
  };

  const handleRestore = async () => {
    if (!restoreBackup) return;
    if (!newCompanyName.trim()) { toast.error('Informe o nome da nova empresa.'); return; }
    if (confirmText.trim().toUpperCase() !== 'RESTAURAR') { toast.error('Digite RESTAURAR para confirmar.'); return; }
    setRestoring(true);
    setRestoreResult(null);
    try {
      const res = await fetch('/api/master/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupId: restoreBackup.id,
          mode: 'commit',
          newCompanyName: newCompanyName.trim(),
          confirm: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRestoreResult(data);
        if (data.validationsOk) toast.success('Restauração concluída — todas as validações OK.');
        else toast.warning('Restauração concluída com alertas nas validações.');
      } else {
        toast.error(data.error || 'Falha na restauração (rollback aplicado).');
      }
    } catch { toast.error('Erro de rede na restauração.'); }
    finally { setRestoring(false); }
  };

  const orphanTotal = dryRunReport ? Object.values(dryRunReport.orphanRefs || {}).reduce((a: number, b: any) => a + b, 0) : 0;

  return (
    <div className="space-y-4">
      {/* aviso de segurança */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm">
        <ShieldCheck className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="text-blue-800 dark:text-blue-300">
          Backups lógicos por empresa armazenados em nuvem. A restauração cria <strong>sempre uma nova empresa (sandbox)</strong> —
          nunca sobrescreve dados existentes. Toda restauração passa por validação, dry-run e transação única com rollback automático.
        </p>
      </div>

      {/* criar backup */}
      <Card className="card-premium p-4">
        <div className="flex items-center gap-2 mb-3">
          <DatabaseBackup className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Criar backup manual</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <Label className="text-xs">Empresa</Label>
            <Select value={createCompanyId} onValueChange={setCreateCompanyId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
              <SelectContent>
                {companies.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c._count ? `— ${c._count.sales ?? 0} vendas` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={creating || !createCompanyId} className="gap-1.5">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? 'Gerando…' : 'Criar backup'}
          </Button>
        </div>
      </Card>

      {/* agendamento automático + retenção */}
      <Card className="card-premium p-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Backup automático & retenção</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Executa um ciclo noturno (todas as empresas ativas), processado em segundo plano e fora do horário de uso.
          Empresas grandes nunca dependem de tempo de resposta da página.
        </p>
        {!schedule ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando configuração…</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Backup automático {schedule.enabled ? 'ativado' : 'desativado'}</p>
                <p className="text-xs text-muted-foreground">Quando ativo, o ciclo roda diariamente no horário definido.</p>
              </div>
              <Switch checked={!!schedule.enabled} onCheckedChange={(v) => setSchedule({ ...schedule, enabled: v })} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Hora (BRT)</Label>
                <Input type="number" min={0} max={23} value={schedule.hourBrt}
                  onChange={(e) => setSchedule({ ...schedule, hourBrt: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Diários</Label>
                <Input type="number" min={1} max={60} value={schedule.retentionDaily}
                  onChange={(e) => setSchedule({ ...schedule, retentionDaily: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Semanais</Label>
                <Input type="number" min={0} max={26} value={schedule.retentionWeekly}
                  onChange={(e) => setSchedule({ ...schedule, retentionWeekly: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Mensais</Label>
                <Input type="number" min={0} max={36} value={schedule.retentionMonthly}
                  onChange={(e) => setSchedule({ ...schedule, retentionMonthly: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-[11px] text-muted-foreground">
                {schedule.lastRunAt
                  ? `Última execução: ${fmtDateTime(schedule.lastRunAt)} — ${schedule.lastRunStatus ?? '—'}`
                  : 'Nenhuma execução automática registrada ainda.'}
              </p>
              <Button size="sm" onClick={saveSchedule} disabled={savingSchedule} className="gap-1.5">
                {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar configuração
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Política GFS: mantém os <strong>{schedule.retentionDaily}</strong> diários, <strong>{schedule.retentionWeekly}</strong> semanais e <strong>{schedule.retentionMonthly}</strong> mensais mais recentes.
              O último backup válido de cada empresa nunca é excluído.
            </p>
          </div>
        )}
      </Card>

      {/* lista de backups */}
      <Card className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell text-right">Registros</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Tamanho</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow>
              ) : backups.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <FileJson className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nenhum backup criado ainda. Selecione uma empresa acima para gerar o primeiro.
                </TableCell></TableRow>
              ) : backups.map((b: any) => {
                const st = STATUS_BADGE[b.status] || { label: b.status, cls: 'bg-slate-100 text-slate-600' };
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-sm">{b.companyName}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{TYPE_LABEL[b.type] || b.type}</TableCell>
                    <TableCell><span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${st.cls}`}>{b.status === 'running' && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}{st.label}</span></TableCell>
                    <TableCell className="hidden md:table-cell text-right text-sm tabular-nums">{b.totalRecords?.toLocaleString('pt-BR') ?? '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-sm text-muted-foreground tabular-nums">{fmtBytes(b.fileSizeBytes)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(b.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Detalhes" onClick={() => openDetail(b.id)}><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Download" disabled={b.status !== 'completed' || downloadingId === b.id} onClick={() => handleDownload(b.id)}>
                          {downloadingId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Restaurar (nova empresa)" disabled={b.status !== 'completed'} onClick={() => openRestore(b)}><RotateCcw className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ===== Dialog: Detalhes ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileJson className="w-4 h-4" /> Detalhes do backup</DialogTitle>
          </DialogHeader>
          {!detail ? (
            <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin inline text-muted-foreground" /></div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Empresa:</span><br /><strong>{detail.companyName}</strong></div>
                <div><span className="text-muted-foreground">Status:</span><br /><span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${(STATUS_BADGE[detail.status]||{cls:''}).cls}`}>{(STATUS_BADGE[detail.status]||{label:detail.status}).label}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span><br />{TYPE_LABEL[detail.type] || detail.type}</div>
                <div><span className="text-muted-foreground">Versão:</span><br />{detail.version}</div>
                <div><span className="text-muted-foreground">Registros:</span><br /><strong>{detail.totalRecords?.toLocaleString('pt-BR')}</strong></div>
                <div><span className="text-muted-foreground">Tamanho:</span><br />{fmtBytes(detail.fileSizeBytes)}</div>
                <div><span className="text-muted-foreground">Duração:</span><br />{detail.durationMs ? `${(detail.durationMs/1000).toFixed(1)}s` : '—'}</div>
                <div><span className="text-muted-foreground">Autor:</span><br />{detail.createdByName || '—'}</div>
              </div>
              {detail.error && <div className="rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 p-2 text-red-700 dark:text-red-400 text-xs">{detail.error}</div>}
              {detail.recordCounts && (
                <div>
                  <p className="text-muted-foreground mb-1">Contagem por tabela:</p>
                  <div className="max-h-48 overflow-y-auto rounded border border-border/50 p-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    {Object.entries(detail.recordCounts).filter(([, v]: any) => v > 0).map(([k, v]: any) => (
                      <div key={k} className="flex justify-between"><span className="text-muted-foreground truncate">{k}</span><span className="tabular-nums font-medium">{v.toLocaleString('pt-BR')}</span></div>
                    ))}
                  </div>
                </div>
              )}
              {detail.status === 'completed' && (
                <Button variant="outline" className="w-full gap-1.5" onClick={() => handleDownload(detail.id)} disabled={downloadingId === detail.id}>
                  {downloadingId === detail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDriveDownload className="w-4 h-4" />} Baixar JSON
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Restaurar ===== */}
      <Dialog open={restoreOpen} onOpenChange={(o) => { if (!restoring) setRestoreOpen(o); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Restaurar para nova empresa</DialogTitle>
            <DialogDescription>
              Origem: <strong>{restoreBackup?.companyName}</strong> · {restoreBackup?.totalRecords?.toLocaleString('pt-BR')} registros.
              A restauração cria uma <strong>empresa nova</strong> e nunca altera a original.
            </DialogDescription>
          </DialogHeader>

          {!restoreResult ? (
            <div className="space-y-4">
              {/* passo 1: dry-run */}
              <div className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> 1. Simulação (dry-run)</span>
                  <Button size="sm" variant="outline" onClick={handleDryRun} disabled={dryRunning}>
                    {dryRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Executar'}
                  </Button>
                </div>
                {dryRunReport && (
                  <div className="text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      {dryRunReport.valid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      <span className={dryRunReport.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        {dryRunReport.valid ? 'Backup válido para restauração' : 'Backup inválido — restauração bloqueada'}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total de registros</span><span className="tabular-nums">{dryRunReport.totalRecords?.toLocaleString('pt-BR')}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">E-mails reescritos (sandbox)</span><span className="tabular-nums">{dryRunReport.emailRewrites}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Referências órfãs (campos opcionais zerados)</span><span className="tabular-nums">{orphanTotal}</span></div>
                    {(dryRunReport.issues || []).map((iss: any, i: number) => (
                      <div key={i} className={`flex items-start gap-1.5 ${iss.level === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /><span>{iss.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* passo 2: confirmação + commit */}
              <div className={`rounded-lg border p-3 space-y-2 ${dryRunReport?.valid ? 'border-border/60' : 'border-border/30 opacity-50 pointer-events-none'}`}>
                <span className="text-sm font-medium flex items-center gap-1.5"><DatabaseBackup className="w-3.5 h-3.5" /> 2. Confirmar restauração</span>
                <div>
                  <Label className="text-xs">Nome da nova empresa</Label>
                  <Input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="Nome da empresa restaurada" />
                </div>
                <div>
                  <Label className="text-xs">Digite <strong>RESTAURAR</strong> para confirmar</Label>
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESTAURAR" />
                </div>
                <Button className="w-full gap-1.5" onClick={handleRestore} disabled={restoring || !dryRunReport?.valid || confirmText.trim().toUpperCase() !== 'RESTAURAR'}>
                  {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  {restoring ? 'Restaurando…' : 'Restaurar para nova empresa'}
                </Button>
              </div>
            </div>
          ) : (
            /* resultado da restauração */
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                {restoreResult.validationsOk ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                <span className="font-medium">{restoreResult.validationsOk ? 'Restauração concluída com sucesso' : 'Restauração concluída com alertas'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Nova empresa:</span><br /><strong>{restoreResult.result?.newCompanyName}</strong></div>
                <div><span className="text-muted-foreground">Registros inseridos:</span><br /><strong>{restoreResult.result?.totalInserted?.toLocaleString('pt-BR')}</strong></div>
                <div><span className="text-muted-foreground">Duração:</span><br />{restoreResult.result?.durationMs ? `${(restoreResult.result.durationMs/1000).toFixed(1)}s` : '—'}</div>
                <div><span className="text-muted-foreground">E-mails reescritos:</span><br />{restoreResult.result?.emailRewrites}</div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Validações automáticas:</p>
                <div className="max-h-56 overflow-y-auto rounded border border-border/50 divide-y divide-border/40">
                  {(restoreResult.result?.validations || []).map((v: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1 text-xs">
                      <span className="flex items-center gap-1.5">{v.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />} {v.check}</span>
                      <span className="text-muted-foreground">{v.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setRestoreOpen(false)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
