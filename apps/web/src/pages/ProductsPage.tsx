import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import Modal from '../components/Modal';
import SelectField from '../components/SelectField';
import { useAuth } from '../contexts/AuthContext';
import {
  type AdjustProductStockPayload,
  type CreateProductPayload,
  productsApi,
} from '../lib/apiClient';
import type { Product } from '../types/api';
import { createXlsxBlob, downloadBlob } from '../utils/xlsxExport';

interface ProductFormValues {
  nome: string;
  descricao: string;
  custo: number;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  isActive: 'true' | 'false';
  isSellable: 'true' | 'false';
}

interface FiltersState {
  search: string;
  status: 'all' | 'active' | 'inactive';
  sellable: 'all' | 'sellable' | 'unsellable';
}

interface StockFormValues {
  amount: number;
}

const defaultProductValues: ProductFormValues = {
  nome: '',
  descricao: '',
  custo: 0,
  precoVenda: 0,
  estoqueAtual: 0,
  estoqueMinimo: 0,
  isActive: 'true',
  isSellable: 'true',
};

const exportHeaders = ['Nome', 'Preço de venda', 'Estoque atual', 'Status', 'Disponibilidade'] as const;
type ExportHeader = (typeof exportHeaders)[number];

const ProductsPage = () => {
  const { hasModule } = useAuth();
  const canManageProducts = hasModule('products:manage');
  const queryClient = useQueryClient();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState<FiltersState>({
    search: '',
    status: 'all',
    sellable: 'all',
  });

  const {
    data: products,
    isLoading,
    error,
  } = useQuery<Product[], Error>({
    queryKey: ['products'],
    queryFn: productsApi.list,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting: isSubmittingForm },
  } = useForm<ProductFormValues>({
    defaultValues: defaultProductValues,
  });

  const {
    register: registerStock,
    handleSubmit: handleSubmitStock,
    reset: resetStock,
    formState: { isSubmitting: isSubmittingStock },
  } = useForm<StockFormValues>({
    defaultValues: { amount: 0 },
  });

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setEditingProduct(null);
    reset({ ...defaultProductValues });
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    reset({ ...defaultProductValues });
    setIsFormModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    reset({
      nome: product.nome,
      descricao: product.descricao ?? '',
      custo: product.custo,
      precoVenda: product.precoVenda,
      estoqueAtual: product.estoqueAtual,
      estoqueMinimo: product.estoqueMinimo,
      isActive: product.isActive ? 'true' : 'false',
      isSellable: product.isSellable ? 'true' : 'false',
    });
    setIsFormModalOpen(true);
  };

  const closeStockModal = () => {
    setIsStockModalOpen(false);
    setStockProduct(null);
    resetStock({ amount: 0 });
  };

  const openStockModal = (product: Product) => {
    setStockProduct(product);
    resetStock({ amount: 0 });
    setIsStockModalOpen(true);
  };

  const createProduct = useMutation({
    mutationFn: (payload: CreateProductPayload) => productsApi.create(payload),
    onSuccess: () => {
      toast.success('Produto cadastrado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeFormModal();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cadastrar o produto.');
    },
  });

  const updateProduct = useMutation({
    mutationFn: ({ id, ...payload }: CreateProductPayload & { id: string }) =>
      productsApi.update(id, payload),
    onSuccess: () => {
      toast.success('Produto atualizado.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeFormModal();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o produto.');
    },
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      toast.success('Produto removido do catálogo.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover o produto.');
    },
  });

  const adjustStock = useMutation({
    mutationFn: ({ id, amount }: AdjustProductStockPayload & { id: string }) =>
      productsApi.adjustStock(id, { amount }),
    onSuccess: () => {
      toast.success('Estoque ajustado com carinho.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeStockModal();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível ajustar o estoque.');
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (
      [values.custo, values.precoVenda, values.estoqueAtual, values.estoqueMinimo].some((value) =>
        Number.isNaN(value),
      )
    ) {
      toast.error('Preencha valores numéricos válidos.');
      return;
    }

    const payload: CreateProductPayload = {
      nome: values.nome.trim(),
      descricao: values.descricao.trim().length > 0 ? values.descricao : null,
      custo: values.custo,
      precoVenda: values.precoVenda,
      estoqueAtual: values.estoqueAtual,
      estoqueMinimo: values.estoqueMinimo,
      isActive: values.isActive === 'true',
      isSellable: values.isSellable === 'true',
    };

    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, ...payload });
    } else {
      createProduct.mutate(payload);
    }
  });

  const onSubmitStock = handleSubmitStock((values) => {
    if (!stockProduct) {
      return;
    }

    if (Number.isNaN(values.amount)) {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    adjustStock.mutate({ id: stockProduct.id, amount: values.amount });
  });

  const sortedProducts = useMemo(() => {
    return (products ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return sortedProducts.filter((product) => {
      const matchesSearch = normalizedSearch ? product.nome.toLowerCase().includes(normalizedSearch) : true;
      const matchesStatus =
        filters.status === 'all'
          ? true
          : filters.status === 'active'
            ? product.isActive
            : !product.isActive;
      const matchesSellable =
        filters.sellable === 'all'
          ? true
          : filters.sellable === 'sellable'
            ? product.isSellable
            : !product.isSellable;

      return matchesSearch && matchesStatus && matchesSellable;
    });
  }, [filters, sortedProducts]);

  const handleFiltersReset = () => {
    setFilters({ search: '', status: 'all', sellable: 'all' });
  };

  const buildExportRows = (): Record<ExportHeader, string | number>[] =>
    filteredProducts.map((product) => ({
      Nome: product.nome,
      'Preço de venda': product.precoVenda.toFixed(2),
      'Estoque atual': product.estoqueAtual,
      Status: product.isActive ? 'Ativo' : 'Inativo',
      Disponibilidade: product.isSellable ? 'Disponível para venda' : 'Indisponível para venda',
    }));

  const handleExportXlsx = () => {
    if (!filteredProducts.length) {
      toast.error('Nenhum produto encontrado para exportação.');
      return;
    }

    const rows = buildExportRows().map((row) => exportHeaders.map((header) => row[header]));
    const blob = createXlsxBlob({
      sheetName: 'Produtos',
      headers: exportHeaders,
      rows,
    });

    downloadBlob(blob, `auravet-produtos-${Date.now()}.xlsx`);
    toast.success('Planilha de produtos pronta para download.');
  };

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const isSavingProduct = createProduct.isPending || updateProduct.isPending;
  const isAdjustingStock = adjustStock.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Produtos</h1>
          <p className="text-sm text-brand-grafite/70">
            Gerencie o catálogo de produtos, acompanhe custos e garanta que o estoque esteja sempre saudável.
          </p>
        </div>
        {canManageProducts ? <Button onClick={openCreateModal}>Novo produto</Button> : null}
      </div>

      <Card
        title="Filtros do catálogo"
        description="Busque produtos por nome, status e disponibilidade."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={handleExportXlsx} disabled={isLoading}>
              Exportar para Excel
            </Button>
            <Button variant="ghost" onClick={handleFiltersReset} disabled={isLoading}>
              Limpar filtros
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-4">
          <Field
            label="Buscar por nome"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Digite parte do nome"
            className="md:col-span-2"
          />
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as FiltersState['status'] }))}
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </SelectField>
          <SelectField
            label="Disponibilidade"
            value={filters.sellable}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, sellable: event.target.value as FiltersState['sellable'] }))
            }
          >
            <option value="all">Todas</option>
            <option value="sellable">Disponível para venda</option>
            <option value="unsellable">Indisponível para venda</option>
          </SelectField>
        </div>
      </Card>

      <Card
        title="Controle de prateleira"
        description="Consulte valores, estoque mínimo e status para decisões rápidas e cuidadosas."
        actions={
          !isLoading && products?.length ? (
            <p className="text-sm text-brand-grafite/70">
              Exibindo {filteredProducts.length} de {products.length} produtos
            </p>
          ) : null
        }
      >
        {isLoading ? <p>Carregando produtos...</p> : null}
        {error ? <p className="text-red-500">Não foi possível carregar os produtos.</p> : null}
        {filteredProducts.length ? (
          <ul className="space-y-3">
            {filteredProducts.map((product) => (
              <li
                key={product.id}
                className="flex flex-col gap-3 rounded-2xl border border-brand-azul/30 bg-white/80 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-montserrat text-lg font-semibold text-brand-escuro">{product.nome}</p>
                  {product.descricao ? (
                    <p className="text-sm text-brand-grafite/70">{product.descricao}</p>
                  ) : null}
                  <p className="text-sm text-brand-grafite/70">
                    Custo: {currencyFormatter.format(product.custo)} • Preço de venda{' '}
                    {currencyFormatter.format(product.precoVenda)}
                  </p>
                  <p className="text-sm text-brand-grafite/70">
                    Estoque atual: {product.estoqueAtual} unidades • Mínimo recomendado: {product.estoqueMinimo}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-brand-grafite/70">
                    <span
                      className={`rounded-full px-3 py-1 font-semibold ${
                        product.isActive ? 'bg-brand-savia/50 text-brand-escuro' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {product.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 font-semibold ${
                        product.isSellable ? 'bg-brand-azul/30 text-brand-escuro' : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {product.isSellable ? 'Disponível para venda' : 'Indisponível para venda'}
                    </span>
                  </div>
                </div>
                {canManageProducts ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => openEditModal(product)}>
                      Editar
                    </Button>
                    <Button variant="ghost" onClick={() => openStockModal(product)}>
                      Ajustar estoque
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:bg-red-100"
                      onClick={() => deleteProduct.mutate(product.id)}
                    >
                      Remover
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {!isLoading && !!products?.length && !filteredProducts.length ? (
          <p className="text-sm text-brand-grafite/70">Nenhum produto encontrado com os filtros selecionados.</p>
        ) : null}
        {!isLoading && !products?.length ? (
          <p className="text-sm text-brand-grafite/70">
            Nenhum produto cadastrado ainda. Registre itens para controlar estoque e potencializar a jornada de cuidado.
          </p>
        ) : null}
      </Card>

      {canManageProducts ? (
        <Modal
          open={isFormModalOpen}
          onClose={closeFormModal}
          title={editingProduct ? 'Editar produto' : 'Novo produto'}
          description="Preencha os dados financeiros e de estoque para manter o cuidado completo em cada detalhe."
          actions={
            <>
              <Button variant="ghost" onClick={closeFormModal}>
                Cancelar
              </Button>
              <Button type="submit" form="product-form" disabled={isSavingProduct || isSubmittingForm}>
                {editingProduct ? 'Salvar alterações' : 'Cadastrar'}
              </Button>
            </>
          }
        >
          <form id="product-form" className="space-y-4" onSubmit={onSubmit}>
            <Field label="Nome" placeholder="Nome do produto" required {...register('nome')} />
            <Field label="Descrição" placeholder="Descrição opcional" {...register('descricao')} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Custo"
                type="number"
                step="0.01"
                min={0}
                required
                {...register('custo', { valueAsNumber: true })}
              />
              <Field
                label="Preço de venda"
                type="number"
                step="0.01"
                min={0}
                required
                {...register('precoVenda', { valueAsNumber: true })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Estoque atual"
                type="number"
                step="1"
                min={0}
                required
                {...register('estoqueAtual', { valueAsNumber: true })}
              />
              <Field
                label="Estoque mínimo"
                type="number"
                step="1"
                min={0}
                required
                {...register('estoqueMinimo', { valueAsNumber: true })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Status" {...register('isActive')}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </SelectField>
              <SelectField label="Disponibilidade" {...register('isSellable')}>
                <option value="true">Disponível para venda</option>
                <option value="false">Indisponível para venda</option>
              </SelectField>
            </div>
          </form>
        </Modal>
      ) : null}

      {canManageProducts && stockProduct ? (
        <Modal
          open={isStockModalOpen}
          onClose={closeStockModal}
          title={`Ajustar estoque • ${stockProduct.nome}`}
          description="Utilize valores positivos para entradas e negativos para baixas."
          actions={
            <>
              <Button variant="ghost" onClick={closeStockModal}>
                Cancelar
              </Button>
              <Button type="submit" form="stock-form" disabled={isAdjustingStock || isSubmittingStock}>
                Confirmar ajuste
              </Button>
            </>
          }
        >
          <form id="stock-form" className="space-y-4" onSubmit={onSubmitStock}>
            <Field
              label="Quantidade"
              type="number"
              step="1"
              {...registerStock('amount', { valueAsNumber: true })}
              helperText="Exemplo: 5 para entrada, -2 para baixa."
            />
          </form>
        </Modal>
      ) : null}
    </div>
  );
};

export default ProductsPage;
