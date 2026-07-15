'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AppHeader } from '@/components/app-header';
import { toast } from 'sonner';
import { Building2, MessageSquare, MessageCircle, Save, Info, Image as ImageIcon, Upload, Tag, Crown } from 'lucide-react';
import { SeuPlanoCard } from '@/components/seu-plano-card';

interface Company {
  id: string; name: string; cnpj: string | null; email: string | null;
  phone: string | null; whatsapp: string | null; instagram: string | null;
  logoUrl: string | null; address: string | null; city: string | null; state: string | null;
  priceTableMinQtyBehavior?: string;
  whatsappDefaultApp?: string;
}

interface MessageTemplate {
  id: string | null; type: string; name: string; content: string; isActive: boolean;
}

const VARIABLES = [
  { var: '{cliente}', desc: 'Nome do cliente' },
  { var: '{pedido}', desc: 'Número do pedido' },
  { var: '{total}', desc: 'Valor total da venda' },
  { var: '{vendedor}', desc: 'Nome do vendedor' },
  { var: '{empresa}', desc: 'Nome da empresa' },
];

export default function ConfiguracoesContent() {
  const { data: session } = useSession() || {};
  const [tab, setTab] = useState<'empresa' | 'mensagens' | 'plano'>('empresa');
  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({});
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingLogo, setLoadingLogo] = useState(false);

  useEffect(() => {
    fetch('/api/empresa').then(r => r.json()).then(d => {
      if (d.id) { setCompany(d); setCompanyForm(d); }
    });
    fetch('/api/configuracoes/mensagens').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setTemplates(d);
    });
  }, []);

  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      const updated = await res.json();
      setCompany(updated);
      toast.success('Dados da empresa atualizados!');
    } catch { toast.error('Erro ao salvar dados'); }
    setSaving(false);
  };

  const handleSaveMessage = async (type: string) => {
    const tpl = templates.find(t => t.type === type);
    if (!tpl) return;
    setSaving(true);
    try {
      const res = await fetch('/api/configuracoes/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tpl.type, name: tpl.name, content: tpl.content }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      toast.success('Mensagem salva com sucesso!');
    } catch { toast.error('Erro ao salvar mensagem'); }
    setSaving(false);
  };

  const updateTemplate = (type: string, content: string) => {
    setTemplates(prev => prev.map(t => t.type === type ? { ...t, content } : t));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingLogo(true);
    try {
      // Get presigned URL
      const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: `logo-${Date.now()}.${file.name.split('.').pop()}`, contentType: file.type, isPublic: true }),
      });
      if (!presignedRes.ok) throw new Error('Erro upload');
      const { presignedUrl, objectUrl } = await presignedRes.json();
      // Upload file
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'Content-Disposition': 'attachment' },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Erro upload S3');
      setCompanyForm(prev => ({ ...prev, logoUrl: objectUrl }));
      toast.success('Logo enviado!');
    } catch { toast.error('Erro ao enviar logo'); }
    setLoadingLogo(false);
  };

  const isAdmin = session?.user?.role === 'administrador' || session?.user?.role === 'socio';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <AppHeader title="Configurações" />
      <p className="text-sm text-muted-foreground -mt-4 mb-2">Personalize sua empresa e mensagens do comprovante</p>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === 'empresa' ? 'default' : 'outline'} size="sm" onClick={() => setTab('empresa')}>
          <Building2 className="w-4 h-4 mr-2" />Empresa
        </Button>
        <Button variant={tab === 'mensagens' ? 'default' : 'outline'} size="sm" onClick={() => setTab('mensagens')}>
          <MessageSquare className="w-4 h-4 mr-2" />Mensagens
        </Button>
        <Button variant={tab === 'plano' ? 'default' : 'outline'} size="sm" onClick={() => setTab('plano')}>
          <Crown className="w-4 h-4 mr-2" />Meu Plano
        </Button>
      </div>

      {/* PLANO TAB */}
      {tab === 'plano' && (
        <div className="max-w-xl">
          <SeuPlanoCard />
        </div>
      )}

      {/* EMPRESA TAB */}
      {tab === 'empresa' && (
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h3 className="font-display font-bold text-lg">Dados da Empresa</h3>
              <Badge variant="secondary" className="text-xs">Aparece no comprovante</Badge>
            </div>

            {/* Logo */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Logo da Empresa</Label>
              <div className="flex items-center gap-4">
                {companyForm.logoUrl ? (
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50">
                    <img src={companyForm.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <div>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={loadingLogo || !isAdmin} />
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                      <Upload className="w-4 h-4" />{loadingLogo ? 'Enviando...' : 'Enviar Logo'}
                    </span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG até 2MB</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="comp-name">Nome da Empresa</Label>
                <Input id="comp-name" value={companyForm.name || ''} onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))} disabled={!isAdmin} />
              </div>
              <div>
                <Label htmlFor="comp-cnpj">CNPJ</Label>
                <Input id="comp-cnpj" value={companyForm.cnpj || ''} onChange={e => setCompanyForm(p => ({ ...p, cnpj: e.target.value }))} disabled={!isAdmin} />
              </div>
              <div>
                <Label htmlFor="comp-phone">Telefone</Label>
                <Input id="comp-phone" value={companyForm.phone || ''} onChange={e => setCompanyForm(p => ({ ...p, phone: e.target.value }))} disabled={!isAdmin} />
              </div>
              <div>
                <Label htmlFor="comp-whatsapp">WhatsApp</Label>
                <Input id="comp-whatsapp" placeholder="(51) 99999-9999" value={companyForm.whatsapp || ''} onChange={e => setCompanyForm(p => ({ ...p, whatsapp: e.target.value }))} disabled={!isAdmin} />
              </div>
              <div>
                <Label htmlFor="comp-email">E-mail</Label>
                <Input id="comp-email" type="email" value={companyForm.email || ''} onChange={e => setCompanyForm(p => ({ ...p, email: e.target.value }))} disabled={!isAdmin} />
              </div>
              <div>
                <Label htmlFor="comp-instagram">Instagram</Label>
                <Input id="comp-instagram" placeholder="@sua_loja" value={companyForm.instagram || ''} onChange={e => setCompanyForm(p => ({ ...p, instagram: e.target.value }))} disabled={!isAdmin} />
              </div>
              <div>
                <Label htmlFor="comp-address">Endereço</Label>
                <Input id="comp-address" value={companyForm.address || ''} onChange={e => setCompanyForm(p => ({ ...p, address: e.target.value }))} disabled={!isAdmin} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="comp-city">Cidade</Label>
                  <Input id="comp-city" value={companyForm.city || ''} onChange={e => setCompanyForm(p => ({ ...p, city: e.target.value }))} disabled={!isAdmin} />
                </div>
                <div>
                  <Label htmlFor="comp-state">Estado</Label>
                  <Input id="comp-state" value={companyForm.state || ''} onChange={e => setCompanyForm(p => ({ ...p, state: e.target.value }))} disabled={!isAdmin} />
                </div>
              </div>
            </div>

            {isAdmin && (
              <Button onClick={handleSaveCompany} disabled={saving} className="w-full md:w-auto">
                <Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar Dados da Empresa'}
              </Button>
            )}

            {/* Price Table Config */}
            {isAdmin && (
              <div className="border-t pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Tag className="w-5 h-5 text-amber-600" />
                  <h3 className="font-display font-bold text-lg">Tabelas de Preço por Quantidade</h3>
                </div>
                <div>
                  <Label htmlFor="pt-behavior" className="text-sm font-medium">Comportamento quando quantidade for menor que o mínimo da tabela</Label>
                  <select
                    id="pt-behavior"
                    className="mt-1.5 w-full md:w-80 h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={(companyForm as any)?.priceTableMinQtyBehavior || 'allow'}
                    onChange={e => setCompanyForm(p => ({ ...p, priceTableMinQtyBehavior: e.target.value }))}
                  >
                    <option value="allow">✅ Permitir — Qtd. mínima apenas como referência (recomendado)</option>
                    <option value="warn">⚠️ Avisar — Permitir com alerta visual</option>
                    <option value="block">🚫 Bloquear — Não permitir uso abaixo do mínimo</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Define o que acontece no PDV quando o operador tenta aplicar uma tabela de preço sem atingir a quantidade mínima.
                  </p>
                </div>
              </div>
            )}

            {/* WhatsApp App Config */}
            {isAdmin && (
              <div className="border-t pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-display font-bold text-lg">WhatsApp — App Padrão</h3>
                </div>
                <div>
                  <Label htmlFor="wa-default-app" className="text-sm font-medium">App padrão para envio de comprovantes via WhatsApp</Label>
                  <select
                    id="wa-default-app"
                    className="mt-1.5 w-full md:w-80 h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={(companyForm as any)?.whatsappDefaultApp || 'ask'}
                    onChange={e => setCompanyForm(p => ({ ...p, whatsappDefaultApp: e.target.value }))}
                  >
                    <option value="ask">🔀 Perguntar sempre — Escolher na hora do envio</option>
                    <option value="whatsapp">💬 WhatsApp — Abrir sempre no WhatsApp normal</option>
                    <option value="business">💼 WhatsApp Business — Abrir sempre no WhatsApp Business</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Define qual aplicativo será usado ao enviar comprovantes no PDV. &quot;Perguntar sempre&quot; mostra um menu de escolha a cada envio.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MENSAGENS TAB */}
      {tab === 'mensagens' && (
        <div className="space-y-6">
          {/* Variables Reference */}
          <Card className="rounded-2xl shadow-sm border-0 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Variáveis Disponíveis</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map(v => (
                  <div key={v.var} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800">
                    <code className="text-xs font-code font-bold text-blue-600">{v.var}</code>
                    <span className="text-xs text-slate-500">{v.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Thank-you Message (PDF) */}
          {templates.filter(t => t.type === 'agradecimento').map(tpl => (
            <Card key="agradecimento" className="rounded-2xl shadow-sm border-0">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                    <span className="text-lg">❤️</span>
                  </div>
                  <div>
                    <h3 className="font-display font-bold">Mensagem de Agradecimento</h3>
                    <p className="text-xs text-muted-foreground">Aparece no rodapé do comprovante PDF</p>
                  </div>
                </div>
                <Textarea
                  value={tpl.content}
                  onChange={e => updateTemplate('agradecimento', e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                  placeholder="Escreva sua mensagem de agradecimento..."
                  disabled={!isAdmin}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Use \\n para quebra de linha no PDF</p>
                  {isAdmin && (
                    <Button size="sm" onClick={() => handleSaveMessage('agradecimento')} disabled={saving}>
                      <Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* WhatsApp Message */}
          {templates.filter(t => t.type === 'whatsapp').map(tpl => (
            <Card key="whatsapp" className="rounded-2xl shadow-sm border-0">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <span className="text-lg">📱</span>
                  </div>
                  <div>
                    <h3 className="font-display font-bold">Mensagem WhatsApp</h3>
                    <p className="text-xs text-muted-foreground">Enviada junto com o comprovante pelo WhatsApp</p>
                  </div>
                </div>
                <Textarea
                  value={tpl.content}
                  onChange={e => updateTemplate('whatsapp', e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                  placeholder="Escreva sua mensagem do WhatsApp..."
                  disabled={!isAdmin}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Use \\n para quebra de linha</p>
                  {isAdmin && (
                    <Button size="sm" onClick={() => handleSaveMessage('whatsapp')} disabled={saving}>
                      <Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
