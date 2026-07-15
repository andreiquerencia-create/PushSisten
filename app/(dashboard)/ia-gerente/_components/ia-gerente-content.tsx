'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bot, Send, TrendingUp, TrendingDown, AlertTriangle, Users, BarChart3,
  Sparkles, User, MessageSquare, Plus, Clock, Brain, Trash2, ChevronLeft,
  Shield, Target, Zap, ArrowRight, Copy, Check, Star, AlertCircle, HeartPulse,
  Package, Wallet, CreditCard, ChevronDown, ChevronUp, MessageCircle,
} from 'lucide-react';

const insightIcons: Record<string, any> = {
  'trending-up': TrendingUp, 'trending-down': TrendingDown,
  'alert-triangle': AlertTriangle, 'users': Users, 'bar-chart': BarChart3,
};

interface Message { role: string; content: string }
interface Conversation { id: string; title: string | null; summary: string | null; createdAt: string; updatedAt: string }

interface ExecutiveSummary {
  status: 'ATIVO' | 'EM_FORMACAO';
  pushScore: number | null;
  classification: string | null;
  pushScoreExplanation: string;
  components: { label: string; score: number | null; weight: number }[];
  totalInsights: number;
  insightsByType: Record<string, number>;
  insightsBySeverity: Record<string, number>;
  topRisks: { code: string; message: string; severity: string }[];
  topStrengths: { area: string; description: string }[];
  recommendedActions: { rank: number; action: string; reason: string; insightCode: string; severity: string }[];
  explanations: { insightCode: string; insightType: string; severity: string; explanation: string }[];
  recommendations: { insightCode: string; insightType: string; severity: string; action: string; priority: number; impact: string }[];
  suggestedMessages: { insightCode: string; context: string; template: string }[];
  summary: string;
  formacao?: { daysOperation: number; totalSales: number; minOperationDays: number; minSales: number; daysRemaining: number; salesRemaining: number };
}

const SEVERITY_COLORS: Record<string, string> = {
  ALTO: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  MEDIO: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  BAIXO: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
};

const SEVERITY_BADGES: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' }> = {
  ALTO: { label: 'Crítico', variant: 'destructive' },
  MEDIO: { label: 'Atenção', variant: 'default' },
  BAIXO: { label: 'Info', variant: 'secondary' },
};

const TYPE_ICONS: Record<string, any> = {
  ESTOQUE: Package,
  CLIENTE: Users,
  FINANCEIRO: Wallet,
  CREDIARIO: CreditCard,
};

const SCORE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  SAUDAVEL: { bg: 'from-emerald-500 to-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-500/30' },
  ESTAVEL: { bg: 'from-blue-500 to-blue-600', text: 'text-blue-600', ring: 'ring-blue-500/30' },
  ATENCAO: { bg: 'from-amber-500 to-amber-600', text: 'text-amber-600', ring: 'ring-amber-500/30' },
  RISCO: { bg: 'from-orange-500 to-orange-600', text: 'text-orange-600', ring: 'ring-orange-500/30' },
  CRITICO: { bg: 'from-red-500 to-red-600', text: 'text-red-600', ring: 'ring-red-500/30' },
};

