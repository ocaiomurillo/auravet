import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import Modal from '../components/Modal';
import SelectField from '../components/SelectField';
import { roleLabels } from '../constants/roles';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/apiClient';
import type { Role, User } from '../types/api';

interface UserFormValues {
  nome: string;
  email: string;
  password: string;
  role: Role;
}

const defaultValues: UserFormValues = {
  nome: '',
  email: '',
  password: '',
  role: 'ASSISTENTE_ADMINISTRATIVO',
};

const UsersPage = () => {
  const queryClient = useQueryClient();
  const { registerUser, hasPermission, refreshUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const canManage = hasPermission('users:manage');

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<{ users: User[] }>('/users'),
    enabled: canManage,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({ defaultValues });

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    reset(defaultValues);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    reset(defaultValues);
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    reset({ nome: user.nome, email: user.email, password: '', role: user.role });
    setModalOpen(true);
  };

  const createUser = useMutation({
    mutationFn: registerUser,
    onSuccess: async (user) => {
      toast.success(`Colaborador ${user.nome} cadastrado!`);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o colaborador.');
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, nome, role }: { id: string; nome: string; role: Role }) => {
      const response = await apiClient.patch<{ user: User }>(`/users/${id}`, {
        nome,
        role,
      });
      return response.user;
    },
    onSuccess: async (user) => {
      toast.success(`Dados de ${user.nome} atualizados.`);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o colaborador.');
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiClient.patch<{ user: User }>(`/users/${id}/status`, {
        isActive,
      });
      return response.user;
    },
    onSuccess: async (user) => {
      toast.success(`${user.nome} agora está ${user.isActive ? 'ativo' : 'inativo'}.`);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o status.');
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (editingUser) {
      updateUser.mutate({ id: editingUser.id, nome: values.nome, role: values.role });
    } else {
      createUser.mutate(values);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Colaboradores Auravet</h1>
          <p className="text-sm text-brand-grafite/70">
            Administre o acesso da equipe com responsabilidade: defina papéis, acompanhe status e mantenha a segurança da clínica.
          </p>
        </div>
        <Button onClick={openCreateModal}>Novo colaborador</Button>
      </div>

      <Card title="Equipe interna" description="Somente usuários ativos podem acessar o ecossistema Auravet.">
        {usersQuery.isLoading ? <p>Carregando colaboradores...</p> : null}
        {usersQuery.error ? (
          <p className="text-sm text-red-600">Não foi possível carregar a lista de usuários.</p>
        ) : null}
        {usersQuery.data?.users.length ? (
          <ul className="space-y-4">
            {usersQuery.data.users.map((user) => (
              <li
                key={user.id}
                className="flex flex-col gap-3 rounded-2xl border border-brand-azul/30 bg-white/70 p-5 transition hover:border-brand-escuro/40 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-montserrat text-lg font-semibold text-brand-escuro">{user.nome}</p>
                  <p className="text-sm text-brand-grafite/70">{user.email}</p>
                  <p className="text-xs uppercase tracking-wide text-brand-escuro/70">{roleLabels[user.role]}</p>
                  <p className="text-xs text-brand-grafite/60">
                    Último acesso:{' '}
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('pt-BR') : 'Ainda não entrou'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => openEditModal(user)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    className={user.isActive ? 'text-red-600 hover:bg-red-100' : 'text-green-700 hover:bg-green-100'}
                    onClick={() => toggleStatus.mutate({ id: user.id, isActive: !user.isActive })}
                    disabled={toggleStatus.isPending}
                  >
                    {user.isActive ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {!usersQuery.isLoading && !usersQuery.data?.users.length ? (
          <p className="text-sm text-brand-grafite/70">
            Ainda não existem colaboradores cadastrados além do Administrador inicial. Use o botão acima para convidar a equipe.
          </p>
        ) : null}
      </Card>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingUser ? 'Editar colaborador' : 'Novo colaborador Auravet'}
        description={
          editingUser
            ? 'Ajuste nome e papel de acesso conforme a rotina clínica.'
            : 'Cadastre um novo membro da equipe com papel e senha provisória.'
        }
        actions={
          <>
            <Button variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" form="user-form" disabled={createUser.isPending || updateUser.isPending}>
              {editingUser ? 'Salvar alterações' : 'Criar colaborador'}
            </Button>
          </>
        }
      >
        <form id="user-form" className="space-y-4" onSubmit={onSubmit}>
          <Field
            label="Nome completo"
            placeholder="Nome e sobrenome"
            required
            {...register('nome', { required: 'Informe o nome do colaborador.' })}
            helperText={errors.nome?.message}
          />
          <Field
            label="E-mail institucional"
            type="email"
            placeholder="colaborador@auravet.com"
            required
            disabled={Boolean(editingUser)}
            {...register('email', { required: 'Informe o e-mail corporativo.' })}
            helperText={errors.email?.message}
          />
          {!editingUser ? (
            <Field
              label="Senha provisória"
              type="password"
              placeholder="Senha inicial"
              required
              {...register('password', {
                required: 'Informe uma senha provisória.',
                minLength: { value: 8, message: 'A senha deve ter pelo menos 8 caracteres.' },
              })}
              helperText={errors.password?.message}
            />
          ) : null}
          <SelectField label="Papel" required {...register('role')}>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </form>
      </Modal>
    </div>
  );
};

export default UsersPage;
