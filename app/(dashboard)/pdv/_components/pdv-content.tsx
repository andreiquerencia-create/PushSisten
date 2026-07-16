'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOnboardingContext } from '@/components/onboarding-provider';
import { OnboardingCelebration } from '@/components/onboarding-celebration';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Monitor, Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, CheckCircle, Package, Barcode, Layers, UserCircle, MessageCircle, Banknote, QrCode, FileText, ArrowLeftRight, CircleDot, Clock, Percent, Wallet, X, Download, Loader2, ClipboardList, Send, Tag, Copy, Edit, HandCoins, AlertTriangle } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { toast } from 'sonner';
import { formatSaleNumber } from '@/lib/sale-number';

interface Variation {
  id: string; color: string | null; size: string | null; grade: string | null; sku: string | null; barcode: string | null; salePrice: number; stockQuantity: number;
}
interface PriceTableEntry {
  id: string; name: string; minQuantity: number; unitPrice: number; notes?: string;
}
interface Product {
  id: string; name: string; sku: string; salePrice: number; stockQuantity: number; category?: { name: string }; variations?: Variation[]; priceTables?: PriceTableEntry[];
}
interface CartItem {
  product: Product; variation?: Variation; quantity: number; unitPrice: number; discount: number;
  // Price table tracking
  priceTableId?: string; priceTableName?: string; originalPrice?: number; appliedPrice?: number; priceDiscount?: number;
}
interface Customer {
  id: string; name: string; type: string; phone?: string; whatsapp?: string;
}
interface Seller {
  id: string; name: string; userId?: string; canEditPrice?: boolean;
}
interface PMMethod {
  id: string; name: string; type: string; cashAccountId: string;
  defaultDays: number; feePercent: number; feeFixed: number; businessDays: boolean;
  cashAccount: { id: string; name: string; type: string };
}
interface PaymentEntry {
  methodId: string; amount: number;
}

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pmTypeIcons: Record<string, any> = {
  dinheiro: Banknote, pix: QrCode, cartao_credito: CreditCard, cartao_debito: CreditCard,
  boleto: FileText, transferencia: ArrowLeftRight, crediario: HandCoins, outro: CircleDot,
};

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function calcExpectedDate(defaultDays: number, businessDays: boolean): Date {
  const now = new Date();
  if (defaultDays === 0) return now;
  if (businessDays) return addBusinessDays(now, defaultDays);
  const result = new Date(now);
  result.setDate(result.getDate() + defaultDays);
  return result;
}

