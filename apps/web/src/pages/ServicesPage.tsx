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
import type { AttendanceType, ServiceDefinition, ServiceProfessional } from '../types/api';
import { serviceDefinitionCreateSchema } from '../schema/serviceDefinition';
import { formatApiErrorMessage } from '../utils/apiErrors';

type ProfessionalOptionValue = ServiceProfessional | '';

interface ServiceDefinitionFormValues {
  nome: string;
  descricao: string;
  profissional: ProfessionalOptionValue;
  tipo: AttendanceType;
  precoSugerido: string;
}

const serviceTypeLabels: Record<AttendanceType, string> = {
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

const professionalOptions: { value: ServiceProfessional; label: string }[] = [
  { value: 'MEDICO', label: 'Médico' },
  { value: 'ENFERMEIRO', label: 'Enfermeiro' },
  { value: 'AMBOS', label: 'Ambos' },
];

const professionalLabels = professionalOptions.reduce<Record<ServiceProfessional, string>>((labels, option) => {
  labels[option.value] = option.label;
  return labels;
}, {} as Record<ServiceProfessional, string>);

const ServicesPage = () => {
  const queryClient = useQueryClient();
  const { hasModule } = useAuth();
  const canCreateDefinitions = hasModule('services:write');

  const formatError = (err: unknown, fallback: string) => formatApiErrorMessage(err, fallback);

  const { data: definitions, isLoading, error } = useQuery<ServiceDefinition[], Error>({
    queryKey: ['service-definitions'],
    queryFn: serviceDefinitionsApi.list,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
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
      toast.error(formatError(err, 'Não foi possível salvar o serviço.'));
    },
  });

  const onSubmit = handleSubmit(
    (values) => {
      const parsed = serviceDefinitionCreateSchema.safeParse({
        nome: values.nome,
        descricao: values.descricao,
        profissional: values.profissional || undefined,
        tipo: values.tipo,
        precoSugerido: values.precoSugerido,
      });

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        toast.error(firstIssue?.message ?? 'Dados inválidos.');
        return;
      }

      createDefinition.mutate(parsed.data);
    },
    (formErrors) => {
      const firstError = Object.values(formErrors)[0];
      if (firstError?.message) {
        toast.error(firstError.message as string);
      }
    },
  );

  const sortedDefinitions = useMemo(() => {
    return (definitions ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome));
  }, [definitions]);

  const loadErrorMessage = error
    ? formatError(error, 'Não foi possível carregar o catálogo de serviços.')
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Catálogo de serviços</h1>
        <p className="text-sm text-brand-grafite/70">
          Cadastre os serviços que serão utilizados nos atendimentos, incluindo valores sugeridos e profissional/função.
        </p>
      </div>

      {canCreateDefinitions ? (
        <Card title="Novo serviço" description="Organize seu catálogo para agilizar futuros atendimentos.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <Field
              label="Nome do serviço"
              {...register('nome', {
                required: 'Informe o nome do serviço.',
                minLength: { value: 2, message: 'O nome do serviço deve ter ao menos 2 caracteres.' },
              })}
              error={errors.nome?.message}
              required
            />
            <SelectField label="Tipo de serviço" {...register('tipo')}>
              {Object.entries(serviceTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Profissional ou função"
              {...register('profissional')}
            >
              <option value="">Selecione uma opção</option>
              {professionalOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <Field
              label="Valor sugerido"
              {...register('precoSugerido', {
                required: 'Informe um valor sugerido para o serviço.',
              })}
              placeholder="0,00"
              inputMode="decimal"
              error={errors.precoSugerido?.message}
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
        {loadErrorMessage ? <p className="text-red-500">{loadErrorMessage}</p> : null}
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
                    <p className="text-sm text-brand-grafite/70">{serviceTypeLabels[definition.tipo] ?? definition.tipo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brand-escuro">
                      Valor sugerido: R$ {definition.precoSugerido.toFixed(2)}
                    </p>
                    <p className="text-xs text-brand-grafite/70">Última atualização: {new Date(definition.updatedAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                {definition.profissional ? (
                  <p className="text-sm text-brand-grafite/80">
                    Profissional/Função: {professionalLabels[definition.profissional] ?? definition.profissional}
                  </p>
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
