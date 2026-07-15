'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload, FileSpreadsheet, Users, Package, Warehouse, ArrowRight, ArrowLeft,
  CheckCircle, AlertCircle, XCircle, Download, Loader2, RefreshCw, Eye,
  History, Info, MapPin, AlertTriangle, ChevronRight, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Field definitions per import type
const importTypes = {
  clientes: {
    label: 'Clientes',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    fields: [
      { key: 'nome', label: 'Nome', required: true },
      { key: 'telefone', label: 'Telefone', required: false },
      { key: 'whatsapp', label: 'WhatsApp', required: false },
      { key: 'email', label: 'Email', required: false },
      { key: 'cpfCnpj', label: 'CPF/CNPJ', required: false },
      { key: 'cidade', label: 'Cidade', required: false },
      { key: 'estado', label: 'Estado', required: false },
      { key: 'tipo', label: 'Tipo Cliente', required: false },
      { key: 'observacoes', label: 'Observações', required: false },
      { key: 'etiquetas', label: 'Etiquetas (separadas por vírgula)', required: false },
    ],
  },
  produtos: {
    label: 'Produtos',
    icon: Package,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
    fields: [
      { key: 'nome', label: 'Nome Produto', required: true },
      { key: 'sku', label: 'SKU', required: false },
      { key: 'codigoBarras', label: 'Código de Barras', required: false },
      { key: 'categoria', label: 'Categoria', required: false },
      { key: 'custo', label: 'Preço Custo', required: false },
      { key: 'precoVenda', label: 'Preço Venda', required: false },
      { key: 'estoque', label: 'Estoque', required: false },
      { key: 'estoqueMinimo', label: 'Estoque Mínimo', required: false },
      { key: 'descricao', label: 'Descrição', required: false },
      { key: 'status', label: 'Status (ativo/inativo)', required: false },
    ],
  },
  estoque: {
    label: 'Estoque Inicial',
    icon: Warehouse,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
    fields: [
      { key: 'sku', label: 'SKU', required: false },
      { key: 'codigoBarras', label: 'Código de Barras', required: false },
      { key: 'nomeProduto', label: 'Nome Produto', required: false },
      { key: 'quantidade', label: 'Quantidade', required: true },
    ],
  },
};

type ImportType = keyof typeof importTypes;

