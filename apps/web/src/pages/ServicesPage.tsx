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
import { serviceDefinitionsApi } from '../lib/apiClient';
import type { AttendanceType, ServiceDefinition, ServiceProfessional } from '../types/api';
import { serviceDefinitionCreateSchema } from '../schema/serviceDefinition';
import type { ServiceDefinitionCreateOutput } from '../schema/serviceDefinition';
import { formatApiErrorMessage } from '../utils/apiErrors';
import { createXlsxBlob, downloadBlob } from '../utils/xlsxExport';

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

const exportHeaders = ['Nome', 'Tipo', 'Profissional', 'Preço sugerido', 'Descrição'] as const;
type ExportHeader = (typeof exportHeaders)[number];

type FiltersState = {
  search: string;
  tipo: AttendanceType | '';
  profissional: ProfessionalOptionValue;
};

const ServicesPage = () => {
  const queryClient = useQueryClient();
  const { hasModule } = useAuth();
  const canCreateDefinitions = hasModule('services:write');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<ServiceDefinition | null>(null);
  const [filters, setFilters] = useState<FiltersState>({ search: '', tipo: '', profissional: '' });

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
      handleCloseFormModal();
    },
    onError: (err: unknown) => {
      toast.error(formatError(err, 'Não foi possível salvar o serviço.'));
    },
  });

  const updateDefinition = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ServiceDefinitionCreateOutput }) =>
      serviceDefinitionsApi.update(id, payload),
    onSuccess: () => {
      toast.success('Serviço atualizado.');
      queryClient.invalidateQueries({ queryKey: ['service-definitions'] });
      handleCloseFormModal();
    },
    onError: (err: unknown) => {
      toast.error(formatError(err, 'Não foi possível atualizar o serviço.'));
    },
  });

  const handleOpenCreateModal = () => {
    setEditingDefinition(null);
    reset(defaultFormValues);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (definition: ServiceDefinition) => {
    setEditingDefinition(definition);
    reset({
      nome: definition.nome,
      descricao: definition.descricao ?? '',
      profissional: definition.profissional ?? '',
      tipo: definition.tipo,
      precoSugerido: definition.precoSugerido.toFixed(2),
    });
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setEditingDefinition(null);
    reset(defaultFormValues);
  };

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

      if (editingDefinition) {
        updateDefinition.mutate({ id: editingDefinition.id, payload: parsed.data });
      } else {
        createDefinition.mutate(parsed.data);
      }
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

  const filteredDefinitions = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return sortedDefinitions.filter((definition) => {
      const matchesSearch = normalizedSearch
        ? definition.nome.toLowerCase().includes(normalizedSearch)
        : true;
      const matchesType = filters.tipo ? definition.tipo === filters.tipo : true;
      const matchesProfessional = filters.profissional
        ? definition.profissional === filters.profissional
        : true;

      return matchesSearch && matchesType && matchesProfessional;
    });
  }, [filters.profissional, filters.search, filters.tipo, sortedDefinitions]);

  const loadErrorMessage = error
    ? formatError(error, 'Não foi possível carregar o catálogo de serviços.')
    : null;

  const handleFiltersReset = () => {
    setFilters({ search: '', tipo: '', profissional: '' });
  };

  const buildExportRows = (): Record<ExportHeader, string>[] =>
    filteredDefinitions.map((definition) => ({
      Nome: definition.nome,
      Tipo: serviceTypeLabels[definition.tipo] ?? definition.tipo,
      Profissional: definition.profissional ? professionalLabels[definition.profissional] ?? definition.profissional : '',
      'Preço sugerido': definition.precoSugerido.toFixed(2),
      Descrição: definition.descricao ?? '',
    }));

  const handleExportXlsx = () => {
    if (!filteredDefinitions.length) {
      toast.error('Nenhum serviço encontrado para exportação.');
      return;
    }

    const rows = buildExportRows().map((row) => exportHeaders.map((header) => row[header]));
    const blob = createXlsxBlob({
      sheetName: 'Serviços',
      headers: exportHeaders,
      rows,
    });

    downloadBlob(blob, `auravet-servicos-${Date.now()}.xlsx`);
    toast.success('Planilha de serviços pronta para download.');
  };

  const isSavingDefinition = isSubmitting || createDefinition.isPending || updateDefinition.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Serviços</h1>
          <p className="text-sm text-brand-grafite/70">
            Cadastre os serviços que serão utilizados nos atendimentos, incluindo valores sugeridos e profissional/função.
          </p>
        </div>
        {canCreateDefinitions ? (
          <Button onClick={handleOpenCreateModal}>Novo serviço</Button>
        ) : null}
      </div>

      <Card
        title="Filtros do catálogo"
        description="Busque por nome, tipo ou profissional/função."
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
          />
          <SelectField
            label="Tipo de serviço"
            value={filters.tipo}
            onChange={(event) => setFilters((prev) => ({ ...prev, tipo: event.target.value as FiltersState['tipo'] }))}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(serviceTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Profissional ou função"
            value={filters.profissional}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, profissional: event.target.value as ProfessionalOptionValue }))
            }
            className="md:col-span-2"
          >
            <option value="">Todos os profissionais</option>
            {professionalOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      <Card title="Serviços cadastrados" description="Use estes serviços ao registrar novos atendimentos.">
        {isLoading ? <p>Carregando serviços...</p> : null}
        {loadErrorMessage ? <p className="text-red-500">{loadErrorMessage}</p> : null}
        {!isLoading && !filteredDefinitions.length ? (
          <p className="text-sm text-brand-grafite/70">Nenhum serviço encontrado com os filtros selecionados.</p>
        ) : null}

        {filteredDefinitions.length ? (
          <ul className="space-y-3">
            {filteredDefinitions.map((definition) => (
              <li
                key={definition.id}
                className="rounded-2xl border border-brand-azul/30 bg-white/80 p-4 shadow-sm shadow-brand-azul/10"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-montserrat text-lg font-semibold text-brand-escuro">{definition.nome}</p>
                    <p className="text-sm text-brand-grafite/70">{serviceTypeLabels[definition.tipo] ?? definition.tipo}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right md:flex-row md:items-center md:gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-escuro">
                        Valor sugerido: R$ {definition.precoSugerido.toFixed(2)}
                      </p>
                      <p className="text-xs text-brand-grafite/70">Última atualização: {new Date(definition.updatedAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    {canCreateDefinitions ? (
                      <Button variant="ghost" onClick={() => handleOpenEditModal(definition)}>
                        Editar
                      </Button>
                    ) : null}
                  </div>
                </div>

                {definition.profissional ? (
                  <p className="text-sm text-brand-grafite/80">
                    Profissional Indicado: {professionalLabels[definition.profissional] ?? definition.profissional}
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

      <Modal
        open={isFormModalOpen}
        onClose={handleCloseFormModal}
        title={editingDefinition ? 'Editar serviço' : 'Novo serviço'}
        description="Cadastre serviços para agilizar futuros atendimentos."
        actions={
          <>
            <Button variant="ghost" onClick={handleCloseFormModal} disabled={isSavingDefinition}>
              Cancelar
            </Button>
            <Button type="submit" form="service-definition-form" disabled={isSavingDefinition}>
              {editingDefinition ? 'Atualizar serviço' : 'Salvar serviço'}
            </Button>
          </>
        }
      >
        <form id="service-definition-form" className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
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
            label="Profissional indicado"
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
        </form>
      </Modal>
    </div>
  );
};

export default ServicesPage;
