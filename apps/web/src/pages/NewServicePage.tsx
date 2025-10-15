import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/apiClient';
import type {
  Animal,
  Product,
  Service,
  ServiceDefinition,
  ServiceResponsible,
} from '../types/api';

interface ServiceItemFormValue {
  productId: string;
  quantidade: string;
  precoUnitario: string;
}

interface CatalogItemFormValue {
  serviceDefinitionId: string;
  quantidade: string;
  precoUnitario: string;
  observacoes?: string;
}

interface ServiceFormValues {
  animalId: string;
  tipo: Service['tipo'];
  data: string;
  observacoes?: string;
  responsavelId: string;
  catalogItems: CatalogItemFormValue[];
  items: ServiceItemFormValue[];
}

const serviceLabels: Record<Service['tipo'], string> = {
  CONSULTA: 'Consulta',
  EXAME: 'Exame',
  VACINACAO: 'Vacinação',
  CIRURGIA: 'Cirurgia',
  OUTROS: 'Outros cuidados',
};

type ServiceItemPayload = {
  productId: string;
  quantidade: number;
  precoUnitario: number;
};

type ServiceCatalogItemPayload = {
  serviceDefinitionId: string;
  quantidade: number;
  precoUnitario: number;
  observacoes?: string;
};

type CreateServicePayload = {
  animalId: string;
  tipo: Service['tipo'];
  data: string;
  preco?: number;
  observacoes?: string;
  responsavelId?: string;
  catalogItems: ServiceCatalogItemPayload[];
  items: ServiceItemPayload[];
};

const NewServicePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { register, handleSubmit, watch, reset, setValue, control } = useForm<ServiceFormValues>({
    defaultValues: {
      animalId: '',
      tipo: 'CONSULTA',
      data: '',
      observacoes: '',
      responsavelId: '',
      catalogItems: [],
      items: [],
    },
  });

  const items = watch('items');
  const catalogItems = watch('catalogItems');
  const animalId = watch('animalId');
  const responsavelId = watch('responsavelId');

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const {
    fields: catalogFields,
    append: appendCatalogItem,
    remove: removeCatalogItem,
  } = useFieldArray({
    control,
    name: 'catalogItems',
  });

  const { data: animals } = useQuery({
    queryKey: ['animals'],
    queryFn: () => apiClient.get<Animal[]>('/animals'),
  });

  const { data: serviceDefinitions } = useQuery({
    queryKey: ['service-definitions'],
    queryFn: () =>
      apiClient
        .get<{ definitions: ServiceDefinition[] }>('/services/catalog')
        .then((response) => response.definitions),
  });

  const { data: responsibles } = useQuery({
    queryKey: ['service-responsibles'],
    queryFn: () =>
      apiClient
        .get<{ responsibles: ServiceResponsible[] }>('/services/responsibles')
        .then((response) => response.responsibles),
  });

  const selectedAnimal = useMemo(
    () => animals?.find((animal) => animal.id === animalId) ?? null,
    [animalId, animals],
  );

  const availableDefinitions = useMemo(
    () => serviceDefinitions ?? [],
    [serviceDefinitions],
  );

  const availableResponsibles = useMemo(
    () => responsibles ?? [],
    [responsibles],
  );

  useEffect(() => {
    if (user?.id && !responsavelId) {
      setValue('responsavelId', user.id);
    }
  }, [responsavelId, setValue, user?.id]);

  const tutorHelperText = selectedAnimal
    ? selectedAnimal.owner?.nome
      ? 'Tutor definido automaticamente a partir do pet selecionado.'
      : 'Pet selecionado está sem tutor vinculado.'
    : 'Selecione um pet para visualizar o tutor responsável.';

  const petWithoutTutor = Boolean(selectedAnimal && !selectedAnimal.owner?.id);

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiClient.get<Product[]>('/products'),
  });

  const availableProducts = useMemo(
    () => (products ?? []).filter((product) => product.isActive && product.isSellable),
    [products],
  );

  const duplicateProductIds = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const item of items ?? []) {
      if (!item?.productId) continue;
      if (seen.has(item.productId)) {
        duplicates.add(item.productId);
      } else {
        seen.add(item.productId);
      }
    }

    return duplicates;
  }, [items]);

  const duplicateCatalogDefinitionIds = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const item of catalogItems ?? []) {
      const definitionId = item?.serviceDefinitionId;
      if (!definitionId) continue;
      if (seen.has(definitionId)) {
        duplicates.add(definitionId);
      } else {
        seen.add(definitionId);
      }
    }

    return duplicates;
  }, [catalogItems]);

  const catalogItemDetails = useMemo(() => {
    return (catalogItems ?? []).map((item) => {
      const definition = availableDefinitions.find(
        (candidate) => candidate.id === item?.serviceDefinitionId,
      );
      const quantityValue = Number(item?.quantidade);
      const quantity = Number.isInteger(quantityValue) && quantityValue > 0 ? quantityValue : 0;
      const unitPriceRaw = typeof item?.precoUnitario === 'string' ? item.precoUnitario : '';
      const unitPriceValue = Number(unitPriceRaw.replace(',', '.'));
      const unitPrice = Number.isFinite(unitPriceValue) && unitPriceValue >= 0
        ? unitPriceValue
        : definition?.precoSugerido ?? 0;
      const subtotal = quantity * unitPrice;

      return {
        definition,
        quantity,
        unitPrice,
        subtotal: Number.isFinite(subtotal) ? subtotal : 0,
        observacoes: item?.observacoes?.trim() ?? '',
      };
    });
  }, [availableDefinitions, catalogItems]);

  const itemDetails = useMemo(() => {
    return (items ?? []).map((item) => {
      const product = availableProducts.find((candidate) => candidate.id === item.productId);
      const quantity = Number(item.quantidade);
      const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
      const unitPriceRaw = typeof item.precoUnitario === 'string' ? item.precoUnitario : String(item.precoUnitario ?? '');
      const unitPriceValue = Number(unitPriceRaw.replace(',', '.'));
      const unitPrice = Number.isFinite(unitPriceValue) && unitPriceValue >= 0 ? unitPriceValue : 0;
      const subtotal = normalizedQuantity * unitPrice;
      const remainingStock = product ? product.estoqueAtual - normalizedQuantity : undefined;
      const hasInsufficient = Boolean(product && normalizedQuantity > product.estoqueAtual);
      const isLowStock = Boolean(
        product && !hasInsufficient && remainingStock !== undefined && remainingStock <= product.estoqueMinimo,
      );

      return {
        product,
        quantity: normalizedQuantity,
        unitPrice,
        subtotal: Number.isFinite(subtotal) ? subtotal : 0,
        remainingStock,
        hasInsufficient,
        isLowStock,
      };
    });
  }, [availableProducts, items]);

  const insufficientStock = itemDetails.some((detail) => detail.hasInsufficient);
  const hasDuplicateItems = duplicateProductIds.size > 0;
  const hasDuplicateCatalogItems = duplicateCatalogDefinitionIds.size > 0;
  const servicesTotal = catalogItemDetails.reduce((sum, detail) => sum + detail.subtotal, 0);
  const productsTotal = itemDetails.reduce((sum, detail) => sum + detail.subtotal, 0);
  const overallTotal = servicesTotal + productsTotal;

  useEffect(() => {
    (items ?? []).forEach((item, index) => {
      if (!item?.productId) return;
      if (item.precoUnitario) return;

      const product = availableProducts.find((candidate) => candidate.id === item.productId);
      if (product) {
        setValue(`items.${index}.precoUnitario`, product.precoVenda.toFixed(2));
      }
    });
  }, [availableProducts, items, setValue]);

  useEffect(() => {
    (catalogItems ?? []).forEach((item, index) => {
      if (!item?.serviceDefinitionId) return;
      if (item.precoUnitario) return;

      const definition = availableDefinitions.find(
        (candidate) => candidate.id === item.serviceDefinitionId,
      );
      if (definition) {
        setValue(`catalogItems.${index}.precoUnitario`, definition.precoSugerido.toFixed(2));
      }
    });
  }, [availableDefinitions, catalogItems, setValue]);

  const createService = useMutation({
    mutationFn: (payload: CreateServicePayload) => apiClient.post<Service>('/services', payload),
    onSuccess: (service) => {
      toast.success('Atendimento registrado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      reset({
        animalId: '',
        tipo: 'CONSULTA',
        data: '',
        observacoes: '',
        responsavelId: user?.id ?? '',
        catalogItems: [],
        items: [],
      });
      navigate(`/animals`, { state: { highlight: service.animalId } });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o atendimento.');
    },
  });

  const disableSubmit =
    createService.isPending ||
    insufficientStock ||
    hasDuplicateItems ||
    hasDuplicateCatalogItems ||
    petWithoutTutor;

  const onSubmit = handleSubmit(({ items: formItems, catalogItems: formCatalogItems, ...values }) => {
    if (!values.animalId) {
      toast.error('Selecione um pet para registrar o atendimento.');
      return;
    }

    if (!selectedAnimal?.owner?.id) {
      toast.error('Pet selecionado precisa estar vinculado a um tutor.');
      return;
    }

    if (!values.responsavelId) {
      toast.error('Selecione um responsável pelo atendimento.');
      return;
    }

    const sanitizedCatalogItems: ServiceCatalogItemPayload[] = [];

    for (const item of formCatalogItems ?? []) {
      if (!item.serviceDefinitionId) {
        toast.error('Selecione um serviço do catálogo para cada item adicionado.');
        return;
      }

      const definition = availableDefinitions.find((candidate) => candidate.id === item.serviceDefinitionId);
      if (!definition) {
        toast.error('Serviço selecionado não está disponível.');
        return;
      }

      const quantity = Number(item.quantidade);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        toast.error('Informe uma quantidade válida para cada serviço.');
        return;
      }

      const unitPriceValue = Number(String(item.precoUnitario ?? '').replace(',', '.'));
      const resolvedUnitPrice = Number.isFinite(unitPriceValue) && unitPriceValue >= 0
        ? Number(unitPriceValue.toFixed(2))
        : Number(definition.precoSugerido.toFixed(2));

      sanitizedCatalogItems.push({
        serviceDefinitionId: item.serviceDefinitionId,
        quantidade: quantity,
        precoUnitario: resolvedUnitPrice,
        observacoes: item.observacoes?.trim() ? item.observacoes.trim() : undefined,
      });
    }

    const catalogDefinitionIds = sanitizedCatalogItems.map((item) => item.serviceDefinitionId);
    if (new Set(catalogDefinitionIds).size !== catalogDefinitionIds.length) {
      toast.error('Há serviços do catálogo repetidos na lista. Ajuste antes de continuar.');
      return;
    }

    const sanitizedItems: ServiceItemPayload[] = [];

    for (const item of formItems ?? []) {
      if (!item.productId) {
        toast.error('Selecione um produto para cada item adicionado.');
        return;
      }

      const product = availableProducts.find((candidate) => candidate.id === item.productId);
      if (!product) {
        toast.error('Produto selecionado não está disponível.');
        return;
      }

      const quantity = Number(item.quantidade);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        toast.error('Informe uma quantidade válida para cada produto.');
        return;
      }

      const unitPriceValue = Number(String(item.precoUnitario ?? '').replace(',', '.'));
      if (Number.isNaN(unitPriceValue) || unitPriceValue < 0) {
        toast.error('Informe um preço unitário válido para os itens.');
        return;
      }

      if (quantity > product.estoqueAtual) {
        toast.error(`Estoque insuficiente para ${product.nome}. Disponível: ${product.estoqueAtual}.`);
        return;
      }

      sanitizedItems.push({
        productId: item.productId,
        quantidade: quantity,
        precoUnitario: Number(unitPriceValue.toFixed(2)),
      });
    }

    const productIds = sanitizedItems.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      toast.error('Há produtos repetidos na lista de itens. Ajuste antes de continuar.');
      return;
    }

    const servicesTotalValue = sanitizedCatalogItems.reduce(
      (sum, item) => sum + item.precoUnitario * item.quantidade,
      0,
    );

    const payload: CreateServicePayload = {
      animalId: values.animalId,
      tipo: values.tipo,
      data: values.data,
      preco: Number(servicesTotalValue.toFixed(2)),
      observacoes: values.observacoes?.trim() ? values.observacoes : undefined,
      responsavelId: values.responsavelId,
      catalogItems: sanitizedCatalogItems,
      items: sanitizedItems,
    };

    createService.mutate(payload);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Registrar atendimento</h1>
          <p className="text-sm text-brand-grafite/70">
            Combine serviços do catálogo e produtos utilizados para gerar um atendimento completo.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link to="/services">Voltar para atendimentos</Link>
        </Button>
      </div>

      <Card title="Dados do atendimento" description="Preencha com atenção para manter o histórico impecável.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <SelectField label="Pet" required {...register('animalId')}>
            <option value="">Selecione um pet</option>
            {animals?.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.nome} — Tutor(a): {animal.owner?.nome ?? '—'}
              </option>
            ))}
          </SelectField>

          <Field
            label="Tutor"
            value={selectedAnimal ? selectedAnimal.owner?.nome ?? '—' : ''}
            placeholder="Selecione um pet"
            readOnly
            helperText={tutorHelperText}
            error={petWithoutTutor ? 'Vincule um tutor ao pet antes de registrar o serviço.' : undefined}
          />

          <SelectField label="Tipo de serviço" required {...register('tipo')}>
            {Object.entries(serviceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <Field label="Data" type="date" required {...register('data')} />

          <SelectField
            label="Responsável pelo atendimento"
            required
            {...register('responsavelId')}
          >
            <option value="">Selecione um responsável</option>
            {availableResponsibles.map((responsible) => (
              <option key={responsible.id} value={responsible.id}>
                {responsible.nome} — {responsible.email}
              </option>
            ))}
          </SelectField>

          <div className="md:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold text-brand-escuro">Serviços do catálogo</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  appendCatalogItem({
                    serviceDefinitionId: '',
                    quantidade: '1',
                    precoUnitario: '',
                    observacoes: '',
                  })
                }
                disabled={!availableDefinitions.length}
              >
                Adicionar serviço
              </Button>
            </div>

            {!catalogFields.length ? (
              <p className="text-sm text-brand-grafite/70">
                Selecione um ou mais serviços do catálogo para registrar o que foi realizado no atendimento.
              </p>
            ) : null}

            <div className="space-y-4">
              {catalogFields.map((field, index) => {
                const detail =
                  catalogItemDetails[index] ?? {
                    definition: undefined,
                    quantity: 0,
                    unitPrice: 0,
                    subtotal: 0,
                    observacoes: '',
                  };
                const definition = detail.definition;
                const currentDefinitionId = catalogItems?.[index]?.serviceDefinitionId ?? '';

                return (
                  <div key={field.id} className="space-y-3 rounded-2xl border border-brand-azul/40 bg-white/80 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <SelectField
                        label="Serviço"
                        required
                        helperText={definition?.descricao ?? 'Selecione um serviço do catálogo'}
                        {...register(`catalogItems.${index}.serviceDefinitionId` as const)}
                      >
                        <option value="">Selecione um serviço</option>
                        {availableDefinitions.map((serviceDefinition) => (
                          <option key={serviceDefinition.id} value={serviceDefinition.id}>
                            {serviceDefinition.nome}
                          </option>
                        ))}
                      </SelectField>
                      <Field
                        label="Quantidade"
                        type="number"
                        min="1"
                        step="1"
                        required
                        {...register(`catalogItems.${index}.quantidade` as const)}
                      />
                      <Field
                        label="Preço sugerido (R$)"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        {...register(`catalogItems.${index}.precoUnitario` as const)}
                      />
                    </div>
                    <label className="block text-sm text-brand-escuro">
                      Observações
                      <textarea
                        {...register(`catalogItems.${index}.observacoes` as const)}
                        className="mt-1 w-full rounded-xl border border-brand-azul/40 bg-white/90 px-4 py-2 text-sm text-brand-grafite focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/40"
                        rows={2}
                        placeholder="Detalhes relevantes sobre este serviço"
                      />
                    </label>
                    {duplicateCatalogDefinitionIds.has(currentDefinitionId) ? (
                      <p className="text-sm text-red-500">Este serviço já foi selecionado em outro item.</p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-brand-grafite/80">
                      <span>Subtotal: R$ {detail.subtotal.toFixed(2)}</span>
                      <Button type="button" variant="ghost" onClick={() => removeCatalogItem(index)}>
                        Remover
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {catalogItemDetails.length > 0 ? (
              <div className="rounded-2xl border border-brand-azul/30 bg-white/70 p-4">
                <h3 className="font-semibold text-brand-escuro">Resumo dos serviços</h3>
                <ul className="mt-2 space-y-2 text-sm text-brand-grafite/80">
                  {catalogItemDetails.map((detail, index) => {
                    const definition = detail.definition;
                    if (!definition) {
                      return (
                        <li key={`service-summary-placeholder-${catalogFields[index]?.id ?? index}`}>
                          Selecione um serviço para o item {index + 1}.
                        </li>
                      );
                    }

                    return (
                      <li key={`service-summary-${definition.id}-${index}`} className="flex flex-col gap-1">
                        <span>
                          {definition.nome}: {detail.quantity} un × R$ {detail.unitPrice.toFixed(2)} = R$ {detail.subtotal.toFixed(2)}
                        </span>
                        {detail.observacoes ? (
                          <span className="text-brand-grafite/60">Observações: {detail.observacoes}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-sm font-semibold text-brand-escuro">
                  Total de serviços: R$ {servicesTotal.toFixed(2)}
                </p>
              </div>
            ) : null}

            {hasDuplicateCatalogItems ? (
              <p className="text-sm text-red-500">Há serviços do catálogo repetidos. Remova duplicidades para continuar.</p>
            ) : null}
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold text-brand-escuro">Produtos utilizados</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => append({ productId: '', quantidade: '1', precoUnitario: '' })}
                disabled={!availableProducts.length}
              >
                Adicionar produto
              </Button>
            </div>

            {!fields.length ? (
              <p className="text-sm text-brand-grafite/70">
                Registre os insumos aplicados durante o atendimento para manter o estoque sempre atualizado.
              </p>
            ) : null}

            <div className="space-y-4">
              {fields.map((field, index) => {
                const detail =
                  itemDetails[index] ?? {
                    product: undefined,
                    quantity: 0,
                    unitPrice: 0,
                    subtotal: 0,
                    remainingStock: undefined,
                    hasInsufficient: false,
                    isLowStock: false,
                  };
                const product = detail.product;
                const stockHelper = product
                  ? `Disponível: ${product.estoqueAtual} • Mínimo: ${product.estoqueMinimo}`
                  : 'Selecione um produto';
                const currentProductId = items?.[index]?.productId ?? '';

                return (
                  <div key={field.id} className="space-y-3 rounded-2xl border border-brand-azul/40 bg-white/80 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <SelectField
                        label="Produto"
                        required
                        helperText={stockHelper}
                        {...register(`items.${index}.productId` as const)}
                      >
                        <option value="">Selecione um produto</option>
                        {availableProducts.map((productOption) => (
                          <option key={productOption.id} value={productOption.id}>
                            {productOption.nome}
                          </option>
                        ))}
                      </SelectField>
                      <Field
                        label="Quantidade"
                        type="number"
                        min="1"
                        step="1"
                        required
                        {...register(`items.${index}.quantidade` as const)}
                      />
                      <Field
                        label="Preço unitário (R$)"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        {...register(`items.${index}.precoUnitario` as const)}
                      />
                    </div>
                    {product ? (
                      <p
                        className={
                          detail.hasInsufficient
                            ? 'text-sm text-red-500'
                            : detail.isLowStock
                              ? 'text-sm text-amber-600'
                              : 'text-sm text-brand-grafite/70'
                        }
                      >
                        {detail.hasInsufficient
                          ? `Estoque insuficiente. Restam apenas ${product.estoqueAtual} unidades.`
                          : `Estoque após uso: ${detail.remainingStock ?? product.estoqueAtual} unidades.`}
                      </p>
                    ) : null}
                    {duplicateProductIds.has(currentProductId) ? (
                      <p className="text-sm text-red-500">Este produto já foi selecionado em outro item.</p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-brand-grafite/80">
                      <span>Subtotal: R$ {detail.subtotal.toFixed(2)}</span>
                      <Button type="button" variant="ghost" onClick={() => remove(index)}>
                        Remover
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {itemDetails.length > 0 ? (
              <div className="rounded-2xl border border-brand-azul/30 bg-white/70 p-4">
                <h3 className="font-semibold text-brand-escuro">Resumo dos produtos</h3>
                <ul className="mt-2 space-y-2 text-sm text-brand-grafite/80">
                  {itemDetails.map((detail, index) => {
                    const product = detail.product;
                    if (!product) {
                      return (
                        <li key={`product-summary-placeholder-${fields[index]?.id ?? index}`}>
                          Selecione um produto para o item {index + 1}.
                        </li>
                      );
                    }

                    return (
                      <li key={`product-summary-${product.id}-${index}`} className="flex flex-col gap-1">
                        <span>
                          {product.nome}: {detail.quantity} un × R$ {detail.unitPrice.toFixed(2)} = R$ {detail.subtotal.toFixed(2)}
                        </span>
                        {detail.hasInsufficient ? (
                          <span className="text-red-500">Estoque insuficiente. Disponível: {product.estoqueAtual}.</span>
                        ) : detail.isLowStock ? (
                          <span className="text-amber-600">Atenção: estoque baixo após o uso ({detail.remainingStock} unidades).</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-sm font-semibold text-brand-escuro">
                  Total dos produtos: R$ {productsTotal.toFixed(2)}
                </p>
              </div>
            ) : null}

            {insufficientStock ? (
              <p className="text-sm text-red-500">Ajuste as quantidades: há produtos sem estoque suficiente.</p>
            ) : null}
            {hasDuplicateItems ? (
              <p className="text-sm text-red-500">Há produtos repetidos na lista. Remova duplicidades para continuar.</p>
            ) : null}
          </div>

          <label className="md:col-span-2">
            <span className="font-semibold text-brand-escuro">Observações</span>
            <textarea
              {...register('observacoes')}
              className="mt-1 w-full rounded-xl border border-brand-azul/60 bg-white/90 px-4 py-3 text-sm text-brand-grafite focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/50"
              rows={4}
              placeholder="Detalhes que ajudam a equipe a manter o cuidado alinhado."
            />
          </label>

          <div className="md:col-span-2 rounded-2xl border border-brand-azul/30 bg-white/70 p-4 text-sm text-brand-grafite/80">
            <h3 className="font-semibold text-brand-escuro">Totais do atendimento</h3>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span>Serviços: R$ {servicesTotal.toFixed(2)}</span>
              <span>Produtos: R$ {productsTotal.toFixed(2)}</span>
              <span className="font-semibold text-brand-escuro">Total geral: R$ {overallTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                reset({
                  animalId: '',
                  tipo: 'CONSULTA',
                  data: '',
                  observacoes: '',
                  responsavelId: user?.id ?? '',
                  catalogItems: [],
                  items: [],
                })
              }
            >
              Limpar
            </Button>
            <Button type="submit" disabled={disableSubmit}>
              {createService.isPending ? 'Registrando...' : 'Registrar atendimento'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default NewServicePage;
