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
import { apiClient } from '../lib/apiClient';
import type { Role, User } from '../types/api';

const SHIFT_OPTIONS = [
  { label: 'Manhã', value: 'MANHA' },
  { label: 'Tarde', value: 'TARDE' },
  { label: 'Noite', value: 'NOITE' },
] as const;

type ShiftValue = (typeof SHIFT_OPTIONS)[number]['value'];

interface UserFormValues {
  nome: string;
  email: string;
  password: string;
  roleId: string;
  especialidade: string;
  crmv: string;
  turnos: ShiftValue[];
  bio: string;
}

const defaultValues: UserFormValues = {
  nome: '',
  email: '',
  password: '',
  roleId: '',
  especialidade: '',
  crmv: '',
  turnos: [],
  bio: '',
};

const toNullable = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildProfilePayload = (
  values: Pick<UserFormValues, 'especialidade' | 'crmv' | 'turnos' | 'bio'>,
): { especialidade: string | null; crmv: string | null; turnos: string[]; bio: string | null } => ({
  especialidade: toNullable(values.especialidade),
  crmv: toNullable(values.crmv),
  turnos: [...values.turnos],
  bio: toNullable(values.bio),
});

const UsersPage = () => {
  const queryClient = useQueryClient();
  const { registerUser, hasModule, refreshUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const canManage = hasModule('users:manage');

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get<{ users: User[] }>('/users'),
    enabled: canManage,
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient.get<{ roles: Role[] }>('/roles'),
    enabled: canManage,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserFormValues>({ defaultValues });

  const activeRoles = useMemo(() => rolesQuery.data?.roles.filter((role) => role.isActive) ?? [], [rolesQuery.data?.roles]);

  const selectedShifts = watch('turnos') ?? [];

  const toggleShift = (shift: ShiftValue) => {
    const current = new Set(selectedShifts);
    if (current.has(shift)) {
      current.delete(shift);
    } else {
      current.add(shift);
    }

    const ordered = SHIFT_OPTIONS.filter((option) => current.has(option.value)).map((option) => option.value);
    setValue('turnos', ordered, { shouldDirty: true, shouldTouch: true });
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    reset({ ...defaultValues, roleId: activeRoles[0]?.id ?? '' });
  };

  const openCreateModal = () => {
    setEditingUser(null);
    reset({ ...defaultValues, roleId: activeRoles[0]?.id ?? '' });
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    const collaboratorTurnos = new Set((user.collaboratorProfile?.turnos ?? []).map((turno) => turno.toUpperCase()));
    const normalizedTurnos = SHIFT_OPTIONS.filter((option) => collaboratorTurnos.has(option.value)).map((option) => option.value);

    reset({
      nome: user.nome,
      email: user.email,
      password: '',
      roleId: user.role.id,
      especialidade: user.collaboratorProfile?.especialidade ?? '',
      crmv: user.collaboratorProfile?.crmv ?? '',
      turnos: normalizedTurnos,
      bio: user.collaboratorProfile?.bio ?? '',
    });
    setModalOpen(true);
  };

  const createUser = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const profile = buildProfilePayload(values);
      return registerUser({
        nome: values.nome,
        email: values.email,
        password: values.password,
        roleId: values.roleId,
        especialidade: profile.especialidade,
        crmv: profile.crmv,
        turnos: profile.turnos,
        bio: profile.bio,
      });
    },
    onSuccess: async (user) => {
      toast.success(`Colaborador ${user.nome} cadastrado!`);
      await Promise.all([
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments', 'collaborators'] }),
        queryClient.invalidateQueries({ queryKey: ['service-responsibles'] }),
      ]);
      closeModal();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o colaborador.');
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({
      id,
      nome,
      roleId,
      profile,
    }: {
      id: string;
      nome: string;
      roleId: string;
      profile: ReturnType<typeof buildProfilePayload>;
    }) => {
      await apiClient.patch<{ user: User }>(`/users/${id}`, {
        nome,
        roleId,
      });

      const response = await apiClient.patch<{ user: User }>(`/users/${id}/profile`, profile);
      return response.user;
    },
    onSuccess: async (user) => {
      toast.success(`Dados de ${user.nome} atualizados.`);
      await Promise.all([
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments', 'collaborators'] }),
        queryClient.invalidateQueries({ queryKey: ['service-responsibles'] }),
      ]);
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
      await Promise.all([
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments', 'collaborators'] }),
        queryClient.invalidateQueries({ queryKey: ['service-responsibles'] }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o status.');
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (editingUser) {
      updateUser.mutate({
        id: editingUser.id,
        nome: values.nome,
        roleId: values.roleId,
        profile: buildProfilePayload(values),
      });
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
        <Button onClick={openCreateModal} disabled={!activeRoles.length}>
          Novo colaborador
        </Button>
      </div>
      {rolesQuery.error ? (
        <p className="text-sm text-red-600">Não foi possível carregar as funções disponíveis. Atualize a página para tentar novamente.</p>
      ) : null}

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
                  <p className="text-xs uppercase tracking-wide text-brand-escuro/70">{user.role.name}</p>
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
        <form id="user-form" className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <Field
            label="Nome completo"
            placeholder="Nome e sobrenome"
            required
            className="py-2.5 text-sm md:text-base"
            {...register('nome', { required: 'Informe o nome do colaborador.' })}
            helperText={errors.nome?.message}
          />
          <Field
            label="E-mail institucional"
            type="email"
            placeholder="colaborador@auravet.com"
            required
            disabled={Boolean(editingUser)}
            className="py-2.5 text-sm md:text-base"
            {...register('email', { required: 'Informe o e-mail corporativo.' })}
            helperText={errors.email?.message}
          />
          {!editingUser ? (
            <Field
              label="Senha provisória"
              type="password"
              placeholder="Senha inicial"
              required
              className="py-2.5 text-sm md:text-base"
              {...register('password', {
                required: 'Informe uma senha provisória.',
                minLength: { value: 8, message: 'A senha deve ter pelo menos 8 caracteres.' },
              })}
              helperText={errors.password?.message}
            />
          ) : null}
          <SelectField
            label="Função"
            required
            className="py-2.5 text-sm md:text-base"
            {...register('roleId', { required: 'Selecione uma função.' })}
          >
            <option value="" disabled>
              {rolesQuery.isLoading ? 'Carregando funções...' : 'Selecione uma função'}
            </option>
            {activeRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </SelectField>
          <div className="space-y-1 md:col-span-2">
            <p className="text-sm font-semibold text-brand-escuro">Perfil clínico</p>
            <p className="text-xs text-brand-grafite/70">
              Preencha os dados apresentados nos formulários de agendamento e atendimento.
            </p>
          </div>
          <Field
            label="Especialidade clínica"
            placeholder="Ex.: Clínica geral, felinos, cirurgia"
            className="py-2.5 text-sm md:text-base"
            {...register('especialidade')}
            helperText="Opcional"
          />
          <Field
            label="CRMV"
            placeholder="Registro profissional"
            className="py-2.5 text-sm md:text-base"
            {...register('crmv')}
            helperText="Opcional"
          />
          <label className="flex flex-col gap-1 text-sm font-medium text-brand-grafite md:col-span-2">
            <span className="font-semibold text-brand-escuro">Bio clínica</span>
            <textarea
              {...register('bio')}
              rows={3}
              className="w-full rounded-xl border border-brand-azul/60 bg-white/90 px-4 py-2.5 text-sm text-brand-grafite shadow-inner focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/50"
              placeholder="Resumo sobre a atuação profissional do colaborador"
            />
            <span className="text-xs text-brand-grafite/70">Opcional</span>
          </label>
          <div className="space-y-3 rounded-2xl border border-brand-azul/30 bg-white/60 p-4 md:col-span-2">
            <div>
              <p className="text-sm font-semibold text-brand-escuro">Turnos disponíveis</p>
              <p className="text-xs text-brand-grafite/70">Selecione os períodos em que o colaborador pode ser escalado.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SHIFT_OPTIONS.map((option) => {
                const checkboxId = `shift-${option.value.toLowerCase()}`;
                const checked = selectedShifts.includes(option.value);
                return (
                  <label
                    key={option.value}
                    htmlFor={checkboxId}
                    className="flex items-center gap-2 rounded-xl border border-brand-azul/40 bg-white/80 px-3 py-2 text-sm text-brand-escuro"
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      className="h-4 w-4 accent-brand-escuro"
                      checked={checked}
                      onChange={() => toggleShift(option.value)}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-brand-grafite/70">Deixe todos desmarcados para uma agenda flexível.</p>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UsersPage;
