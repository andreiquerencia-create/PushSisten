'use client';

/**
 * Painel de infraestrutura da DEMO Oficial (Loja Modelo PushSisten).
 * Exclusivo do Master. Oferece:
 *   • Status do snapshot canônico DEMO_V1
 *   • 🔄 Restaurar DEMO_V1 (destrutivo, in-place, apenas empresa DEMO)
 *   • 📅 Atualizar Datas DEMO (deslocamento temporal preservando relações)
 *   • 🎬 Iniciar Apresentação (abre o Modo Apresentação)
 * Toda a validação de empresa é feita no BACKEND.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  RotateCcw, CalendarClock, Clapperboard, Loader2, AlertTriangle,
  CheckCircle2, Database, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface SnapshotStatus {
  totalRecords: number;
  version: string;
  createdAt: string;
  createdByName?: string | null;
  recordCounts?: Record<string, number>;
}

export function DemoPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [demoCompany, setDemoCompany] = useState<{ id: string; name: string } | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotStatus | null>(null);
  const [busy, setBusy] = useState<'restore' | 'refresh' | 'snapshot' | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      const r = await fetch('/api/master/demo/snapshot', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Falha ao carregar status.');
      setDemoCompany(d.demoCompany);
      setSnapshot(d.snapshot);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar status da DEMO.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function createSnapshot() {
    setBusy('snapshot');
    try {
      const r = await fetch('/api/master/demo/snapshot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Falha ao criar snapshot.');
      toast.success(`Snapshot DEMO_V1 atualizado (${d.totalRecords} registros).`);
      await loadStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar snapshot.');
    } finally { setBusy(null); }
  }

  async function doRestore() {
    setBusy('restore'); setConfirmRestore(false);
    try {
      const r = await fetch('/api/master/demo/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Falha na restauração.');
      toast.success(`DEMO restaurada com sucesso. (${d.totalInserted} registros, ${(d.durationMs/1000).toFixed(1)}s)`);
      await loadStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao restaurar a DEMO.');
    } finally { setBusy(null); }
  }

  async function doRefresh() {
    setBusy('refresh'); setConfirmRefresh(false);
    try {
      const r = await fetch('/api/master/demo/refresh-dates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Falha ao atualizar datas.');
      if (d.shifted) toast.success(`Datas da DEMO atualizadas (+${d.deltaDays} dias, ${d.fieldsUpdated} campos).`);
      else toast.info(d.reason || 'DEMO já está atualizada.');
      await loadStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar datas.');
    } finally { setBusy(null); }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando status da DEMO…
      </div>
    );
  }

  if (!demoCompany) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground">
        <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-500" />
        Empresa DEMO (“Loja Modelo PushSisten”) não encontrada no ambiente.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho / status */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold">{demoCompany.name}</span>
                <Badge variant="secondary">DEMO oficial</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Ambiente de demonstração controlável. As operações abaixo agem
                <strong> somente </strong> nesta empresa e nunca tocam assinaturas ou dados de outras lojas.
              </p>
            </div>
            <div className="text-right">
              {snapshot ? (
                <div className="text-sm">
                  <div className="flex items-center gap-1.5 justify-end text-emerald-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Snapshot DEMO_V1
                  </div>
                  <div className="text-muted-foreground">{snapshot.totalRecords} registros · v{snapshot.version}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(snapshot.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </div>
                </div>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-300">Sem snapshot</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-2 font-medium"><RotateCcw className="w-4 h-4 text-blue-600" /> Restaurar DEMO_V1</div>
            <p className="text-xs text-muted-foreground min-h-[48px]">
              Devolve a loja de demonstração ao estado canônico calibrado. Apaga alterações feitas durante testes.
            </p>
            <Button className="w-full" variant="default" disabled={!snapshot || busy!==null}
              onClick={() => setConfirmRestore(true)}>
              {busy==='restore' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Restaurando…</> : <>🔄 Restaurar DEMO_V1</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-2 font-medium"><CalendarClock className="w-4 h-4 text-violet-600" /> Atualizar Datas</div>
            <p className="text-xs text-muted-foreground min-h-[48px]">
              Traz todas as datas para o presente, preservando as relações entre elas. Não altera valores nem quantidades.
            </p>
            <Button className="w-full" variant="secondary" disabled={busy!==null}
              onClick={() => setConfirmRefresh(true)}>
              {busy==='refresh' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Atualizando…</> : <>📅 Atualizar Datas DEMO</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-2 font-medium"><Clapperboard className="w-4 h-4 text-rose-600" /> Apresentação</div>
            <p className="text-xs text-muted-foreground min-h-[48px]">
              Inicia o roteiro guiado de demonstração comercial em 8 etapas, com dados reais da loja modelo.
            </p>
            <Button className="w-full" variant="outline" disabled={busy!==null}
              onClick={() => router.push('/apresentacao')}>
              🎬 Iniciar Apresentação
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" disabled={busy!==null} onClick={createSnapshot}>
          {busy==='snapshot' ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin"/>Recapturando…</> : <><Database className="w-3.5 h-3.5 mr-2"/>Recapturar snapshot (avançado)</>}
        </Button>
      </div>

      {/* Dialog restaurar */}
      <Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500"/>Restaurar a DEMO?</DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block">Esta ação é <strong>destrutiva</strong>: todos os dados de negócio atuais da
              “Loja Modelo PushSisten” serão apagados e substituídos pelo estado canônico DEMO_V1.</span>
              <span className="block">Nenhuma outra empresa é afetada. Assinaturas e cobrança não são tocadas.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRestore(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={doRestore}>Sim, restaurar DEMO_V1</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog atualizar datas */}
      <Dialog open={confirmRefresh} onOpenChange={setConfirmRefresh}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-violet-600"/>Atualizar datas da DEMO?</DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block">Todas as datas da loja modelo serão deslocadas para que a última venda
              fique no presente, preservando integralmente as relações entre elas.</span>
              <span className="block">Valores financeiros, vendas e estoque <strong>não</strong> mudam.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRefresh(false)}>Cancelar</Button>
            <Button onClick={doRefresh}>Atualizar datas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
