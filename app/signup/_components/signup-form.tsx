'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserPlus, Mail, Lock, User, Building2, Phone } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export function SignupForm() {
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Format WhatsApp mask: (XX) XXXXX-XXXX
  const handleWhatsappChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    setWhatsapp(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !whatsapp) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('WhatsApp inválido. Informe DDD + número');
      return;
    }
    if (password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, companyName: companyName.trim() || undefined, whatsapp: '55' + digits }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Erro ao criar conta');
        return;
      }
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        router.replace('/setup');
      }
    } catch (error: any) {
      toast.error('Erro ao criar conta');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,40%,16%)] to-[hsl(217,50%,20%)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-display font-extrabold text-lg">P</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">
              PUSH<span className="text-blue-400">Y</span>
            </h1>
          </div>
          <p className="text-blue-200/60 text-sm">
            Crie sua empresa e comece agora
          </p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-display">Criar Conta</CardTitle>
            <CardDescription>Preencha os dados abaixo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Nome completo"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da sua loja / empresa</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Ex: Moda Fashion Atacado"
                    value={companyName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={whatsapp}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleWhatsappChange(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Usado para contato e suporte</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Criando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Criar Conta
                  </span>
                )}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Já tem conta?{' '}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Fazer login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