export function ImportacaoContent() {
  const [tab, setTab] = useState('importar');
  const [step, setStep] = useState(0); // 0=type, 1=upload, 2=mapping, 3=validation, 4=import
  const [importType, setImportType] = useState<ImportType | ''>('');
  const [fileName, setFileName] = useState('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [duplicateAction, setDuplicateAction] = useState<'ignorar' | 'atualizar'>('ignorar');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/importacao/historico');
      if (res.ok) { const d = await res.json(); setLogs(d.logs ?? []); }
    } catch (e: any) { console.error(e); }
    setLogsLoading(false);
  }, []);

  useEffect(() => { if (tab === 'historico') fetchLogs(); }, [tab, fetchLogs]);

  const resetWizard = () => {
    setStep(0);
    setImportType('');
    setFileName('');
    setFileHeaders([]);
    setFileRows([]);
    setMapping({});
    setValidation(null);
    setImportResult(null);
  };

  // Parse file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

        if (json.length === 0) {
          toast.error('Arquivo vazio ou formato inválido');
          return;
        }

        const headers = Object.keys(json[0]);
        setFileHeaders(headers);
        setFileRows(json);

        // Auto-map by similarity
        const config = importTypes[importType as ImportType];
        if (config) {
          const autoMap: Record<string, string> = {};
          for (const f of config.fields) {
            const best = headers.find(h => {
              const hl = h.toLowerCase().replace(/[^a-záéíóúãõç]/g, '');
              const fl = f.label.toLowerCase().replace(/[^a-záéíóúãõç]/g, '');
              const fk = f.key.toLowerCase();
              return hl === fl || hl === fk || hl.includes(fk) || fk.includes(hl) || hl.includes(fl.slice(0, 4));
            });
            if (best) autoMap[f.key] = best;
          }
          setMapping(autoMap);
        }

        setStep(2);
        toast.success(`${json.length} registros encontrados`);
      } catch (err) {
        console.error(err);
        toast.error('Erro ao ler arquivo. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Apply mapping → transform rows
  const getMappedRows = () => {
    return fileRows.map(row => {
      const mapped: any = {};
      for (const [fieldKey, headerName] of Object.entries(mapping)) {
        if (headerName) mapped[fieldKey] = String(row[headerName] ?? '').trim();
      }
      return mapped;
    });
  };

  // Validate
  const handleValidate = async () => {
    setValidating(true);
    try {
      const mappedRows = getMappedRows();
      const res = await fetch('/api/importacao/validar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: importType, rows: mappedRows }),
      });
      if (res.ok) {
        const data = await res.json();
        setValidation(data);
        setStep(3);
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro na validação');
      }
    } catch { toast.error('Erro ao validar'); }
    setValidating(false);
  };

  // Import
  const handleImport = async () => {
    if (!validation?.valid) return;
    setImporting(true);
    try {
      const res = await fetch('/api/importacao/executar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: importType,
          rows: validation.valid,
          duplicateAction,
          fileName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setImportResult(data);
        setStep(4);
        toast.success('Importação concluída!');
      } else {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro na importação');
      }
    } catch { toast.error('Erro na importação'); }
    setImporting(false);
  };

  // Download template
  const downloadTemplate = (type: ImportType) => {
    const config = importTypes[type];
    const headers = config.fields.map(f => f.label);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, `modelo_${type}.xlsx`);
    toast.success('Modelo baixado!');
  };

  const currentConfig = importType ? importTypes[importType as ImportType] : null;
  const CurrentIcon = currentConfig?.icon ?? FileSpreadsheet;

  const stepLabels = ['Tipo', 'Upload', 'Mapeamento', 'Validação', 'Resultado'];

  return (
    <div>
      <AppHeader title="Importação em Massa" />
      <div className="p-4 lg:p-6 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="importar"><Upload className="w-4 h-4 mr-1.5" />Importar</TabsTrigger>
            <TabsTrigger value="historico"><History className="w-4 h-4 mr-1.5" />Histórico</TabsTrigger>
          </TabsList>

          {/* ============ IMPORTAR ============ */}
          <TabsContent value="importar" className="space-y-4 mt-4">
            {/* Progress Steps */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {stepLabels.map((label, i) => (
                <div key={i} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    i === step ? 'bg-primary text-primary-foreground shadow-sm' :
                    i < step ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">{i + 1}</span>}
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {i < stepLabels.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-0.5" />}
                </div>
              ))}
            </div>

            {/* STEP 0: Select type */}
            {step === 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold font-display">O que você deseja importar?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(Object.entries(importTypes) as [ImportType, typeof importTypes.clientes][]).map(([key, config]) => {
                    const Icon = config.icon;
                    const isSelected = importType === key;
                    return (
                      <Card key={key}
                        className={`border-2 cursor-pointer transition-all hover:shadow-md ${
                          isSelected ? 'border-primary shadow-md' : 'border-transparent shadow-sm'
                        }`}
                        onClick={() => setImportType(key)}>
                        <CardContent className="p-6 text-center">
                          <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3 ${config.bgColor}`}>
                            <Icon className={`w-7 h-7 ${config.color}`} />
                          </div>
                          <p className="font-semibold text-lg">{config.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {key === 'clientes' && 'Importar cadastro de clientes'}
                            {key === 'produtos' && 'Importar catálogo de produtos'}
                            {key === 'estoque' && 'Ajuste inicial de estoque'}
                          </p>
                          {isSelected && <CheckCircle className="w-5 h-5 text-primary mx-auto mt-2" />}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Template Downloads */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Download className="w-4 h-4" />Baixar Planilha Modelo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadTemplate('clientes')}>
                      <Users className="w-4 h-4 mr-1.5 text-blue-600" />Modelo Clientes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadTemplate('produtos')}>
                      <Package className="w-4 h-4 mr-1.5 text-emerald-600" />Modelo Produtos
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadTemplate('estoque')}>
                      <Warehouse className="w-4 h-4 mr-1.5 text-amber-600" />Modelo Estoque
                    </Button>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button disabled={!importType} onClick={() => setStep(1)}>
                    Próximo <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 1: Upload */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(0)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                  <h3 className="text-lg font-semibold font-display">Upload do Arquivo</h3>
                </div>

                <Card className="border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 transition-all">
                  <CardContent className="py-12 text-center">
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                    <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${currentConfig?.bgColor ?? 'bg-muted'}`}>
                      <FileSpreadsheet className={`w-8 h-8 ${currentConfig?.color ?? 'text-muted-foreground'}`} />
                    </div>
                    <p className="font-semibold text-lg mb-1">Importar {currentConfig?.label}</p>
                    <p className="text-sm text-muted-foreground mb-4">Arraste um arquivo ou clique para selecionar</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-1.5" />Selecionar Arquivo
                      </Button>
                      <Button variant="outline" onClick={() => importType && downloadTemplate(importType as ImportType)}>
                        <Download className="w-4 h-4 mr-1.5" />Baixar Modelo
                      </Button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      <Badge variant="outline" className="text-xs">XLSX</Badge>
                      <Badge variant="outline" className="text-xs">XLS</Badge>
                      <Badge variant="outline" className="text-xs">CSV</Badge>
                    </div>
                    {fileName && (
                      <p className="mt-3 text-sm text-emerald-600 font-medium flex items-center justify-center gap-1">
                        <CheckCircle className="w-4 h-4" />{fileName} • {fileRows.length} registros
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* STEP 2: Column Mapping */}
            {step === 2 && currentConfig && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                  <h3 className="text-lg font-semibold font-display">Mapeamento de Colunas</h3>
                  <Badge variant="outline" className="ml-auto">{fileName}</Badge>
                </div>

                <Card className="border-0 shadow-sm bg-blue-50/50 dark:bg-blue-950/10">
                  <CardContent className="p-3 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      Associe cada coluna do seu arquivo ao campo correspondente no sistema.
                      Campos com <span className="font-bold">*</span> são obrigatórios.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/3">Campo do Sistema</TableHead>
                          <TableHead><MapPin className="w-3 h-3 inline mr-1" />Coluna do Arquivo</TableHead>
                          <TableHead className="w-1/4">Preview</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentConfig.fields.map(f => (
                          <TableRow key={f.key}>
                            <TableCell className="font-medium text-sm">
                              {f.label} {f.required && <span className="text-red-500">*</span>}
                            </TableCell>
                            <TableCell>
                              <select
                                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                value={mapping[f.key] ?? ''}
                                onChange={(e) => setMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                              >
                                <option value="">(não mapear)</option>
                                {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {mapping[f.key] ? String(fileRows[0]?.[mapping[f.key]] ?? '') : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Data Preview */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Eye className="w-4 h-4" />Preview dos Dados ({Math.min(fileRows.length, 5)} de {fileRows.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            {currentConfig.fields.filter(f => mapping[f.key]).map(f => (
                              <TableHead key={f.key}>{f.label}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fileRows.slice(0, 5).map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                              {currentConfig.fields.filter(f => mapping[f.key]).map(f => (
                                <TableCell key={f.key} className="text-sm">{String(row[mapping[f.key]] ?? '')}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1.5" />Voltar</Button>
                  <Button onClick={handleValidate} disabled={validating}>
                    {validating ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Validando...</> : <>Validar <ArrowRight className="w-4 h-4 ml-1.5" /></>}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Validation Results + Import */}
            {step === 3 && validation && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
                  <h3 className="text-lg font-semibold font-display">Validação e Importação</h3>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
                    <CardContent className="p-4 text-center">
                      <FileSpreadsheet className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Total no Arquivo</p>
                      <p className="text-2xl font-bold num-highlight text-blue-700 dark:text-blue-400">{validation.totalRows}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20">
                    <CardContent className="p-4 text-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Válidos</p>
                      <p className="text-2xl font-bold num-highlight text-emerald-700 dark:text-emerald-400">{validation.validCount}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20">
                    <CardContent className="p-4 text-center">
                      <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Erros</p>
                      <p className="text-2xl font-bold num-highlight text-red-700 dark:text-red-400">{validation.errorCount}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20">
                    <CardContent className="p-4 text-center">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Duplicados</p>
                      <p className="text-2xl font-bold num-highlight text-amber-700 dark:text-amber-400">{validation.duplicateCount}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Duplicate Handling */}
                {validation.duplicateCount > 0 && (
                  <Card className="border-0 shadow-sm bg-amber-50/50 dark:bg-amber-950/10">
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />Registros Duplicados Encontrados
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">O que fazer com registros que já existem no sistema?</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant={duplicateAction === 'ignorar' ? 'default' : 'outline'}
                          onClick={() => setDuplicateAction('ignorar')}>Ignorar Duplicados</Button>
                        <Button size="sm" variant={duplicateAction === 'atualizar' ? 'default' : 'outline'}
                          onClick={() => setDuplicateAction('atualizar')}>Atualizar Existentes</Button>
                      </div>
                      {validation.duplicates?.length > 0 && (
                        <div className="mt-3 max-h-32 overflow-y-auto">
                          {validation.duplicates.slice(0, 10).map((d: any, i: number) => (
                            <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                              Linha {d.row}: {d.field} = "{d.value}"
                            </p>
                          ))}
                          {validation.duplicates.length > 10 && (
                            <p className="text-xs text-muted-foreground mt-1">...e mais {validation.duplicates.length - 10}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Errors */}
                {validation.errorCount > 0 && (
                  <Card className="border-0 shadow-sm bg-red-50/50 dark:bg-red-950/10">
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />Erros de Validação
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {validation.errors?.slice(0, 20).map((e: any, i: number) => (
                          <p key={i} className="text-xs text-red-700 dark:text-red-400">
                            Linha {e.row}: [{e.field}] {e.message}
                          </p>
                        ))}
                        {(validation.errors?.length ?? 0) > 20 && (
                          <p className="text-xs text-muted-foreground">...e mais {validation.errors.length - 20} erros</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Import Button */}
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1.5" />Voltar ao Mapeamento</Button>
                  <Button
                    disabled={importing || validation.validCount === 0}
                    onClick={handleImport}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {importing ? (
                      <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Importando {validation.validCount} registros...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-1.5" />Importar {validation.validCount} Registros</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: Result */}
            {step === 4 && importResult && (
              <div className="space-y-4">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20">
                  <CardContent className="py-8 text-center">
                    <CheckCircle className="w-14 h-14 text-emerald-600 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-300 font-display">Importação Concluída!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {importType && importTypes[importType as ImportType]?.label} — {fileName}
                    </p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 text-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Importados</p>
                      <p className="text-2xl font-bold num-highlight text-emerald-700 dark:text-emerald-400">{importResult.imported}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 text-center">
                      <RefreshCw className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Atualizados</p>
                      <p className="text-2xl font-bold num-highlight text-blue-700 dark:text-blue-400">{importResult.updated}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 text-center">
                      <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Ignorados</p>
                      <p className="text-2xl font-bold num-highlight text-amber-700 dark:text-amber-400">{importResult.skipped}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 text-center">
                      <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Erros</p>
                      <p className="text-2xl font-bold num-highlight text-red-700 dark:text-red-400">{importResult.errors}</p>
                    </CardContent>
                  </Card>
                </div>

                {importResult.errorDetails?.length > 0 && (
                  <Card className="border-0 shadow-sm bg-red-50/50 dark:bg-red-950/10">
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold text-red-700 mb-2">Detalhes dos erros:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {importResult.errorDetails.map((e: any, i: number) => (
                          <p key={i} className="text-xs text-red-600">Linha {e.row}: {e.message}</p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-center">
                  <Button onClick={resetWizard}>
                    <Upload className="w-4 h-4 mr-1.5" />Nova Importação
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ============ HISTÓRICO ============ */}
          <TabsContent value="historico" className="space-y-4 mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <History className="w-4 h-4" />Histórico de Importações
                  <Badge variant="outline" className="ml-auto">{logs.length} registros</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : logs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma importação registrada</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Arquivo</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                          <TableHead className="text-center">Importados</TableHead>
                          <TableHead className="text-center">Atualizados</TableHead>
                          <TableHead className="text-center">Erros</TableHead>
                          <TableHead className="text-center">Ignorados</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">{fmtDate(log.createdAt)}</TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${
                                log.type === 'clientes' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                log.type === 'produtos' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}>
                                {log.type === 'clientes' ? 'Clientes' : log.type === 'produtos' ? 'Produtos' : 'Estoque'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm truncate max-w-[150px]">{log.fileName}</TableCell>
                            <TableCell className="text-xs">{log.importedByName ?? '-'}</TableCell>
                            <TableCell className="text-center num-highlight">{log.totalRows}</TableCell>
                            <TableCell className="text-center num-highlight text-emerald-600 font-semibold">{log.imported}</TableCell>
                            <TableCell className="text-center num-highlight text-blue-600">{log.updated}</TableCell>
                            <TableCell className="text-center num-highlight text-red-600">{log.errors}</TableCell>
                            <TableCell className="text-center num-highlight text-muted-foreground">{log.skipped}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
