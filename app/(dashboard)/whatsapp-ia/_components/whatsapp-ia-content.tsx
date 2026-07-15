'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  MessageSquare, Settings, Wifi, WifiOff, Phone, Bot, Send,
  Shield, Clock, Check, CheckCheck, AlertCircle, RefreshCw,
  Smartphone, Key, Globe, Zap, Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppConfig {
  id: string; provider: string; apiUrl: string | null; apiKey: string | null;
  instanceId: string | null; status: string; phone: string | null;
  isActive: boolean;
}

interface Message {
  id: string; direction: string; phone: string; content: string;
  aiResponse: string | null; status: string; createdAt: string;
}

export function WhatsAppIAContent() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({
    provider: 'evolution', apiUrl: '', apiKey: '', instanceId: '', phone: '', isActive: false,
  });

  const fetchConfig = useCallback(async () => {
    try {
      const [configRes, msgRes] = await Promise.all([
        fetch('/api/whatsapp/config'),
        fetch('/api/whatsapp/messages?limit=20'),
      ]);
      if (configRes.ok) {
        const data = await configRes.json();
        if (data.config) {
          setConfig(data.config);
          setForm({
            provider: data.config.provider ?? 'evolution',
            apiUrl: data.config.apiUrl ?? '',
            apiKey: data.config.apiKey ?? '',
            instanceId: data.config.instanceId ?? '',
            phone: data.config.phone ?? '',
            isActive: data.config.isActive ?? false,
          });
        }
      }
      if (msgRes.ok) {
        const data = await msgRes.json();
        setMessages(data.messages ?? []);
      }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Configuração salva!');
        fetchConfig();
      }
    } catch (e: any) { console.error(e); toast.error('Erro ao salvar'); } finally { setSaving(false); }
  }, [form, fetchConfig]);

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          toast.success('Conexão estabelecida!');
        } else {
          toast.info(data.message ?? 'Não foi possível conectar');
        }
      }
    } catch (e: any) { console.error(e); } finally { setTesting(false); }
  }, []);

  const statusColors: Record<string, string> = {
    connected: 'bg-emerald-100 text-emerald-700',
    disconnected: 'bg-red-100 text-red-700',
    connecting: 'bg-amber-100 text-amber-700',
  };
  const statusLabels: Record<string, string> = {
    connected: 'Conectado', disconnected: 'Desconectado', connecting: 'Conectando...',
  };
  const statusIcons: Record<string, any> = {
    connected: Wifi, disconnected: WifiOff, connecting: RefreshCw,
  };

  const msgStatusIcons: Record<string, any> = {
    sent: Check, delivered: CheckCheck, read: CheckCheck, failed: AlertCircle,
  };

  if (loading) {
    return (
      <div className="min-h-screen"><AppHeader title="WhatsApp IA Gerente" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <MessageSquare className="w-10 h-10 text-emerald-500 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen"><AppHeader title="WhatsApp IA Gerente" />
      <div className="p-4 lg:p-6 space-y-6">
        {/* Status Card */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">WhatsApp IA Gerente</h3>
                  <p className="text-sm text-white/70">Converse com sua IA Gerente pelo WhatsApp</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(() => { const StatusIcon = statusIcons[config?.status ?? 'disconnected'] ?? WifiOff; return (
                  <Badge className={statusColors[config?.status ?? 'disconnected'] ?? 'bg-slate-100 text-slate-700'}>
                    <StatusIcon className="w-3.5 h-3.5 mr-1" />{statusLabels[config?.status ?? 'disconnected'] ?? 'Desconhecido'}
                  </Badge>
                ); })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-0 shadow-sm border-l-4 border-l-blue-500 bg-blue-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 mb-1">Integração Preparada</p>
              <p className="text-blue-700 text-xs">A arquitetura está preparada para Evolution API ou Z-API. Configure sua instância e conecte para que a IA Gerente responda pelo WhatsApp usando dados reais da sua empresa.</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Configuration */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Settings className="w-4 h-4" />Configuração</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Provedor</Label>
                <Select value={form.provider} onValueChange={v => setForm({ ...form, provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evolution">Evolution API</SelectItem>
                    <SelectItem value="z-api">Z-API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Globe className="w-3 h-3" />URL da API</Label>
                <Input value={form.apiUrl} onChange={e => setForm({ ...form, apiUrl: e.target.value })} placeholder={form.provider === 'evolution' ? 'https://sua-instancia.evolution-api.com' : 'https://api.z-api.io'} />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Key className="w-3 h-3" />Chave da API</Label>
                <Input value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} type="password" placeholder="Sua chave de autenticação" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Smartphone className="w-3 h-3" />ID da Instância</Label>
                <Input value={form.instanceId} onChange={e => setForm({ ...form, instanceId: e.target.value })} placeholder="ID da instância" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" />Número WhatsApp</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="5511999999999" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Ativar integração</Label>
                <Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveConfig} disabled={saving} className="flex-1 gap-1">
                  {saving ? 'Salvando...' : 'Salvar Configuração'}
                </Button>
                <Button variant="outline" onClick={testConnection} disabled={testing} className="gap-1">
                  <Zap className="w-4 h-4" />{testing ? 'Testando...' : 'Testar'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Permissions & Features */}
          <div className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" />Permissões da IA</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'Consultar vendas', desc: 'A IA pode informar dados de vendas' },
                    { label: 'Consultar estoque', desc: 'A IA pode informar situação do estoque' },
                    { label: 'Consultar financeiro', desc: 'A IA pode informar saldo e fluxo de caixa' },
                    { label: 'Consultar clientes', desc: 'A IA pode informar dados de clientes' },
                    { label: 'Gerar insights', desc: 'A IA pode dar sugestões estratégicas' },
                  ].map((perm, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div><p className="text-sm font-medium">{perm.label}</p><p className="text-xs text-muted-foreground">{perm.desc}</p></div>
                      <Switch defaultChecked />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4" />Exemplos de Comandos</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    '"Como fechou o dia?"',
                    '"Quais clientes devo chamar hoje?"',
                    '"Qual produto mais vendeu?"',
                    '"Meu caixa está saudável?"',
                    '"Vale comprar mais jeans?"',
                  ].map((cmd, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Send className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span className="text-muted-foreground">{cmd}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Message History */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Histórico de Mensagens {messages.length > 0 && <Badge variant="secondary" className="text-xs">{messages.length}</Badge>}</CardTitle></CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem registrada. Configure e conecte o WhatsApp para começar.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {messages.map(msg => {
                  const MsgStatus = msgStatusIcons[msg.status] ?? Check;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${msg.direction === 'outgoing' ? 'justify-end' : ''}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                        msg.direction === 'outgoing' ? 'bg-emerald-100 text-emerald-800' : 'bg-muted'
                      }`}>
                        <p className="text-[10px] text-muted-foreground mb-0.5">{msg.phone}</p>
                        <p>{msg.content}</p>
                        {msg.aiResponse && <p className="mt-1 pt-1 border-t text-xs italic">{msg.aiResponse}</p>}
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                          <span>{new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <MsgStatus className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
