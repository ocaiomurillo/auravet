import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import { useAuth } from '../contexts/AuthContext';
import { serviceDefinitionsApi } from '../lib/apiClient';
import type { Service, ServiceDefinition } from '../types/api';

interface ServiceDefinitionFormValues {
  nome: string;
  descricao: string;
  profissional: string;
  tipo: Service['tipo'];
  precoSugerido: string;
}

const serviceLabels: Record<Service['tipo'], string> = {
  CONSULTA: 'Consulta',
  EXAME: 'Exame',
  VACINACAO: 'Vacinação',
  CIRURGIA: 'Cirurgia',
  OUTROS: 'Outros cuidados',
};

const defaultFormValues: ServiceDefinitionFormValues = {
  nome: '',
  descricao: '',
  profissional: '',
  tipo: 'CONSULTA',
  precoSugerido: '',
};

const ServicesPage = () => {
  const queryClient = useQueryClient();
  const { hasModule } = useAuth();
  const canCreateDefinitions = hasModule('services:write');

  const { data: definitions, isLoading, error } = useQuery<ServiceDefinition[], Error>({
    queryKey: ['service-definitions'],
    queryFn: serviceDefinitionsApi.list,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ServiceDefinitionFormValues>({
    defaultValues: defaultFormValues,
  });

  const createDefinition = useMutation({
    mutationFn: serviceDefinitionsApi.create,
    onSuccess: () => {
      toast.success('Serviço incluído no catálogo.');
      queryClient.invalidateQueries({ queryKey: ['service-definitions'] });
      reset(defaultFormValues);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o serviço.');
    },
  });

  const onSubmit = handleSubmit((values) => {
    const preco = Number(values.precoSugerido.replace(',', '.'));

    if (Number.isNaN(preco) || preco < 0) {
      toast.error('Informe um valor sugerido válido para o serviço.');
      return;
    }

    createDefinition.mutate({
      nome: values.nome.trim(),
      descricao: values.descricao.trim().length ? values.descricao.trim() : null,
      profissional: values.profissional.trim().length ? values.profissional.trim() : null,
      tipo: values.tipo,
      precoSugerido: Number(preco.toFixed(2)),
    });
  });

  const sortedDefinitions = useMemo(() => {
    return (definitions ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome));
  }, [definitions]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Catálogo de serviços</h1>
        <p className="text-sm text-brand-grafite/70">
          Cadastre serviços padrão com valores sugeridos e responsável/função para reutilizar nos atendimentos e no caixa.
        </p>
      </div>

      {canCreateDefinitions ? (
        <Card title="Novo serviço" description="Organize seu catálogo para agilizar futuros atendimentos.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <Field label="Nome do serviço" {...register('nome')} required />
            <SelectField label="Tipo" {...register('tipo')}>
              {Object.entries(serviceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <Field label="Profissional ou função" {...register('profissional')} placeholder="Veterinário, auxiliar..." />
            <Field
              label="Valor sugerido"
              {...register('precoSugerido')}
              placeholder="0,00"
              inputMode="decimal"
            />
            <Field
              label="Descrição"
              {...register('descricao')}
              className="md:col-span-2"
              placeholder="Detalhe o que está incluso no serviço."
            />

            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit" disabled={isSubmitting}>
                Salvar serviço
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => reset(defaultFormValues)}
                disabled={isSubmitting}
              >
                Limpar
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card title="Serviços cadastrados" description="Use estes serviços ao registrar novos atendimentos.">
        {isLoading ? <p>Carregando catálogo...</p> : null}
        {error ? <p className="text-red-500">Não foi possível carregar o catálogo de serviços.</p> : null}
        {!isLoading && !sortedDefinitions.length ? (
          <p className="text-sm text-brand-grafite/70">Nenhum serviço cadastrado ainda.</p>
        ) : null}

        {sortedDefinitions.length ? (
          <ul className="space-y-3">
            {sortedDefinitions.map((definition) => (
              <li
                key={definition.id}
                className="rounded-2xl border border-brand-azul/30 bg-white/80 p-4 shadow-sm shadow-brand-azul/10"
              >
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-montserrat text-lg font-semibold text-brand-escuro">{definition.nome}</p>
                    <p className="text-sm text-brand-grafite/70">{serviceLabels[definition.tipo] ?? definition.tipo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brand-escuro">
                      Valor sugerido: R$ {definition.precoSugerido.toFixed(2)}
                    </p>
                    <p className="text-xs text-brand-grafite/70">Última atualização: {new Date(definition.updatedAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                {definition.profissional ? (
                  <p className="text-sm text-brand-grafite/80">Profissional/Função: {definition.profissional}</p>
                ) : null}
                {definition.descricao ? (
                  <p className="text-sm text-brand-grafite/80">{definition.descricao}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
};

export default ServicesPage;