export function IAGerenteContent() {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'resumo' | 'chat'>('resumo');
  const [expandedExplanations, setExpandedExplanations] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSummary();
    loadConversations();
  }, []);

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch('/api/ia-gerente/resumo');
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (e: any) { console.error(e); }
    setLoadingSummary(false);
  };

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/ia-gerente/conversations?limit=15');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch (e: any) { console.error(e); }
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/ia-gerente/conversations?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.conversation) {
          const msgs = JSON.parse(data.conversation.messages ?? '[]');
          setMessages(msgs);
          setCurrentConvId(id);
          setShowHistory(false);
          setActiveTab('chat');
        }
      }
    } catch (e: any) { console.error(e); }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConvId(null);
    setShowHistory(false);
  };

  const deleteConversation = async (id: string) => {
    try {
      await fetch(`/api/ia-gerente/conversations?id=${id}`, { method: 'DELETE' });
      if (currentConvId === id) startNewConversation();
      loadConversations();
    } catch (e: any) { console.error(e); }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const msg = (input ?? '').trim();
    if (!msg || streaming) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: msg };
    setMessages((prev: Message[]) => [...(prev ?? []), userMsg]);
    setStreaming(true);

    try {
      const history = (messages ?? []).slice(-10).map((m: Message) => ({ role: m?.role ?? 'user', content: m?.content ?? '' }));
      const response = await fetch('/api/ia-gerente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history, conversationId: currentConvId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setMessages((prev: Message[]) => [...(prev ?? []), { role: 'assistant', content: errData?.error ?? 'Erro ao processar sua mensagem. Tente novamente.' }]);
        setStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let partialRead = '';

      setMessages((prev: Message[]) => [...(prev ?? []), { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await (reader?.read() ?? { done: true, value: undefined });
        if (done) break;
        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() ?? '';

        for (const line of lines ?? []) {
          if (line?.startsWith?.('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta?.content ?? '';
              if (delta) {
                assistantContent += delta;
                setMessages((prev: Message[]) => {
                  const updated = [...(prev ?? [])];
                  if ((updated?.length ?? 0) > 0) {
                    updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  }
                  return updated;
                });
              }
            } catch (e: any) { /* skip */ }
          }
        }
      }

      const allMsgs = [...(messages ?? []), userMsg, { role: 'assistant', content: assistantContent }];
      try {
        const saveRes = await fetch('/api/ia-gerente/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentConvId, title: currentConvId ? undefined : msg.substring(0, 60), messages: allMsgs }),
        });
        if (saveRes.ok) {
          const saved = await saveRes.json();
          if (!currentConvId && saved.conversation?.id) setCurrentConvId(saved.conversation.id);
          loadConversations();
        }
      } catch (e: any) { /* non-critical */ }
    } catch (e: any) {
      console.error(e);
      setMessages((prev: Message[]) => [...(prev ?? []), { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }]);
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, currentConvId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const copyMessage = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsg(id);
      setTimeout(() => setCopiedMsg(null), 2000);
    } catch { /* fallback */ }
  };

  const scoreColor = summary?.classification ? SCORE_COLORS[summary.classification] || SCORE_COLORS.ATENCAO : SCORE_COLORS.ATENCAO;

  // Quick questions for chat
  const quickQuestions = [
    'O que eu preciso fazer hoje?',
    'Por que meu Push Score está assim?',
    'Quais clientes devo contatar?',
    'Como melhorar minha margem?',
    'Qual o resumo financeiro do mês?',
    'Dê um plano de ação completo',
  ];

  return (
    <div className="h-screen flex flex-col">
      <AppHeader title="IA Gerente" />
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar */}
        <div className={`${showHistory ? 'w-72 border-r border-border/50' : 'w-0'} transition-all duration-300 overflow-hidden bg-muted/20 flex-shrink-0`}>
          <div className="w-72 h-full flex flex-col">
            <div className="p-3 border-b border-border/50 flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> Conversas
              </h4>
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg hover:bg-primary/10" onClick={startNewConversation}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {conversations.map(conv => (
                <div key={conv.id} className={`group flex items-center gap-2 p-2.5 rounded-lg text-sm cursor-pointer transition-all duration-200 ${currentConvId === conv.id ? 'bg-primary/10 text-primary shadow-sm' : 'hover:bg-muted/60'}`}>
                  <button onClick={() => loadConversation(conv.id)} className="flex-1 text-left min-w-0">
                    <p className="truncate font-medium text-xs">{conv.title ?? 'Conversa'}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{new Date(conv.updatedAt).toLocaleDateString('pt-BR')}</p>
                  </button>
                  <button onClick={() => deleteConversation(conv.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500 transition-colors" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30">
            <Button size="sm" variant="outline" onClick={() => setShowHistory(!showHistory)} className="gap-1 text-xs">
              {showHistory ? <ChevronLeft className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
              {showHistory ? 'Ocultar' : 'Histórico'}
            </Button>
            <div className="flex rounded-lg border border-border/50 overflow-hidden">
              <button onClick={() => setActiveTab('resumo')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === 'resumo' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'}`}>
                <Target className="w-3 h-3 inline mr-1" /> Resumo
              </button>
              <button onClick={() => setActiveTab('chat')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === 'chat' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'}`}>
                <Bot className="w-3 h-3 inline mr-1" /> Chat
              </button>
            </div>
            <div className="flex-1" />
            <Badge variant="outline" className="text-xs gap-1">
              <Brain className="w-3 h-3" /> IA Gerente 2.0
            </Badge>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 lg:p-6">
            {activeTab === 'resumo' ? (
              <ResumoTab summary={summary} loading={loadingSummary} scoreColor={scoreColor} onRefresh={fetchSummary}
                copiedMsg={copiedMsg} onCopyMessage={copyMessage} expandedExplanations={expandedExplanations}
                onToggleExplanations={() => setExpandedExplanations(!expandedExplanations)} />
            ) : (
              <ChatTab messages={messages} input={input} streaming={streaming} chatEndRef={chatEndRef}
                quickQuestions={quickQuestions} setInput={setInput} handleKeyDown={handleKeyDown} sendMessage={sendMessage}
                currentConvId={currentConvId} startNewConversation={startNewConversation} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================
// RESUMO TAB
// ========================
function ResumoTab({ summary, loading, scoreColor, onRefresh, copiedMsg, onCopyMessage, expandedExplanations, onToggleExplanations }: {
  summary: ExecutiveSummary | null; loading: boolean; scoreColor: any; onRefresh: () => void;
  copiedMsg: string | null; onCopyMessage: (text: string, id: string) => void;
  expandedExplanations: boolean; onToggleExplanations: () => void;
}) {
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Não foi possível carregar o resumo.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={onRefresh}>Tentar novamente</Button>
      </div>
    );
  }

  if (summary.status === 'EM_FORMACAO') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="card-premium border-blue-500/20">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto mb-4">
              <HeartPulse className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold mb-2">Loja em Formação</h3>
            <p className="text-sm text-muted-foreground mb-4">{summary.summary}</p>
            {summary.formacao && (
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <div>
                  <p className="text-xs text-muted-foreground">Dias de operação</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, (summary.formacao.daysOperation / summary.formacao.minOperationDays) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium">{summary.formacao.daysOperation}/{summary.formacao.minOperationDays}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(100, (summary.formacao.totalSales / summary.formacao.minSales) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium">{summary.formacao.totalSales}/{summary.formacao.minSales}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Hero: Push Score + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Push Score */}
        <Card className="card-premium">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-muted-foreground mb-2">Push Score™</p>
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${scoreColor.bg} flex items-center justify-center mx-auto mb-2 ring-4 ${scoreColor.ring}`}>
              <span className="text-2xl font-bold text-white">{summary.pushScore?.toFixed(0) ?? '-'}</span>
            </div>
            <Badge variant="outline" className={`${scoreColor.text} text-xs`}>{summary.classification || 'N/A'}</Badge>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{summary.pushScoreExplanation.substring(0, 150)}{summary.pushScoreExplanation.length > 150 ? '...' : ''}</p>
          </CardContent>
        </Card>

        {/* Summary + Action Plan */}
        <Card className="lg:col-span-2 card-premium">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold">O que fazer hoje</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{summary.summary}</p>
            {summary.recommendedActions.length > 0 && (
              <div className="space-y-2">
                {summary.recommendedActions.map((action, i) => {
                  const sevBadge = SEVERITY_BADGES[action.severity] || SEVERITY_BADGES.BAIXO;
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${SEVERITY_COLORS[action.severity] || SEVERITY_COLORS.BAIXO}`}>
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold">{action.rank}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{action.action}</p>
                        <p className="text-xs text-muted-foreground mt-1">{action.reason}</p>
                      </div>
                      <Badge variant={sevBadge.variant} className="text-[10px] flex-shrink-0">{sevBadge.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Push Score Components */}
      {summary.components.length > 0 && (
        <Card className="card-premium">
          <CardContent className="p-5">
            <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
              <HeartPulse className="w-4 h-4 text-primary" /> Componentes do Push Score
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {summary.components.map((comp, i) => {
                const score = comp.score;
                const color = score == null ? 'bg-muted' : score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <div key={i} className="text-center p-3 rounded-lg border border-border/30 bg-muted/10">
                    <p className="text-xs text-muted-foreground">{comp.label}</p>
                    <p className="text-lg font-bold mt-1">{score != null ? score.toFixed(0) : 'N/A'}</p>
                    <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score ?? 0}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Peso {comp.weight.toFixed(0)}%</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths + Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Forças */}
        {summary.topStrengths.length > 0 && (
          <Card className="card-premium border-emerald-500/20">
            <CardContent className="p-5">
              <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-emerald-500" /> O que está funcionando
              </h4>
              <div className="space-y-2">
                {summary.topStrengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/5">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{s.area}</p>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Riscos */}
        {summary.topRisks.length > 0 && (
          <Card className="card-premium border-red-500/20">
            <CardContent className="p-5">
              <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Pontos de atenção
              </h4>
              <div className="space-y-2">
                {summary.topRisks.map((r, i) => {
                  const sevBadge = SEVERITY_BADGES[r.severity] || SEVERITY_BADGES.BAIXO;
                  return (
                    <div key={i} className={`flex items-start gap-2 p-2 rounded-lg ${SEVERITY_COLORS[r.severity] || ''}`}>
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-snug">{r.message}</p>
                      </div>
                      <Badge variant={sevBadge.variant} className="text-[10px] flex-shrink-0">{sevBadge.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed Explanations + Recommendations */}
      {summary.explanations.length > 0 && (
        <Card className="card-premium">
          <CardContent className="p-5">
            <button onClick={onToggleExplanations} className="flex items-center gap-2 w-full text-left mb-3">
              <Shield className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold flex-1">Diagnóstico detalhado ({summary.explanations.length})</h4>
              {expandedExplanations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedExplanations && (
              <div className="space-y-3">
                {summary.explanations.map((exp, i) => {
                  const TypeIcon = TYPE_ICONS[exp.insightType] || Sparkles;
                  const rec = summary.recommendations.find(r => r.insightCode === exp.insightCode);
                  return (
                    <div key={i} className={`p-3 rounded-lg border ${SEVERITY_COLORS[exp.severity] || ''}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <TypeIcon className="w-4 h-4" />
                        <span className="text-xs font-semibold">{exp.insightType}</span>
                        <Badge variant={SEVERITY_BADGES[exp.severity]?.variant || 'secondary'} className="text-[10px]">
                          {SEVERITY_BADGES[exp.severity]?.label || exp.severity}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed mb-2">{exp.explanation}</p>
                      {rec && (
                        <div className="flex items-start gap-2 p-2 rounded-md bg-background/50 border border-border/30">
                          <ArrowRight className="w-3 h-3 mt-1 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium">Recomendação:</p>
                            <p className="text-xs text-muted-foreground">{rec.action}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">Impacto: {rec.impact}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Suggested Messages */}
      {summary.suggestedMessages.length > 0 && (
        <Card className="card-premium">
          <CardContent className="p-5">
            <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-violet-500" /> Mensagens sugeridas
            </h4>
            <p className="text-xs text-muted-foreground mb-3">Copie e envie manualmente. A IA não envia mensagens automaticamente.</p>
            <div className="space-y-2">
              {summary.suggestedMessages.slice(0, 5).map((msg, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-violet-500/5">
                  <MessageCircle className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground mb-1">{msg.context}</p>
                    <p className="text-xs leading-relaxed">{msg.template}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => onCopyMessage(msg.template, `msg-${i}`)}>
                    {copiedMsg === `msg-${i}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ========================
// CHAT TAB
// ========================
function ChatTab({ messages, input, streaming, chatEndRef, quickQuestions, setInput, handleKeyDown, sendMessage, currentConvId, startNewConversation }: {
  messages: Message[]; input: string; streaming: boolean; chatEndRef: any;
  quickQuestions: string[]; setInput: (v: string) => void; handleKeyDown: (e: React.KeyboardEvent) => void;
  sendMessage: () => void; currentConvId: string | null; startNewConversation: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {currentConvId && (
        <Button size="sm" variant="ghost" onClick={startNewConversation} className="gap-1 text-xs">
          <Plus className="w-3 h-3" /> Nova Conversa
        </Button>
      )}

      <Card className="card-premium border-border/40">
        <CardContent className="p-5">
          <div className="h-[55vh] flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {(messages?.length ?? 0) === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">IA Gerente PUSHY 2.0</h3>
                  <p className="text-xs text-muted-foreground max-w-md mb-1">Assistente estratégica com análise de insights</p>
                  <p className="text-xs text-muted-foreground/70 max-w-md mb-6">Faça perguntas sobre sua empresa. A IA usa os dados oficiais do Insights Engine e Push Score.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-2xl">
                    {quickQuestions.map((q: string, i: number) => (
                      <button key={i} onClick={() => setInput(q)}
                        className="text-left text-xs p-3 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-primary/20 hover:shadow-sm transition-all duration-200">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(messages ?? []).map((msg: Message, i: number) => (
                <div key={i} className={`flex gap-3 ${msg?.role === 'user' ? 'justify-end' : ''}`}>
                  {msg?.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg?.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm'
                      : 'bg-muted/50 border border-border/30'
                  }`}>
                    {msg?.content ?? ''}
                    {msg?.role === 'assistant' && !msg?.content && streaming && (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                  {msg?.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/15 to-violet-500/10 ring-1 ring-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2">
              <Input value={input} onChange={(e: any) => setInput(e?.target?.value ?? '')} onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre sua empresa..." disabled={streaming}
                className="flex-1 bg-muted/30 border-border/50 focus:border-primary/30 focus:bg-background transition-all" />
              <Button onClick={sendMessage} disabled={streaming || !(input ?? '').trim()}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
