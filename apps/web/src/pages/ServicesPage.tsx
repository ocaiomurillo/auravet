import { useQuery } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/apiClient';
import type { Animal, OwnerSummary, Service } from '../types/api';
import { buildOwnerAddress, formatCpf } from '../utils/owner';

interface ServiceFilters {
  ownerId: string;
  animalId: string;
  from: string;
  to: string;
}

const serviceLabels: Record<Service['tipo'], string> = {
  CONSULTA: 'Consulta',
  EXAME: 'Exame',
  VACINACAO: 'Vacinação',
  CIRURGIA: 'Cirurgia',
  OUTROS: 'Outros cuidados',
};

const ServicesPage = () => {
  const [filters, setFilters] = useState<ServiceFilters>({ ownerId: '', animalId: '', from: '', to: '' });
  const { hasModule } = useAuth();
  const canRegisterService = hasModule('services:write');

  const { data: owners } = useQuery({
    queryKey: ['owners', 'basic'],
    queryFn: () => apiClient.get<OwnerSummary[]>('/owners/basic'),
  });

  const animalsQueryKey = useMemo(() => ['animals', filters.ownerId] as const, [filters.ownerId]);
  const { data: animals } = useQuery({
    queryKey: animalsQueryKey,
    queryFn: () =>
      filters.ownerId ? apiClient.get<Animal[]>(`/animals?ownerId=${filters.ownerId}`) : apiClient.get<Animal[]>('/animals'),
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.ownerId) params.set('ownerId', filters.ownerId);
    if (filters.animalId) params.set('animalId', filters.animalId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    return params.toString() ? `?${params.toString()}` : '';
  }, [filters]);

  const { data: services, isLoading, error, refetch } = useQuery({
    queryKey: ['services', queryString],
    queryFn: () => apiClient.get<Service[]>(`/services${queryString}`),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    refetch();
  };

  const handleReset = () => {
    setFilters({ ownerId: '', animalId: '', from: '', to: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Serviços</h1>
          <p className="text-sm text-brand-grafite/70">
            Visualize consultas, exames, vacinações e cirurgias com filtros por tutor, pet e período.
          </p>
        </div>
        {canRegisterService ? (
          <Button variant="secondary" asChild>
            <Link to="/new-service">Registrar novo serviço</Link>
          </Button>
        ) : null}
      </div>

      <Card title="Filtros inteligentes" description="Aperte play para enxergar o cuidado por período.">
        <form className="grid gap-4 md:grid-cols-4" onSubmit={handleSubmit}>
          <SelectField
            label="Tutor"
            value={filters.ownerId}
            onChange={(event) => setFilters((prev) => ({ ...prev, ownerId: event.target.value, animalId: '' }))}
          >
            <option value="">Todos os tutores</option>
            {owners?.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Animal"
            value={filters.animalId}
            onChange={(event) => setFilters((prev) => ({ ...prev, animalId: event.target.value }))}
          >
            <option value="">Todos os pets</option>
            {animals?.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.nome}
              </option>
            ))}
          </SelectField>

          <Field
            label="De"
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
          />
          <Field
            label="Até"
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
          />

          <div className="flex gap-3 md:col-span-4">
            <Button type="submit">Aplicar filtros</Button>
            <Button type="button" variant="ghost" onClick={handleReset}>
              Limpar
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Histórico de cuidados" description="Um retrato transparente do carinho em números e datas.">
        {isLoading ? <p>Carregando serviços...</p> : null}
        {error ? <p className="text-red-500">Não foi possível carregar os serviços.</p> : null}
        {services?.length ? (
          <ul className="space-y-3">
            {services.map((service) => {
              const owner = service.animal?.owner ?? null;
              const ownerCpf = owner ? formatCpf(owner.cpf) : null;
              const ownerAddress = owner ? buildOwnerAddress(owner) : null;
              const catalogItems = service.catalogItems ?? [];
              const productItems = service.items ?? [];
              const servicesTotal = catalogItems.reduce((sum, item) => sum + item.valorTotal, 0);
              const productsTotal = productItems.reduce((sum, item) => sum + item.valorTotal, 0);
              const overallTotal = servicesTotal + productsTotal;

              return (
                <li key={service.id} className="rounded-2xl border border-brand-azul/30 bg-white/80 p-4">
                  <p className="font-montserrat text-lg font-semibold text-brand-escuro">
                    {serviceLabels[service.tipo] ?? service.tipo}
                  </p>
                  <p className="text-sm text-brand-grafite/70">
                    {new Date(service.data).toLocaleDateString('pt-BR')} • Serviços: R$ {servicesTotal.toFixed(2)} • Produtos: R$ {productsTotal.toFixed(2)} • Total: R$ {overallTotal.toFixed(2)}
                  </p>
                  <p className="text-sm text-brand-grafite/70">
                    Pet: {service.animal?.nome ?? '—'} • Tutor(a): {service.animal?.owner?.nome ?? '—'}
                  </p>
                  {service.responsavel ? (
                    <p className="text-sm text-brand-grafite/70">
                      Responsável: {service.responsavel.nome} ({service.responsavel.email})
                    </p>
                  ) : null}
                  {owner?.telefone ? (
                    <p className="text-xs text-brand-grafite/60">{owner.telefone}</p>
                  ) : null}
                  {ownerCpf ? <p className="text-xs text-brand-grafite/60">CPF: {ownerCpf}</p> : null}
                  {ownerAddress ? <p className="text-xs text-brand-grafite/60">{ownerAddress}</p> : null}
                  {service.observacoes ? (
                    <p className="text-sm text-brand-grafite/80">{service.observacoes}</p>
                  ) : null}
                  {catalogItems.length ? (
                    <div className="mt-3 space-y-2 rounded-xl bg-brand-azul/5 p-3">
                      <p className="text-sm font-semibold text-brand-escuro">Serviços aplicados</p>
                      <ul className="space-y-2 text-sm text-brand-grafite/80">
                        {catalogItems.map((item) => (
                          <li key={item.id} className="flex flex-col gap-1">
                            <span>
                              {item.definition.nome}: {item.quantidade} un × R$ {item.valorUnitario.toFixed(2)} = R$ {item.valorTotal.toFixed(2)}
                            </span>
                            {item.observacoes ? (
                              <span className="text-brand-grafite/60">Observações: {item.observacoes}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm font-semibold text-brand-escuro">Total de serviços: R$ {servicesTotal.toFixed(2)}</p>
                    </div>
                  ) : null}
                  {productItems.length ? (
                  <div className="mt-3 space-y-2 rounded-xl bg-brand-azul/5 p-3">
                    <p className="text-sm font-semibold text-brand-escuro">Itens utilizados</p>
                    <ul className="space-y-2 text-sm text-brand-grafite/80">
                      {productItems.map((item) => {
                        const isOutOfStock = item.product.estoqueAtual === 0;
                        const isLowStock = item.product.estoqueAtual <= item.product.estoqueMinimo && !isOutOfStock;

                        return (
                          <li key={item.id} className="flex flex-col gap-1">
                            <span>
                              {item.product.nome}: {item.quantidade} un × R$ {item.valorUnitario.toFixed(2)} = R$ {item.valorTotal.toFixed(2)}
                            </span>
                            <span
                              className={
                                isOutOfStock
                                  ? 'text-red-500'
                                  : isLowStock
                                    ? 'text-amber-600'
                                    : 'text-brand-grafite/60'
                              }
                            >
                              {isOutOfStock
                                ? 'Estoque zerado após o atendimento.'
                                : isLowStock
                                  ? `Estoque crítico: ${item.product.estoqueAtual} unidade(s) disponível(is).`
                              : `Estoque atual: ${item.product.estoqueAtual} unidade(s).`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-sm font-semibold text-brand-escuro">Total dos produtos: R$ {productsTotal.toFixed(2)}</p>
                  </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        {!isLoading && !services?.length ? (
          <p className="text-sm text-brand-grafite/70">
            Ajuste os filtros ou registre um novo cuidado para visualizar nesta linha do tempo.
          </p>
        ) : null}
      </Card>
    </div>
  );
};

export default ServicesPage;