export default function PDVContent({ editSaleId }: { editSaleId?: string }) {
  const searchParams = useSearchParams();
  const onboardingMode = searchParams.get('onboarding') === 'true';
  const { markSaleCompleted } = useOnboardingContext();
  const [showCelebration, setShowCelebration] = useState(false);
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PMMethod[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedSeller, setSelectedSeller] = useState('');
  // globalDiscount removed — now computed from discountInput + discountType
  const [loading, setLoading] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [lastSaleNumber, setLastSaleNumber] = useState('');
  const [lastSaleData, setLastSaleData] = useState<{ saleId: string; customerName: string; customerPhone: string; items: { name: string; qty: number }[]; total: number; isOrcamento?: boolean } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [varPickerOpen, setVarPickerOpen] = useState(false);
  const [varPickerProduct, setVarPickerProduct] = useState<Product | null>(null);
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  // Split payment entries
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  // Mobile view toggle: 'products' or 'cart'
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');
  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  // Quick customer creation
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({ name: '', phone: '', city: '', type: 'varejo' as string });
  const [quickCustomerSaving, setQuickCustomerSaving] = useState(false);
  // Discount type state
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');
  const [discountInput, setDiscountInput] = useState(0);
  // Company setting for price table min qty behavior (legacy — agora sempre 'allow')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ptMinQtyBehavior, setPtMinQtyBehavior] = useState<string>('allow');
  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // Crediário state
  const [customerCredit, setCustomerCredit] = useState<{ creditLimit: number; usedLimit: number; status: string } | null>(null);
  const [crediarioConfig, setCrediarioConfig] = useState({ parcelas: 2, termDays: 30 });
  // Editing orçamento state
  const [editingOrcamentoId, setEditingOrcamentoId] = useState<string | null>(null);
  const [editingOrcamentoNumber, setEditingOrcamentoNumber] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/produtos?limit=500').then(r => r.json()).then(d => {
      const list = d.products || [];
      setProducts(list);
      // ONBOARDING: pré-selecionar o produto mais recente (último cadastrado)
      if (onboardingMode && list.length > 0) {
        const lastProduct = list[list.length - 1];
        setCart([{
          product: lastProduct,
          quantity: 1,
          unitPrice: lastProduct.salePrice || 0,
          discount: 0,
        }]);
      }
    });
    fetch('/api/clientes?limit=500').then(r => r.json()).then(d => {
      const list = d.customers || [];
      setCustomers(list);
      // ONBOARDING: pré-selecionar o cliente mais recente
      if (onboardingMode && list.length > 0) {
        const lastCustomer = list[list.length - 1];
        setSelectedCustomer(lastCustomer.id);
      }
    });
    fetch('/api/vendedores').then(r => r.json()).then(d => setSellers(Array.isArray(d) ? d : (d?.sellers ?? [])));
    fetch('/api/formas-pagamento?active=true').then(r => r.json()).then(d => {
      const methods = d.methods ?? [];
      setPaymentMethods(methods);
      // ONBOARDING: pré-selecionar o primeiro método de pagamento disponível
      if (onboardingMode && methods.length > 0) {
        setPaymentEntries([{ methodId: methods[0].id, amount: 0 }]);
      }
    });
    fetch('/api/empresa').then(r => r.json()).then(d => {
      if (d?.priceTableMinQtyBehavior) setPtMinQtyBehavior(d.priceTableMinQtyBehavior);
    }).catch(() => {});
  }, [onboardingMode]);

  // Auto-lock seller for vendedor role
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;
  const isSellerLocked = userRole === 'vendedor';

  useEffect(() => {
    if (isSellerLocked && sellers.length > 0 && userId) {
      // Find the seller linked to this user
      const linked = sellers.find(s => s.userId === userId);
      if (linked) {
        setSelectedSeller(linked.userId || linked.id);
      } else {
        setSelectedSeller(userId);
      }
    }
  }, [isSellerLocked, sellers, userId]);

  // Fetch customer credit when customer changes
  useEffect(() => {
    if (!selectedCustomer) { setCustomerCredit(null); return; }
    fetch(`/api/crediario/credito?customerId=${selectedCustomer}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setCustomerCredit(data[0]);
        } else if (data && !Array.isArray(data) && data.creditLimit !== undefined) {
          setCustomerCredit(data);
        } else {
          setCustomerCredit(null);
        }
      })
      .catch(() => setCustomerCredit(null));
  }, [selectedCustomer]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); setBarcodeMode(false); searchRef.current?.focus(); }
      if (e.key === 'F3') { e.preventDefault(); setBarcodeMode(true); setTimeout(() => barcodeRef.current?.focus(), 50); }
      if (e.key === 'F4') { e.preventDefault(); openPaymentDialog(); }
      if (e.key === 'F8') { e.preventDefault(); if (cart.length > 0 && paymentEntries.length > 0) finalizeSale(); }
      if (e.key === 'Escape') { setVarPickerOpen(false); setPaymentOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, paymentEntries]);

  const filteredProducts = products.filter(p => {
    const hasStock = (p.variations && p.variations.length > 0) ? p.variations.some(v => v.stockQuantity > 0) : p.stockQuantity > 0;
    return hasStock && (p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())));
  }).slice(0, 24);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 20);
    const q = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.whatsapp && c.whatsapp.includes(q))).slice(0, 20);
  }, [customers, customerSearch]);

  // Close customer dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomer);

  const handleBarcodeSearch = async (code: string) => {
    if (!code.trim()) return;
    try {
      const res = await fetch(`/api/produtos/barcode?code=${encodeURIComponent(code.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.type === 'variation' && data.product && data.variation) {
          addToCartDirect(data.product, data.variation);
          toast.success(`${data.product.name} (${data.variation.color ?? ''} ${data.variation.size ?? ''})`);
        } else if (data.type === 'product' && data.product) {
          if (data.product.variations && data.product.variations.length > 0) {
            setVarPickerProduct(data.product); setVarPickerOpen(true);
          } else { addToCartDirect(data.product); toast.success(data.product.name); }
        }
      } else { toast.error('Produto não encontrado'); }
    } catch { toast.error('Erro na busca'); }
  };

  const addToCart = (product: Product) => {
    if (product.variations && product.variations.length > 0) { setVarPickerProduct(product); setVarPickerOpen(true); return; }
    addToCartDirect(product);
  };

  const addToCartDirect = (product: Product, variation?: Variation) => {
    setCart(prev => {
      const key = variation ? `${product.id}-${variation.id}` : product.id;
      const existing = prev.find(i => (variation ? `${i.product.id}-${i.variation?.id}` : i.product.id) === key);
      const maxStock = variation ? variation.stockQuantity : product.stockQuantity;
      const price = variation ? variation.salePrice : product.salePrice;
      if (existing) {
        if (existing.quantity >= maxStock) { toast.error('Estoque insuficiente'); return prev; }
        return prev.map(i => ((variation ? `${i.product.id}-${i.variation?.id}` : i.product.id) === key) ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, variation, quantity: 1, unitPrice: price, discount: 0 }];
    });
    setSearch(''); setVarPickerOpen(false); searchRef.current?.focus();
  };

  const cartKey = (item: CartItem) => item.variation ? `${item.product.id}-${item.variation.id}` : item.product.id;

  const updateQty = (key: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (cartKey(i) === key) {
        const newQty = i.quantity + delta;
        if (newQty <= 0) return i;
        const maxStock = i.variation ? i.variation.stockQuantity : i.product.stockQuantity;
        if (newQty > maxStock) { toast.error('Estoque insuficiente'); return i; }
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const setQty = (key: string, value: number) => {
    const qty = Math.max(1, Math.floor(value) || 1);
    setCart(prev => prev.map(i => {
      if (cartKey(i) === key) {
        const maxStock = i.variation ? i.variation.stockQuantity : i.product.stockQuantity;
        if (qty > maxStock) { toast.error('Estoque insuficiente'); return { ...i, quantity: maxStock }; }
        return { ...i, quantity: qty };
      }
      return i;
    }));
  };

  const removeFromCart = (key: string) => setCart(prev => prev.filter(i => cartKey(i) !== key));

  // Apply a price table to a cart item — sem trava de quantidade mínima
  const applyPriceTable = (key: string, tableId: string | null) => {
    setCart(prev => prev.map(i => {
      if (cartKey(i) !== key) return i;
      const tables = i.product.priceTables ?? [];
      if (!tableId || tableId === 'none') {
        // Remove price table — revert to original product/variation price
        const origPrice = i.variation ? i.variation.salePrice : i.product.salePrice;
        return { ...i, unitPrice: origPrice, priceTableId: undefined, priceTableName: undefined, originalPrice: undefined, appliedPrice: undefined, priceDiscount: undefined };
      }
      const table = tables.find(t => t.id === tableId);
      if (!table) return i;
      const origPrice = i.variation ? i.variation.salePrice : i.product.salePrice;
      // Aviso discreto se abaixo da referência — mas NUNCA bloqueia
      if (i.quantity < table.minQuantity) {
        toast.info(`Qtd. abaixo da referência (${table.minQuantity}pç) para "${table.name}" — uso permitido.`, { duration: 3000 });
      }
      return {
        ...i,
        unitPrice: table.unitPrice,
        priceTableId: table.id,
        priceTableName: table.name,
        originalPrice: origPrice,
        appliedPrice: table.unitPrice,
        priceDiscount: origPrice - table.unitPrice,
      };
    }));
  };

  // Auto-suggest best price table when quantity changes
  const autoSuggestPriceTable = useCallback((item: CartItem): PriceTableEntry | null => {
    const tables = (item.product.priceTables ?? []).filter(t => item.quantity >= t.minQuantity);
    if (tables.length === 0) return null;
    // Return table with lowest price among qualifying tables
    return tables.reduce((best, t) => t.unitPrice < best.unitPrice ? t : best, tables[0]);
  }, []);

  const subtotal = cart.reduce((s, i) => s + (i.unitPrice * i.quantity - i.discount), 0);
  const computedDiscount = discountType === 'percent' ? subtotal * (discountInput / 100) : discountInput;
  const total = subtotal - computedDiscount;

  // Determine if the current user/seller can edit prices
  const canEditPriceNow = (() => {
    const role = (session?.user as any)?.role;
    if (role === 'administrador' || role === 'socio' || role === 'master') return true;
    if (selectedSeller) {
      const sel = sellers.find(s => (s.userId || s.id) === selectedSeller);
      return sel?.canEditPrice ?? false;
    }
    // No seller selected — check if current user has a linked seller with permission
    const userId = (session?.user as any)?.id;
    const linkedSeller = sellers.find(s => s.userId === userId);
    return linkedSeller?.canEditPrice ?? false;
  })();

  const updateItemPrice = (key: string, newPrice: number) => {
    setCart(prev => prev.map(i => cartKey(i) === key ? { ...i, unitPrice: Math.max(0, newPrice) } : i));
  };

  const formatWhatsAppNumber = (num: string | null | undefined): string | null => {
    if (!num) return null;
    const digits = num.replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (digits.startsWith('55')) return digits;
    return `55${digits}`;
  };

  const [whatsappTemplate, setWhatsappTemplate] = useState('');

  useEffect(() => {
    fetch('/api/configuracoes/mensagens').then(r => r.json()).then((d: any[]) => {
      const waTpl = d?.find((t: any) => t.type === 'whatsapp');
      if (waTpl?.content) setWhatsappTemplate(waTpl.content);
    }).catch(() => {});
  }, []);

  // Load orçamento for editing when editSaleId is provided
  const loadOrcamentoForEdit = useCallback(async (saleId: string) => {
    try {
      const res = await fetch(`/api/vendas/${saleId}`);
      if (!res.ok) { toast.error('Erro ao carregar orçamento'); return; }
      const sale = await res.json();
      if (sale.status !== 'orcamento') { toast.error('Apenas orçamentos podem ser editados'); return; }

      // Set editing state
      setEditingOrcamentoId(sale.id);
      setEditingOrcamentoNumber(formatSaleNumber(sale.companySaleNumber, sale.saleNumber));

      // Set customer
      if (sale.customerId) setSelectedCustomer(sale.customerId);

      // Set seller (sellerId references User.id directly)
      if (sale.sellerId) {
        setSelectedSeller(sale.sellerId);
      } else if (sale.seller?.id) {
        setSelectedSeller(sale.seller.id);
      }

      // Set discount
      if (sale.discount > 0) {
        setDiscountType('value');
        setDiscountInput(sale.discount);
      }

      // Build cart items from sale items
      const cartItems: CartItem[] = (sale.items || []).map((item: any) => ({
        product: item.product,
        variation: item.variation || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        priceTableId: item.priceTableId || undefined,
        priceTableName: item.priceTableName || undefined,
        originalPrice: item.originalPrice || undefined,
        appliedPrice: item.appliedPrice || undefined,
        priceDiscount: item.priceDiscount || undefined,
      }));
      setCart(cartItems);

      toast.success(`Orçamento #${formatSaleNumber(sale.companySaleNumber, sale.saleNumber)} carregado para edição`);
    } catch {
      toast.error('Erro ao carregar orçamento');
    }
  }, []);

  // Auto-load orçamento if editSaleId is provided via URL
  const [editLoaded, setEditLoaded] = useState(false);
  useEffect(() => {
    if (editSaleId && !editLoaded && products.length > 0) {
      setEditLoaded(true);
      loadOrcamentoForEdit(editSaleId);
    }
  }, [editSaleId, editLoaded, products, loadOrcamentoForEdit]);

  const cancelEditing = () => {
    setEditingOrcamentoId(null);
    setEditingOrcamentoNumber(null);
    setCart([]);
    setSelectedCustomer('');
    setSelectedSeller('');
    setDiscountInput(0);
    setDiscountType('value');
    setPaymentEntries([]);
    // Remove edit param from URL
    router.replace('/pdv');
    toast.info('Edição cancelada');
  };

  const handleDownloadPDF = async (saleId: string) => {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/vendas/${saleId}/comprovante`);
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprovante-${lastSaleNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF gerado com sucesso!');
    } catch (err) {
      toast.error('Erro ao gerar o comprovante PDF');
      console.error(err);
    }
    setPdfLoading(false);
  };

  const [sharePdfLoading, setSharePdfLoading] = useState(false);

  // Generate message text for sharing
  const buildShareMessage = (customerName: string, saleNumber: string, total: number) => {
    if (whatsappTemplate) {
      return whatsappTemplate
        .replace(/\{cliente\}/g, customerName)
        .replace(/\{pedido\}/g, String(saleNumber))
        .replace(/\{total\}/g, fmt(total))
        .replace(/\{vendedor\}/g, sellers.find(s => (s.userId || s.id) === selectedSeller)?.name || session?.user?.name || '')
        .replace(/\{empresa\}/g, session?.user?.companyName ?? 'PushSisten')
        .replace(/\\n/g, '\n');
    }
    return `Olá, ${customerName}! 😊\n\nSegue o comprovante da sua compra #${saleNumber}.\n\nTotal: ${fmt(total)}\n\nObrigado pela preferência ❤️`;
  };

  // Share comprovante using navigator.share (native share sheet) with fallback
  const handleShareComprovante = async () => {
    if (!lastSaleData) return;
    setSharePdfLoading(true);
    try {
      // 1. Generate PDF
      const res = await fetch(`/api/vendas/${lastSaleData.saleId}/comprovante`);
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      const blob = await res.blob();
      const isOrcamento = lastSaleData.isOrcamento;
      const docType = isOrcamento ? 'orcamento' : 'comprovante';
      const fileName = `${docType}-${lastSaleNumber}.pdf`;
      const shareText = buildShareMessage(lastSaleData.customerName, lastSaleNumber, lastSaleData.total);

      // 2. Try native share with file (mobile)
      if (typeof navigator !== 'undefined' && navigator.share) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });

        if (canShareFiles) {
          await navigator.share({
            title: `${isOrcamento ? 'Orçamento' : 'Comprovante'} #${lastSaleNumber}`,
            text: shareText,
            files: [file],
          });
          toast.success('Comprovante compartilhado!');
        } else {
          // Share without file (text only) + download PDF separately
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = fileName;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a); URL.revokeObjectURL(url);

          await navigator.share({
            title: `${isOrcamento ? 'Orçamento' : 'Comprovante'} #${lastSaleNumber}`,
            text: shareText,
          });
          toast.success('PDF baixado e mensagem compartilhada!');
        }
      } else {
        // 3. Fallback for desktop: open share modal with options
        setShareModalOpen(true);
      }
    } catch (err: any) {
      // User cancelled share — not an error
      if (err?.name === 'AbortError') {
        // do nothing
      } else {
        toast.error('Erro ao compartilhar comprovante');
        console.error(err);
      }
    }
    setSharePdfLoading(false);
  };

  // Fallback: download PDF + open WhatsApp with message
  const handleFallbackWhatsApp = async () => {
    if (!lastSaleData?.customerPhone) return;
    setSharePdfLoading(true);
    try {
      const res = await fetch(`/api/vendas/${lastSaleData.saleId}/comprovante`);
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      const blob = await res.blob();
      const docType = lastSaleData.isOrcamento ? 'orcamento' : 'comprovante';
      const fileName = `${docType}-${lastSaleNumber}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);

      const msg = encodeURIComponent(buildShareMessage(lastSaleData.customerName, lastSaleNumber, lastSaleData.total));
      setTimeout(() => {
        window.open(`https://wa.me/${lastSaleData.customerPhone}?text=${msg}`, '_blank');
      }, 500);
      toast.success('PDF baixado! Anexe na conversa do WhatsApp.', { duration: 5000 });
    } catch {
      toast.error('Erro ao preparar comprovante');
    }
    setSharePdfLoading(false);
    setShareModalOpen(false);
  };

  // Fallback: copy message to clipboard
  const handleCopyMessage = () => {
    if (!lastSaleData) return;
    const msg = buildShareMessage(lastSaleData.customerName, lastSaleNumber, lastSaleData.total);
    navigator.clipboard.writeText(msg).then(() => {
      toast.success('Mensagem copiada!');
    }).catch(() => {
      toast.error('Erro ao copiar mensagem');
    });
  };

  // Payment helpers
  const openPaymentDialog = () => {
    if (cart.length === 0) { toast.error('Carrinho vazio'); return; }
    if (paymentEntries.length === 0 && paymentMethods.length > 0) {
      setPaymentEntries([{ methodId: paymentMethods[0].id, amount: total }]);
    } else if (paymentEntries.length > 0) {
      // Update first entry to remaining total
      const totalPaid = paymentEntries.reduce((s, e) => s + e.amount, 0);
      if (Math.abs(totalPaid - total) > 0.01) {
        setPaymentEntries(prev => {
          const updated = [...prev];
          updated[0] = { ...updated[0], amount: total };
          return updated;
        });
      }
    }
    setPaymentOpen(true);
  };

  const getMethodById = (id: string) => paymentMethods.find(m => m.id === id);

  const totalPaid = useMemo(() => paymentEntries.reduce((s, e) => s + (e.amount || 0), 0), [paymentEntries]);
  const remaining = total - totalPaid;

  // Crediário detection: check if any payment entry uses a crediário-type method
  const hasCrediario = useMemo(() => paymentEntries.some(e => {
    const m = paymentMethods.find(pm => pm.id === e.methodId);
    return m?.type === 'crediario';
  }), [paymentEntries, paymentMethods]);
  const crediarioEntry = useMemo(() => {
    const idx = paymentEntries.findIndex(e => {
      const m = paymentMethods.find(pm => pm.id === e.methodId);
      return m?.type === 'crediario';
    });
    return idx >= 0 ? { idx, entry: paymentEntries[idx] } : null;
  }, [paymentEntries, paymentMethods]);
  const availableCredit = customerCredit ? customerCredit.creditLimit - customerCredit.usedLimit : 0;

  const addPaymentEntry = () => {
    const unused = paymentMethods.find(m => !paymentEntries.some(e => e.methodId === m.id));
    if (!unused) { toast.error('Todas as formas já foram adicionadas'); return; }
    setPaymentEntries(prev => [...prev, { methodId: unused.id, amount: Math.max(0, remaining) }]);
  };

  const removePaymentEntry = (idx: number) => {
    if (paymentEntries.length <= 1) return;
    setPaymentEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePaymentEntry = (idx: number, field: string, value: any) => {
    setPaymentEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  // Build payments array from paymentEntries
  const buildPaymentsPayload = () => paymentEntries.map(e => {
    const method = getMethodById(e.methodId);
    const feeAmount = method ? (e.amount * (method.feePercent / 100)) + method.feeFixed : 0;
    const netAmount = e.amount - feeAmount;
    const expectedDate = method ? calcExpectedDate(method.defaultDays, method.businessDays).toISOString() : new Date().toISOString();
    return {
      paymentMethodId: e.methodId, amount: e.amount, feePercent: method?.feePercent ?? 0,
      feeAmount, netAmount, expectedDate, cashAccountId: method?.cashAccountId ?? '',
    };
  });

  const finalizeSale = async (asOrcamento = false) => {
    if (cart.length === 0) { toast.error('Carrinho vazio'); return; }

    // Validação de pagamento: exigido quando NÃO é orçamento
    if (!asOrcamento) {
      if (paymentEntries.length === 0) { toast.error('Selecione a forma de pagamento'); return; }
      if (Math.abs(remaining) > 0.01) { toast.error('O valor pago deve ser igual ao total da venda'); return; }
      // Validações específicas de crediário
      if (hasCrediario) {
        if (!selectedCustomer) { toast.error('Selecione um cliente para venda em crediário'); return; }
        if (!customerCredit) { toast.error('Cliente não possui crédito cadastrado. Cadastre em Crediário > Créditos.'); return; }
        if (customerCredit.status !== 'ACTIVE') { toast.error('Crediário do cliente está bloqueado'); return; }
        const crediarioAmount = crediarioEntry?.entry?.amount ?? 0;
        if (crediarioAmount > availableCredit + 0.01) { toast.error(`Limite insuficiente. Disponível: ${fmt(availableCredit)}`); return; }
      }
    }

    setLoading(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      const saleItems = cart.map(i => ({ name: itemName(i), qty: i.quantity }));
      const sellerIdValue = (selectedSeller ? (sellers.find(s => (s.userId || s.id) === selectedSeller)?.userId || null) : null) || (session?.user as any)?.id || null;

      const itemsPayload = cart.map(i => ({
        productId: i.product.id,
        variationId: i.variation?.id ?? null,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        priceTableId: i.priceTableId ?? null,
        priceTableName: i.priceTableName ?? null,
        originalPrice: i.originalPrice ?? null,
        appliedPrice: i.appliedPrice ?? null,
        priceDiscount: i.priceDiscount ?? null,
      }));

      let res: Response;
      const isEditing = !!editingOrcamentoId;

      if (isEditing && !asOrcamento) {
        // ===== CONVERTER ORÇAMENTO EM VENDA (com pagamento completo) =====
        res = await fetch(`/api/vendas/${editingOrcamentoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            convertToSale: true,
            customerId: selectedCustomer || null,
            sellerId: sellerIdValue,
            discount: computedDiscount,
            items: itemsPayload,
            paymentMethod: paymentEntries.map(e => getMethodById(e.methodId)?.name ?? '').join(' + '),
            payments: buildPaymentsPayload(),
            ...(hasCrediario && crediarioEntry ? {
              crediario: {
                parcelas: crediarioConfig.parcelas,
                entrada: total - crediarioEntry.entry.amount,
                termDays: crediarioConfig.termDays,
              }
            } : {}),
          }),
        });
      } else if (isEditing && asOrcamento) {
        // ===== SALVAR ALTERAÇÕES NO ORÇAMENTO (mantém status orçamento) =====
        res = await fetch(`/api/vendas/${editingOrcamentoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            editMode: true,
            customerId: selectedCustomer || null,
            sellerId: sellerIdValue,
            discount: computedDiscount,
            items: itemsPayload,
          }),
        });
      } else {
        // ===== CRIAR NOVA VENDA OU NOVO ORÇAMENTO =====
        res = await fetch('/api/vendas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: selectedCustomer || null,
            sellerId: sellerIdValue,
            paymentMethod: asOrcamento ? 'orcamento' : paymentEntries.map(e => getMethodById(e.methodId)?.name ?? '').join(' + '),
            discount: computedDiscount,
            status: asOrcamento ? 'orcamento' : 'concluida',
            items: itemsPayload,
            payments: asOrcamento ? undefined : buildPaymentsPayload(),
            ...(hasCrediario && crediarioEntry && !asOrcamento ? {
              crediario: {
                parcelas: crediarioConfig.parcelas,
                entrada: total - crediarioEntry.entry.amount,
                termDays: crediarioConfig.termDays,
              }
            } : {}),
          }),
        });
      }

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro'); }
      const sale = await res.json();

      setLastSaleNumber(formatSaleNumber(sale.companySaleNumber, sale.saleNumber));
      setLastSaleData({
        saleId: sale.id,
        customerName: customer?.name ?? 'Cliente',
        customerPhone: customer ? formatWhatsAppNumber((customer as any).whatsapp || (customer as any).phone) ?? '' : '',
        items: saleItems,
        total,
        isOrcamento: asOrcamento,
      });
      setSuccessDialog(true);

      // ONBOARDING: marcar venda como completada
      if (onboardingMode && !asOrcamento) {
        try {
          await markSaleCompleted();
          // Após 2s, fecha o success e mostra celebração
          setTimeout(() => {
            setSuccessDialog(false);
            setShowCelebration(true);
          }, 1500);
        } catch (e) {
          console.error('Erro ao marcar venda no onboarding:', e);
        }
      }

      // Clear state
      setCart([]); setSelectedCustomer(''); setDiscountInput(0); setDiscountType('value'); setPaymentOpen(false); setPaymentEntries([]); setCrediarioConfig({ parcelas: 2, termDays: 30 });
      setEditingOrcamentoId(null); setEditingOrcamentoNumber(null);
      if (isEditing) router.replace('/pdv');

      fetch('/api/produtos?limit=500').then(r => r.json()).then(d => setProducts(d.products || []));
    } catch (err: any) {
      const isEditing = !!editingOrcamentoId;
      const msg = isEditing
        ? (asOrcamento ? 'Erro ao atualizar orçamento' : 'Erro ao converter em venda')
        : (asOrcamento ? 'Erro ao salvar orçamento' : 'Erro ao finalizar venda');
      toast.error(err.message || msg);
    }
    setLoading(false);
  };

  const itemName = (item: CartItem) => {
    const parts = [item.product.name];
    if (item.variation) parts.push([item.variation.color, item.variation.size].filter(Boolean).join(' '));
    return parts.join(' — ');
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* PDV Header */}
      <div className="bg-[hsl(222,47%,11%)] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-blue-400" />
          <h1 className="font-display font-bold text-lg hidden sm:block">PDV - PushSisten</h1>
          <h1 className="font-display font-bold text-base sm:hidden">PDV</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 mr-3">
            <Badge variant="outline" className="text-[10px] text-blue-300 border-blue-500/30 font-mono">F2 Busca</Badge>
            <Badge variant="outline" className="text-[10px] text-blue-300 border-blue-500/30 font-mono">F3 Barcode</Badge>
            <Badge variant="outline" className="text-[10px] text-blue-300 border-blue-500/30 font-mono">F4 Pagto</Badge>
            <Badge variant="outline" className="text-[10px] text-blue-300 border-blue-500/30 font-mono">F8 Finalizar</Badge>
          </div>
          <Badge variant="outline" className="text-blue-300 border-blue-500/30 text-xs">{session?.user?.name || 'Operador'}</Badge>
          <a href="/hoje" className="text-xs text-slate-400 hover:text-white transition">← Voltar</a>
        </div>
      </div>

      {/* Mobile view toggle */}
      <div className="md:hidden border-b border-border bg-muted/30 flex">
        <button
          onClick={() => setMobileView('products')}
          className={`flex-1 py-2.5 text-sm font-medium text-center flex items-center justify-center gap-2 transition-colors ${mobileView === 'products' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-muted-foreground'}`}
        >
          <Search className="w-4 h-4" />Produtos
        </button>
        <button
          onClick={() => setMobileView('cart')}
          className={`flex-1 py-2.5 text-sm font-medium text-center flex items-center justify-center gap-2 transition-colors relative ${mobileView === 'cart' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-muted-foreground'}`}
        >
          <ShoppingCart className="w-4 h-4" />Carrinho
          {cart.length > 0 && (
            <span className="absolute top-1.5 right-[calc(50%-40px)] bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{cart.length}</span>
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Product search + results */}
        <div className={`flex-1 flex flex-col border-r border-border overflow-hidden ${mobileView === 'cart' ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="flex gap-2">
              <div className="relative flex-1">
                {barcodeMode ? (
                  <>
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                    <Input ref={barcodeRef} placeholder="Leia o código de barras..." className="pl-11 h-11 text-base border-amber-400 focus:ring-amber-500" autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') { handleBarcodeSearch((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
                  </>
                ) : (
                  <>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input ref={searchRef} placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 h-11 text-base" autoFocus />
                  </>
                )}
              </div>
              <Button variant={barcodeMode ? 'default' : 'outline'} size="icon" className="h-11 w-11 flex-shrink-0" onClick={() => { setBarcodeMode(!barcodeMode); setTimeout(() => barcodeMode ? searchRef.current?.focus() : barcodeRef.current?.focus(), 50); }} title="Alternar modo leitor">
                <Barcode className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {!barcodeMode && search ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum produto encontrado</p>
                ) : filteredProducts.map(p => {
                  const hasVars = (p.variations?.length ?? 0) > 0;
                  return (
                    <Card key={p.id} className="cursor-pointer hover:border-blue-400 hover:shadow-md transition-all" onClick={() => { addToCart(p); if (window.innerWidth < 768) setMobileView('cart'); }}>
                      <CardContent className="p-2.5 sm:p-3">
                        <p className="font-medium text-xs sm:text-sm truncate">{p.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] sm:text-xs text-muted-foreground">{p.sku || 'Sem SKU'}</span>
                          <div className="flex items-center gap-1">
                            {(p.priceTables?.length ?? 0) > 0 && <Badge variant="outline" className="text-[10px] px-1 border-amber-400 text-amber-600"><Tag className="w-2.5 h-2.5 mr-0.5" />{p.priceTables!.length}</Badge>}
                            {hasVars && <Badge variant="outline" className="text-[10px] px-1"><Layers className="w-3 h-3 mr-0.5" />{p.variations!.length}</Badge>}
                            <Badge variant="outline" className="text-[10px] sm:text-xs">{p.stockQuantity} un</Badge>
                          </div>
                        </div>
                        <p className="num-highlight text-blue-600 mt-1.5 sm:mt-2 text-sm">{fmt(p.salePrice)}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : !barcodeMode ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Package className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Busque um produto</p>
                <p className="text-sm text-center">Digite o nome ou SKU do produto</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Barcode className="w-20 h-20 mb-4 opacity-20 text-amber-500" />
                <p className="text-lg font-medium">Modo Leitor de Barras</p>
                <p className="text-sm">Leia o código de barras do produto</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className={`w-full md:max-w-md flex flex-col bg-card ${mobileView === 'products' ? 'hidden md:flex' : 'flex'}`}>
          {/* Seller selection */}
          <div className="px-3 pt-3 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-muted-foreground" />
              {isSellerLocked ? (
                <div className="flex-1 h-8 flex items-center px-2 text-xs bg-muted/50 rounded-md border border-input">
                  <span className="truncate">{sellers.find(s => s.userId === userId)?.name || session?.user?.name || 'Vendedor'}</span>
                  <Badge variant="outline" className="ml-auto text-[9px] px-1">Fixo</Badge>
                </div>
              ) : (
                <Select value={selectedSeller} onValueChange={(v) => setSelectedSeller(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Operador atual</SelectItem>
                    {sellers.map(s => <SelectItem key={s.id} value={s.userId || s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            {editingOrcamentoId && (
              <div className="mt-1.5 flex items-center justify-between gap-1.5 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1">
                <div className="flex items-center gap-1.5">
                  <Edit className="w-3 h-3" />
                  <span className="font-medium">Editando orçamento #{editingOrcamentoNumber}</span>
                </div>
                <button onClick={cancelEditing} className="text-red-500 hover:text-red-700 font-medium underline">Cancelar</button>
              </div>
            )}
          </div>

          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2 text-sm"><ShoppingCart className="w-4 h-4" /> Carrinho</h2>
              <Badge>{cart.length} {cart.length === 1 ? 'item' : 'itens'}</Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShoppingCart className="w-12 h-12 opacity-20 mb-2" />
                <p className="text-sm">Carrinho vazio</p>
                <button onClick={() => setMobileView('products')} className="md:hidden text-xs text-blue-600 mt-2 underline">Buscar produtos</button>
              </div>
            ) : cart.map(item => {
              const hasTables = (item.product.priceTables?.length ?? 0) > 0;
              const suggestedTable = hasTables ? autoSuggestPriceTable(item) : null;
              const showSuggestion = suggestedTable && !item.priceTableId && suggestedTable.unitPrice < item.unitPrice;
              return (
              <div key={cartKey(item)} className={`p-2.5 rounded-xl border ${item.priceTableId ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-800/30' : 'bg-muted/50 border-border/50'}`}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.product.name}</p>
                    {item.variation && <p className="text-[10px] text-muted-foreground">{[item.variation.color, item.variation.size].filter(Boolean).join(' • ')}</p>}
                    {canEditPriceNow ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.unitPrice || ''}
                          onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*[.,]?\d*$/.test(v)) updateItemPrice(cartKey(item), parseFloat(v.replace(',', '.')) || 0); }}
                          onBlur={(e) => { if (!e.target.value) updateItemPrice(cartKey(item), 0); }}
                          className="w-16 h-5 text-[11px] font-mono bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-700 rounded px-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <span className="text-[10px] text-muted-foreground">un</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">{fmt(item.unitPrice)} un</p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(cartKey(item), -1)}><Minus className="w-3 h-3" /></Button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.quantity || ''}
                      onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setQty(cartKey(item), parseInt(v) || 1); }}
                      onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 1) setQty(cartKey(item), 1); }}
                      className="w-10 h-6 text-center text-xs font-bold bg-white dark:bg-zinc-900 border border-input rounded focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(cartKey(item), 1)}><Plus className="w-3 h-3" /></Button>
                  </div>
                  <p className="font-mono text-xs font-semibold w-16 text-right">{fmt(item.unitPrice * item.quantity)}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" onClick={() => removeFromCart(cartKey(item))}><Trash2 className="w-3 h-3" /></Button>
                </div>
                {/* Price table indicator / selector */}
                {hasTables && (
                  <>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <select
                        value={item.priceTableId || 'none'}
                        onChange={(e) => applyPriceTable(cartKey(item), e.target.value === 'none' ? null : e.target.value)}
                        className="flex-1 h-5 text-[10px] bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 rounded px-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      >
                        <option value="none">Preço normal</option>
                        {(item.product.priceTables ?? []).map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({'\u2265'}{t.minQuantity}pç — {fmt(t.unitPrice)})
                          </option>
                        ))}
                      </select>
                      {item.priceDiscount && item.priceDiscount > 0 && (
                        <Badge className="text-[9px] h-3.5 px-1 bg-green-100 text-green-700 border-green-300">-{fmt(item.priceDiscount)}/un</Badge>
                      )}
                    </div>
                    {item.priceTableId && (item.product.priceTables ?? []).some(t => t.id === item.priceTableId && item.quantity < t.minQuantity) && (
                      <p className="mt-0.5 text-[9px] text-amber-600 dark:text-amber-400 pl-4">
                        {'\u26A0'} Qtd. abaixo da referência da tabela — uso permitido
                      </p>
                    )}
                  </>
                )}
                {/* Auto-suggest banner */}
                {showSuggestion && (
                  <button
                    onClick={() => applyPriceTable(cartKey(item), suggestedTable.id)}
                    className="mt-1 w-full text-left text-[10px] px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors"
                  >
                    💡 Aplicar <strong>{suggestedTable.name}</strong> — {fmt(suggestedTable.unitPrice)}/un (economia de {fmt((item.unitPrice - suggestedTable.unitPrice) * item.quantity)})
                  </button>
                )}
              </div>
              );
            })}
          </div>

          {/* Cart footer */}
          <div className="border-t border-border p-3 space-y-2">
            {/* Customer search */}
            <div>
              <Label className="text-[10px]">Cliente</Label>
              <div className="relative" ref={customerDropdownRef}>
                {selectedCustomer ? (
                  <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-input bg-background text-xs">
                    <UserCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="flex-1 truncate font-medium">{selectedCustomerObj?.name}</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedCustomer(''); setCustomerSearch(''); }}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      ref={customerSearchRef}
                      placeholder="Buscar cliente..."
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); }}
                      onFocus={() => setCustomerDropdownOpen(true)}
                      className="pl-8 h-8 text-xs"
                    />
                  </>
                )}
                {customerDropdownOpen && !selectedCustomer && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/70 transition-colors text-muted-foreground"
                      onClick={() => { setSelectedCustomer(''); setCustomerDropdownOpen(false); setCustomerSearch(''); }}
                    >
                      Consumidor Final
                    </button>
                    {filteredCustomers.length === 0 && customerSearch.trim() && (
                      <div className="px-3 py-2 space-y-1">
                        <p className="text-xs text-muted-foreground text-center">Nenhum cliente encontrado</p>
                        <button
                          type="button"
                          className="w-full text-left px-2 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-700 dark:text-blue-400 flex items-center gap-1.5 font-medium transition-colors"
                          onClick={() => {
                            setQuickCustomerForm({ name: customerSearch.trim(), phone: '', city: '', type: 'varejo' });
                            setQuickCustomerOpen(true);
                            setCustomerDropdownOpen(false);
                          }}
                        >
                          <Plus className="w-3 h-3" /> Cadastrar &quot;{customerSearch.trim()}&quot;
                        </button>
                      </div>
                    )}
                    {filteredCustomers.length === 0 && !customerSearch.trim() && (
                      <p className="px-3 py-3 text-xs text-muted-foreground text-center">Nenhum cliente encontrado</p>
                    )}
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/70 transition-colors flex items-center gap-2"
                        onClick={() => { setSelectedCustomer(c.id); setCustomerDropdownOpen(false); setCustomerSearch(''); }}
                      >
                        <UserCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium truncate block">{c.name}</span>
                          {(c.phone || c.whatsapp) && <span className="text-[10px] text-muted-foreground">{c.whatsapp || c.phone}</span>}
                        </div>
                        <Badge variant="outline" className="text-[9px] flex-shrink-0">{c.type === 'atacado' ? 'Atacado' : 'Varejo'}</Badge>
                      </button>
                    ))}
                    {/* Always-visible + Novo Cliente button */}
                    <div className="sticky bottom-0 border-t border-border bg-popover px-2 py-1.5">
                      <button
                        type="button"
                        className="w-full text-left px-2 py-1.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-semibold transition-colors"
                        onClick={() => {
                          setQuickCustomerForm({ name: customerSearch.trim(), phone: '', city: '', type: 'varejo' });
                          setQuickCustomerOpen(true);
                          setCustomerDropdownOpen(false);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Novo Cliente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Discount with type toggle */}
            <div>
              <Label className="text-[10px]">Desconto</Label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  {discountType === 'percent' ? (
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={discountInput || ''}
                      onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*[.,]?\d*$/.test(v)) setDiscountInput(parseFloat(v.replace(',', '.')) || 0); }}
                      onBlur={(e) => { if (!e.target.value) setDiscountInput(0); }}
                      className="h-8 text-xs pr-8"
                      placeholder="0%"
                    />
                  ) : (
                    <CurrencyInput value={discountInput} onChange={(v) => setDiscountInput(v)} className="h-8 text-xs pr-8" placeholder="0,00" />
                  )}
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                    {discountType === 'percent' ? '%' : 'R$'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setDiscountType(prev => prev === 'value' ? 'percent' : 'value'); setDiscountInput(0); }}
                  className={`h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md border transition-all text-xs font-bold ${
                    discountType === 'percent'
                      ? 'bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400'
                      : 'bg-muted/50 border-input text-muted-foreground hover:bg-muted'
                  }`}
                  title={discountType === 'percent' ? 'Mudar para R$' : 'Mudar para %'}
                >
                  {discountType === 'percent' ? '%' : 'R$'}
                </button>
              </div>
            </div>

            <div className="space-y-0.5 pt-2 border-t border-border">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{fmt(subtotal)}</span></div>
              {computedDiscount > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Desconto{discountType === 'percent' ? ` (${discountInput}%)` : ''}</span><span className="font-mono text-red-600">-{fmt(computedDiscount)}</span></div>}
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="num-highlight text-blue-600">{fmt(total)}</span></div>
            </div>

            {/* Payment summary if entries exist */}
            {paymentEntries.length > 0 && (
              <div className="space-y-1 p-2 rounded-lg bg-muted/50">
                {paymentEntries.map((e, idx) => {
                  const method = getMethodById(e.methodId);
                  const Icon = pmTypeIcons[method?.type ?? 'outro'] ?? CircleDot;
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3 text-muted-foreground" />
                        <span>{method?.name ?? 'Forma'}</span>
                      </div>
                      <span className="font-mono font-medium">{fmt(e.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {editingOrcamentoId ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="h-11 text-xs sm:text-sm gap-1 sm:gap-2" onClick={() => finalizeSale(true)} disabled={cart.length === 0 || loading}>
                    <ClipboardList className="w-4 h-4 flex-shrink-0" /><span className="truncate">Salvar Orç.</span>
                  </Button>
                  <Button variant="outline" className="h-11 text-xs sm:text-sm gap-1 sm:gap-2" onClick={openPaymentDialog} disabled={cart.length === 0}>
                    <Wallet className="w-4 h-4 flex-shrink-0" /><span className="truncate">Pagamento</span>
                  </Button>
                  <Button className="h-11 text-xs sm:text-sm gap-1 sm:gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={cart.length === 0 || paymentEntries.length === 0 || Math.abs(remaining) > 0.01 || loading} onClick={() => finalizeSale(false)}>
                    <CheckCircle className="w-4 h-4 flex-shrink-0" /><span className="truncate">{loading ? 'Aguarde...' : 'Fechar Venda'}</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-11 text-xs sm:text-sm gap-1 sm:gap-2" onClick={() => finalizeSale(true)} disabled={cart.length === 0 || loading}>
                  <ClipboardList className="w-4 h-4 flex-shrink-0" /><span className="truncate">Orçamento</span>
                </Button>
                <Button variant="outline" className="h-11 text-xs sm:text-sm gap-1 sm:gap-2" onClick={openPaymentDialog} disabled={cart.length === 0}>
                  <Wallet className="w-4 h-4 flex-shrink-0" /><span className="truncate">Pagamento</span>
                </Button>
                <Button className="h-11 text-xs sm:text-sm gap-1 sm:gap-2" disabled={cart.length === 0 || paymentEntries.length === 0 || Math.abs(remaining) > 0.01 || loading} onClick={() => finalizeSale(false)}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /><span className="truncate">{loading ? 'Aguarde...' : 'Finalizar'}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Wallet className="w-5 h-5" /> Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30">
              <span className="text-sm font-medium">Total da Venda</span>
              <span className="text-xl num-highlight text-blue-600">{fmt(total)}</span>
            </div>

            {paymentMethods.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma forma de pagamento cadastrada</p>
                <p className="text-xs mt-1">Cadastre formas de pagamento em Configurações</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentEntries.map((entry, idx) => {
                  const method = getMethodById(entry.methodId);
                  const feeAmount = method ? (entry.amount * (method.feePercent / 100)) + method.feeFixed : 0;
                  const netAmount = entry.amount - feeAmount;
                  const expectedDate = method ? calcExpectedDate(method.defaultDays, method.businessDays) : new Date();
                  const Icon = pmTypeIcons[method?.type ?? 'outro'] ?? CircleDot;

                  return (
                    <div key={idx} className="p-3 rounded-xl border border-border bg-card space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={entry.methodId}
                            onChange={(e: any) => updatePaymentEntry(idx, 'methodId', e.target.value)}>
                            {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </div>
                        <CurrencyInput className="w-32 h-9" value={entry.amount || 0}
                          onChange={(v: number) => updatePaymentEntry(idx, 'amount', v)} />
                        {paymentEntries.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => removePaymentEntry(idx)}><X className="w-4 h-4" /></Button>
                        )}
                      </div>
                      {/* Payment details */}
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Wallet className="w-3 h-3" />
                          <span className="truncate">{method?.cashAccount?.name ?? '—'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{method?.defaultDays === 0 ? 'Imediato' : `${method?.defaultDays}d ${method?.businessDays ? '(úteis)' : ''}`}</span>
                        </div>
                        <div className="text-right">
                          {feeAmount > 0 ? (
                            <span className="text-red-500">Taxa: {fmt(feeAmount)} | Líq: {fmt(netAmount)}</span>
                          ) : (
                            <span className="text-emerald-600">Sem taxa</span>
                          )}
                        </div>
                      </div>
                      {method && method.defaultDays > 0 && (
                        <p className="text-[10px] text-amber-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />Previsão: {expectedDate.toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  );
                })}

                <Button variant="outline" size="sm" className="w-full" onClick={addPaymentEntry}><Plus className="w-3 h-3 mr-1" />Adicionar outra forma</Button>

                {/* Crediário config section */}
                {hasCrediario && (
                  <div className="p-3 rounded-xl border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700 space-y-3">
                    <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <HandCoins className="w-4 h-4" />
                      <span className="font-semibold text-sm">Configuração do Crediário</span>
                    </div>

                    {!selectedCustomer && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>Selecione um cliente antes de usar crediário</span>
                      </div>
                    )}

                    {selectedCustomer && !customerCredit && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-xs">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>Cliente sem crédito cadastrado. Cadastre em Crediário &gt; Créditos.</span>
                      </div>
                    )}

                    {selectedCustomer && customerCredit && (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-white dark:bg-background border">
                            <p className="text-muted-foreground">Limite</p>
                            <p className="font-bold num-highlight">{fmt(customerCredit.creditLimit)}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-background border">
                            <p className="text-muted-foreground">Utilizado</p>
                            <p className="font-bold num-highlight text-amber-600">{fmt(customerCredit.usedLimit)}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-background border">
                            <p className="text-muted-foreground">Disponível</p>
                            <p className={`font-bold num-highlight ${availableCredit >= (crediarioEntry?.entry?.amount ?? 0) ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(availableCredit)}</p>
                          </div>
                        </div>

                        {customerCredit.status !== 'ACTIVE' && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 text-xs">
                            <AlertTriangle className="w-4 h-4" /> Crediário bloqueado
                          </div>
                        )}

                        {customerCredit.status === 'ACTIVE' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Parcelas</Label>
                              <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                value={crediarioConfig.parcelas}
                                onChange={(e: any) => setCrediarioConfig(c => ({ ...c, parcelas: parseInt(e.target.value) || 2 }))}>
                                {[2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x de {fmt((crediarioEntry?.entry?.amount ?? 0) / n)}</option>)}
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs">Prazo (dias)</Label>
                              <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                value={crediarioConfig.termDays}
                                onChange={(e: any) => setCrediarioConfig(c => ({ ...c, termDays: parseInt(e.target.value) || 30 }))}>
                                {[15,30,45,60,90].map(d => <option key={d} value={d}>{d} dias</option>)}
                              </select>
                            </div>
                          </div>
                        )}

                        {crediarioEntry && availableCredit < (crediarioEntry.entry.amount - 0.01) && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span>Valor do crediário ({fmt(crediarioEntry.entry.amount)}) excede o limite disponível ({fmt(availableCredit)})</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Remaining indicator */}
                {Math.abs(remaining) > 0.01 && (
                  <div className={`p-2 rounded-lg text-center text-sm font-medium ${remaining > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                    {remaining > 0 ? `Faltam ${fmt(remaining)}` : `Excesso de ${fmt(Math.abs(remaining))}`}
                  </div>
                )}
                {Math.abs(remaining) <= 0.01 && paymentEntries.length > 0 && (
                  <div className="p-2 rounded-lg text-center text-sm font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                    ✅ Valor correto — pronto para finalizar
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPaymentOpen(false)}>Voltar</Button>
              <Button disabled={paymentEntries.length === 0 || Math.abs(remaining) > 0.01 || loading} onClick={() => { setPaymentOpen(false); finalizeSale(); }}>
                <CheckCircle className="w-4 h-4 mr-2" />Finalizar Venda
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variation Picker Dialog */}
      <Dialog open={varPickerOpen} onOpenChange={setVarPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Escolher Variação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">{varPickerProduct?.name}</p>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {(() => {
              const vars = varPickerProduct?.variations ?? [];
              const colors = [...new Set(vars.map(v => v.color).filter(Boolean))];
              if (colors.length > 0) {
                return colors.map(color => (
                  <div key={color}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{color}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vars.filter(v => v.color === color).map(v => (
                        <button key={v.id} onClick={() => { if (v.stockQuantity > 0) addToCartDirect(varPickerProduct!, v); }} disabled={v.stockQuantity <= 0}
                          className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                            v.stockQuantity <= 0 ? 'bg-muted text-muted-foreground/40 border-border cursor-not-allowed' :
                            'bg-background border-border hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                          }`}>
                          <span className="font-bold">{v.size || 'UN'}</span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">{v.stockQuantity} un • {fmt(v.salePrice)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ));
              } else {
                return vars.map(v => (
                  <button key={v.id} onClick={() => { if (v.stockQuantity > 0) addToCartDirect(varPickerProduct!, v); }} disabled={v.stockQuantity <= 0}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border text-xs transition-all ${
                      v.stockQuantity <= 0 ? 'bg-muted text-muted-foreground/40 cursor-not-allowed' : 'hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                    }`}>
                    <span className="font-medium">{[v.color, v.size, v.grade].filter(Boolean).join(' • ') || 'Variação'}</span>
                    <span>{v.stockQuantity} un • {fmt(v.salePrice)}</span>
                  </button>
                ));
              }
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Onboarding Celebration */}
      {showCelebration && (
        <OnboardingCelebration
          emoji="🎉"
          title="Parabéns."
          subtitle="Sua primeira venda foi registrada."
          autoClose={2500}
          onAction={() => router.push('/dashboard?onboarding=true')}
        />
      )}

      {/* Success Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="max-w-md text-center">
          <div className="flex flex-col items-center py-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${lastSaleData?.isOrcamento ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
              {lastSaleData?.isOrcamento ? <ClipboardList className="w-8 h-8 text-amber-600" /> : <CheckCircle className="w-8 h-8 text-emerald-600" />}
            </div>
            <h2 className="text-xl font-bold mb-1">{lastSaleData?.isOrcamento ? 'Orçamento Salvo!' : 'Venda Realizada!'}</h2>
            <p className="text-muted-foreground">
              {lastSaleData?.isOrcamento ? `Orçamento #${lastSaleNumber} salvo com sucesso` : `Venda #${lastSaleNumber} registrada com sucesso`}
            </p>
            {lastSaleData?.isOrcamento && (
              <p className="text-xs text-amber-600 mt-1">Os itens já foram reservados no estoque</p>
            )}
            {lastSaleData && (
              <div className="mt-3 text-left w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-xs space-y-2">
                <p className="font-medium text-sm">{lastSaleData.customerName}</p>
                <div className="space-y-0.5">
                  {lastSaleData.items.map((item, idx) => (
                    <p key={idx} className="text-muted-foreground">• {item.name} — {item.qty}x</p>
                  ))}
                </div>
                <p className={`num-highlight text-base mt-2 ${lastSaleData.isOrcamento ? 'text-amber-600' : 'text-emerald-600'}`}>{fmt(lastSaleData.total)}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            {/* Compartilhar Comprovante (primary action — native share sheet on mobile, fallback on desktop) */}
            {lastSaleData?.saleId && (
              <Button
                onClick={handleShareComprovante}
                disabled={sharePdfLoading || pdfLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
              >
                {sharePdfLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                {sharePdfLoading ? 'Preparando...' : `Compartilhar ${lastSaleData?.isOrcamento ? 'Orçamento' : 'Comprovante'}`}
              </Button>
            )}
            {/* PDF Download only */}
            {lastSaleData?.saleId && (
              <Button
                variant="outline"
                onClick={() => handleDownloadPDF(lastSaleData.saleId)}
                disabled={pdfLoading || sharePdfLoading}
                className="w-full"
              >
                {pdfLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {pdfLoading ? 'Gerando...' : lastSaleData?.isOrcamento ? 'Baixar Orçamento PDF' : 'Baixar Comprovante PDF'}
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => { setSuccessDialog(false); setShareModalOpen(false); setMobileView('products'); searchRef.current?.focus(); }}>Nova Venda</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Fallback Modal (desktop browsers without navigator.share) */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">Compartilhar {lastSaleData?.isOrcamento ? 'Orçamento' : 'Comprovante'}</DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground -mt-1">
            Escolha como deseja enviar o {lastSaleData?.isOrcamento ? 'orçamento' : 'comprovante'}
          </p>

          <div className="flex flex-col gap-3 mt-2">
            {/* WhatsApp (download PDF + open chat) */}
            {lastSaleData?.customerPhone && (
              <Button
                onClick={handleFallbackWhatsApp}
                disabled={sharePdfLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base gap-3"
              >
                {sharePdfLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                Enviar via WhatsApp
              </Button>
            )}

            {/* Download PDF */}
            {lastSaleData?.saleId && (
              <Button
                variant="outline"
                onClick={() => { handleDownloadPDF(lastSaleData.saleId); setShareModalOpen(false); }}
                disabled={pdfLoading}
                className="w-full h-12 text-base gap-3"
              >
                <Download className="w-5 h-5" /> Baixar PDF
              </Button>
            )}

            {/* Copy message */}
            <Button variant="outline" onClick={handleCopyMessage} className="w-full h-10 gap-2">
              <Copy className="w-4 h-4" /> Copiar Mensagem
            </Button>
          </div>

          <p className="text-[11px] text-center text-muted-foreground mt-2 leading-tight">
            📱 Em dispositivos móveis, o compartilhamento nativo permite escolher WhatsApp, Telegram, E-mail e outros apps.
          </p>
        </DialogContent>
      </Dialog>

      {/* Quick Customer Creation Dialog */}
      <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserCircle className="w-5 h-5 text-blue-500" /> Cadastro Rápido de Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={quickCustomerForm.name} onChange={(e) => setQuickCustomerForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do cliente" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input value={quickCustomerForm.phone} onChange={(e) => setQuickCustomerForm(f => ({ ...f, phone: e.target.value }))} placeholder="(99) 99999-9999" />
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input value={quickCustomerForm.city} onChange={(e) => setQuickCustomerForm(f => ({ ...f, city: e.target.value }))} placeholder="Cidade" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={quickCustomerForm.type} onValueChange={(v) => setQuickCustomerForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="varejo">Varejo</SelectItem>
                  <SelectItem value="atacado">Atacado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQuickCustomerOpen(false)}>Cancelar</Button>
            <Button size="sm" disabled={quickCustomerSaving || !quickCustomerForm.name.trim()} onClick={async () => {
              setQuickCustomerSaving(true);
              try {
                const res = await fetch('/api/clientes', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: quickCustomerForm.name.trim(),
                    phone: quickCustomerForm.phone || undefined,
                    whatsapp: quickCustomerForm.phone || undefined,
                    city: quickCustomerForm.city || undefined,
                    type: quickCustomerForm.type,
                  }),
                });
                if (!res.ok) throw new Error();
                const newCustomer = await res.json();
                // Add to customers list and auto-select
                setCustomers(prev => [{ id: newCustomer.id, name: newCustomer.name, type: newCustomer.type, phone: newCustomer.phone, whatsapp: newCustomer.whatsapp }, ...prev]);
                setSelectedCustomer(newCustomer.id);
                setCustomerSearch('');
                setQuickCustomerOpen(false);
                toast.success(`Cliente "${newCustomer.name}" cadastrado e selecionado!`);
              } catch { toast.error('Erro ao cadastrar cliente'); }
              setQuickCustomerSaving(false);
            }}>
              {quickCustomerSaving ? 'Salvando...' : 'Cadastrar e Selecionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
