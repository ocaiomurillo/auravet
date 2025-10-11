import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import Modal from '../components/Modal';
import { apiClient } from '../lib/apiClient';
import type { Owner } from '../types/api';
import { useAuth } from '../contexts/AuthContext';

interface OwnerFormValues {
  nome: string;
  email: string;
  telefone?: string;
}

const OwnersPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('owners:write');

  const { data: owners, isLoading, error } = useQuery({
    queryKey: ['owners'],
    queryFn: () => apiClient.get<Owner[]>('/owners'),
  });

  const { register, handleSubmit, reset } = useForm<OwnerFormValues>({
    defaultValues: {
      nome: '',
      email: '',
      telefone: '',
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingOwner(null);
    reset();
  };

  const openCreateModal = () => {
    setEditingOwner(null);
    reset({ nome: '', email: '', telefone: '' });
    setModalOpen(true);
  };

  const openEditModal = (owner: Owner) => {
    setEditingOwner(owner);
    reset({ nome: owner.nome, email: owner.email, telefone: owner.telefone ?? '' });
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
        {owners?.length ? (
          <ul className="space-y-4">
            {owners.map((owner) => (
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
            ))}
          </ul>
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
          </form>
        </Modal>
      ) : null}
    </div>
  );
};

export default OwnersPage;
