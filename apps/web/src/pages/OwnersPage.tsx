import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/apiClient';
import type { Owner } from '../types/api';
import { buildOwnerAddress, formatCpf } from '../utils/owner';
import { exportXlsxFile } from '../utils/xlsxExport';

interface OwnerFormValues {
  nome: string;
  email: string;
  telefone?: string;
  cpf: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

const OwnersPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterCpf, setFilterCpf] = useState('');
  const queryClient = useQueryClient();
  const { hasModule } = useAuth();
  const canEdit = hasModule('owners:manage');

  const buildXlsxFilename = (base: string) =>
    `auravet-${base.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}.xlsx`;

  const { data: owners, isLoading, error } = useQuery({
    queryKey: ['owners'],
    queryFn: () => apiClient.get<Owner[]>('/owners'),
  });

  const initialFormValues = useMemo<OwnerFormValues>(
    () => ({
      nome: '',
      email: '',
      telefone: '',
      cpf: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
    }),
    [],
  );

  const { register, handleSubmit, reset } = useForm<OwnerFormValues>({
    defaultValues: initialFormValues,
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingOwner(null);
    reset(initialFormValues);
  };

  const openCreateModal = () => {
    setEditingOwner(null);
    reset(initialFormValues);
    setModalOpen(true);
  };

  const openEditModal = (owner: Owner) => {
    setEditingOwner(owner);
    reset({
      nome: owner.nome,
      email: owner.email,
      telefone: owner.telefone ?? '',
      cpf: owner.cpf ?? '',
      logradouro: owner.logradouro ?? '',
      numero: owner.numero ?? '',
      complemento: owner.complemento ?? '',
      bairro: owner.bairro ?? '',
      cidade: owner.cidade ?? '',
      estado: owner.estado ?? '',
      cep: owner.cep ?? '',
    });
    setModalOpen(true);
  };

  const createOwner = useMutation({
    mutationFn: (payload: OwnerFormValues) => apiClient.post<Owner>('/owners', payload),
    onSuccess: () => {
      toast.success('Tutor cadastrado com carinho.');
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      closeModal();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar o tutor.');
    },
  });

  const updateOwner = useMutation({
    mutationFn: ({ id, ...payload }: OwnerFormValues & { id: string }) =>
      apiClient.put<Owner>(`/owners/${id}`, payload),
    onSuccess: () => {
      toast.success('Informações do tutor atualizadas.');
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      closeModal();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o tutor.');
    },
  });

  const deleteOwner = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/owners/${id}`),
    onSuccess: () => {
      toast.success('Tutor removido da base Auravet.');
      queryClient.invalidateQueries({ queryKey: ['owners'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover o tutor.');
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (editingOwner) {
      updateOwner.mutate({ id: editingOwner.id, ...values });
    } else {
      createOwner.mutate(values);
    }
  });

  const filteredOwners = useMemo(() => {
    if (!owners) return [];

    const normalize = (value: string) => value.toLowerCase();
    const normalizeCpf = (value: string) => value.replace(/\D/g, '');

    return owners.filter((owner) => {
      const matchesName = owner.nome
        ? normalize(owner.nome).includes(normalize(filterName))
        : false;
      const matchesEmail = owner.email
        ? normalize(owner.email).includes(normalize(filterEmail))
        : false;
      const matchesCpf = owner.cpf
        ? normalizeCpf(owner.cpf).includes(normalizeCpf(filterCpf))
        : false;

      return (
        (!filterName || matchesName) && (!filterEmail || matchesEmail) && (!filterCpf || matchesCpf)
      );
    });
  }, [filterCpf, filterEmail, filterName, owners]);

  const handleExport = () => {
    if (!filteredOwners.length) {
      toast.error('Nenhum tutor encontrado para exportação.');
      return;
    }

    const headers = ['Nome', 'E-mail', 'Telefone', 'CPF', 'Endereço', 'Total de animais'];
    const rows = filteredOwners.map((owner) => [
      owner.nome ?? '',
      owner.email ?? '',
      owner.telefone ?? '',
      formatCpf(owner.cpf) ?? '',
      buildOwnerAddress(owner) ?? '',
      String(owner.animals?.length ?? 0),
    ]);

    exportXlsxFile({
      sheetName: 'Tutores',
      headers,
      rows,
      filename: buildXlsxFilename('tutores'),
    });

    toast.success('Planilha de tutores pronta para download.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Tutores</h1>
          <p className="text-sm text-brand-grafite/70">
            Aqui cuidamos dos contatos que confiam seus animais à Auravet. Um cadastro completo facilita orientações futuras.
          </p>
        </div>
        {canEdit ? <Button onClick={openCreateModal}>Novo tutor</Button> : null}
      </div>

      <Card>
        {isLoading ? <p>Carregando tutores...</p> : null}
        {error ? <p className="text-red-500">Não foi possível carregar os tutores.</p> : null}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Field
            label="Buscar por nome"
            placeholder="Nome do tutor"
            value={filterName}
            onChange={(event) => setFilterName(event.target.value)}
          />
          <Field
            label="Buscar por e-mail"
            placeholder="email@auravet.com"
            value={filterEmail}
            onChange={(event) => setFilterEmail(event.target.value)}
          />
          <Field
            label="Buscar por CPF"
            placeholder="000.000.000-00"
            value={filterCpf}
            onChange={(event) => setFilterCpf(event.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-3 pb-4">
          <p className="text-sm text-brand-grafite/70">
            {filteredOwners.length} tutor{filteredOwners.length === 1 ? '' : 'es'} encontrado
            {filteredOwners.length === 1 ? '' : 's'}.
          </p>
          <Button onClick={handleExport} disabled={!filteredOwners.length}>
            Exportar para Excel
          </Button>
        </div>
        {filteredOwners.length ? (
          <ul className="space-y-4">
            {filteredOwners.map((owner) => {
              const ownerCpf = formatCpf(owner.cpf);
              const ownerAddress = buildOwnerAddress(owner);

              return (
                <li
                  key={owner.id}
                  className="flex flex-col gap-3 rounded-2xl border border-brand-azul/30 bg-white/70 p-4 transition hover:border-brand-escuro/40 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-montserrat text-lg font-semibold text-brand-escuro">{owner.nome}</p>
                    <p className="text-sm text-brand-grafite/70">{owner.email}</p>
                    {owner.telefone ? (
                      <p className="text-sm text-brand-grafite/70">{owner.telefone}</p>
                    ) : null}
                    {ownerCpf ? (
                      <p className="text-sm text-brand-grafite/70">CPF: {ownerCpf}</p>
                    ) : null}
                    {ownerAddress ? (
                      <p className="text-sm text-brand-grafite/70">{ownerAddress}</p>
                    ) : null}
                    <p className="text-xs uppercase tracking-wide text-brand-escuro/60">
                      {owner.animals?.length ?? 0} animais sob cuidado
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" onClick={() => openEditModal(owner)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-red-600 hover:bg-red-100"
                        onClick={() => deleteOwner.mutate(owner.id)}
                      >
                        Remover
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        {!isLoading && owners?.length && !filteredOwners.length ? (
          <p className="text-sm text-brand-grafite/70">Nenhum tutor corresponde aos filtros aplicados.</p>
        ) : null}
        {!isLoading && !owners?.length ? (
          <p className="text-sm text-brand-grafite/70">
            Ainda não temos tutores cadastrados. Comece registrando quem ama compartilhar a energia de seus pets com a Auravet.
          </p>
        ) : null}
      </Card>

      {canEdit ? (
        <Modal
          open={modalOpen}
          onClose={closeModal}
          title={editingOwner ? 'Editar tutor' : 'Novo tutor Auravet'}
          description="Preencha os dados de contato para fortalecer a comunicação empática com cada família."
          actions={
            <>
              <Button variant="ghost" onClick={closeModal}>
                Cancelar
              </Button>
              <Button type="submit" form="owner-form">
                {editingOwner ? 'Salvar alterações' : 'Cadastrar'}
              </Button>
            </>
          }
        >
          <form id="owner-form" className="space-y-4" onSubmit={onSubmit}>
            <Field label="Nome" placeholder="Nome completo" required {...register('nome')} />
            <Field label="E-mail" type="email" placeholder="email@auravet.com" required {...register('email')} />
            <Field label="Telefone" placeholder="(00) 00000-0000" {...register('telefone')} />
            <Field label="CPF" placeholder="000.000.000-00" required {...register('cpf')} />
            <Field label="Logradouro" placeholder="Rua e número" {...register('logradouro')} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Número" placeholder="Número" {...register('numero')} />
              <Field label="Complemento" placeholder="Apto, bloco..." {...register('complemento')} />
            </div>
            <Field label="Bairro" placeholder="Bairro" {...register('bairro')} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cidade" placeholder="Cidade" {...register('cidade')} />
              <Field label="Estado" placeholder="UF" maxLength={2} {...register('estado')} />
            </div>
            <Field label="CEP" placeholder="00000-000" {...register('cep')} />
          </form>
        </Modal>
      ) : null}
    </div>
  );
};

export default OwnersPage;
