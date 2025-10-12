import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/apiClient';
import type { Module, Role } from '../types/api';

interface CreateRoleFormValues {
  name: string;
  slug: string;
  description: string;
}

const defaultCreateRoleValues: CreateRoleFormValues = {
  name: '',
  slug: '',
  description: '',
};

const RolesPage = () => {
  const { hasModule, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [moduleModalRole, setModuleModalRole] = useState<Role | null>(null);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());
  const [createSelectedModules, setCreateSelectedModules] = useState<Set<string>>(new Set());

  const canManage = hasModule('users:manage');

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient.get<{ roles: Role[] }>('/roles'),
    enabled: canManage,
  });

  const modulesQuery = useQuery({
    queryKey: ['roles', 'modules'],
    queryFn: () => apiClient.get<{ modules: Module[] }>('/roles/modules'),
    enabled: canManage,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRoleFormValues>({ defaultValues: defaultCreateRoleValues });

  const availableModules = modulesQuery.data?.modules ?? [];

  const createRole = useMutation({
    mutationFn: async (values: CreateRoleFormValues & { moduleIds: string[] }) => {
      const response = await apiClient.post<{ role: Role }>('/roles', {
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        moduleIds: values.moduleIds,
      });
      return response.role;
    },
    onSuccess: async (role) => {
      toast.success(`Função ${role.name} criada!`);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      handleCloseCreateModal();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar a função.');
    },
  });

  const updateRoleStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiClient.patch<{ role: Role }>(`/roles/${id}`, { isActive });
      return response.role;
    },
    onSuccess: async (role) => {
      toast.success(`${role.name} agora está ${role.isActive ? 'ativa' : 'inativa'}.`);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o status da função.');
    },
  });

  const updateRoleModules = useMutation({
    mutationFn: async ({ id, modules }: { id: string; modules: { moduleId: string; isEnabled: boolean }[] }) => {
      const response = await apiClient.patch<{ role: Role }>(`/roles/${id}/modules`, {
        modules,
      });
      return response.role;
    },
    onSuccess: async (role) => {
      toast.success(`Permissões da função ${role.name} atualizadas.`);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      closeModulesModal();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar os módulos da função.');
    },
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/roles/${id}`);
    },
    onSuccess: () => {
      toast.success('Função removida.');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover a função.');
    },
  });

  const handleOpenCreateModal = () => {
    reset(defaultCreateRoleValues);
    setCreateSelectedModules(new Set());
    setCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
    reset(defaultCreateRoleValues);
    setCreateSelectedModules(new Set());
  };

  const onCreateRole = handleSubmit((values) => {
    createRole.mutate({ ...values, moduleIds: Array.from(createSelectedModules) });
  });

  const openModulesModal = (role: Role) => {
    setModuleModalRole(role);
    setSelectedModuleIds(new Set(role.modules.filter((module) => module.isEnabled).map((module) => module.id)));
  };

  const closeModulesModal = () => {
    setModuleModalRole(null);
    setSelectedModuleIds(new Set());
  };

  const toggleModuleSelection = (moduleId: string) => {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const saveModules = () => {
    if (!moduleModalRole) {
      return;
    }

    const payload = availableModules.map((module) => ({
      moduleId: module.id,
      isEnabled: selectedModuleIds.has(module.id),
    }));

    updateRoleModules.mutate({ id: moduleModalRole.id, modules: payload });
  };

  const handleDeleteRole = (role: Role) => {
    if (confirm(`Deseja realmente remover a função ${role.name}? Essa ação não pode ser desfeita.`)) {
      deleteRole.mutate(role.id);
    }
  };

  const selectedCount = selectedModuleIds.size;
  const createSelectedCount = createSelectedModules.size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Funções e módulos</h1>
          <p className="text-sm text-brand-grafite/70">
            Estruture o acesso da equipe definindo quais módulos cada função pode acessar na plataforma Auravet.
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} disabled={modulesQuery.isLoading || Boolean(modulesQuery.error)}>
          Nova função
        </Button>
      </div>

      <Card title="Funções cadastradas" description="Organize a equipe conforme responsabilidades e mantenha os módulos sob controle.">
        {rolesQuery.isLoading ? <p>Carregando funções...</p> : null}
        {rolesQuery.error ? <p className="text-sm text-red-600">Não foi possível carregar as funções cadastradas.</p> : null}

        {rolesQuery.data?.roles.length ? (
          <ul className="space-y-4">
            {rolesQuery.data.roles.map((role) => (
              <li
                key={role.id}
                className="space-y-4 rounded-2xl border border-brand-azul/30 bg-white/70 p-5 transition hover:border-brand-escuro/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-montserrat text-lg font-semibold text-brand-escuro">{role.name}</p>
                    <p className="text-xs uppercase tracking-wide text-brand-grafite/60">{role.slug}</p>
                    {role.description ? (
                      <p className="text-sm text-brand-grafite/70">{role.description}</p>
                    ) : (
                      <p className="text-sm text-brand-grafite/60">Função sem descrição cadastrada.</p>
                    )}
                    <p className="text-xs text-brand-grafite/50">
                      {role.isActive ? 'Função ativa' : 'Função inativa'} • {role.modules.filter((module) => module.isEnabled).length} módulos ativos
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => openModulesModal(role)} disabled={modulesQuery.isLoading}>
                      Ajustar módulos
                    </Button>
                    <Button
                      variant="ghost"
                      className={role.isActive ? 'text-red-600 hover:bg-red-100' : 'text-green-700 hover:bg-green-100'}
                      onClick={() => updateRoleStatus.mutate({ id: role.id, isActive: !role.isActive })}
                      disabled={updateRoleStatus.isPending}
                    >
                      {role.isActive ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:bg-red-100"
                      onClick={() => handleDeleteRole(role)}
                      disabled={deleteRole.isPending}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.modules.length ? (
                    role.modules.map((module) => (
                      <span
                        key={module.id}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          module.isEnabled
                            ? 'bg-brand-savia/60 text-brand-grafite'
                            : 'bg-brand-azul/20 text-brand-grafite/60 line-through'
                        }`}
                      >
                        {module.name}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-brand-grafite/60">Nenhum módulo associado até o momento.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {!rolesQuery.isLoading && !rolesQuery.data?.roles.length ? (
          <p className="text-sm text-brand-grafite/70">Cadastre a primeira função para começar a distribuir responsabilidades.</p>
        ) : null}
      </Card>

      <Modal
        open={createModalOpen}
        onClose={handleCloseCreateModal}
        title="Cadastrar nova função"
        description="Defina um nome amigável, um identificador único e quais módulos estarão disponíveis para esta função."
        actions={
          <>
            <Button variant="ghost" onClick={handleCloseCreateModal}>
              Cancelar
            </Button>
            <Button type="submit" form="create-role-form" disabled={createRole.isPending}>
              Criar função
            </Button>
          </>
        }
      >
        <form id="create-role-form" className="space-y-4" onSubmit={onCreateRole}>
          <Field
            label="Nome da função"
            placeholder="Ex.: Coordenador Clínico"
            required
            {...register('name', { required: 'Informe o nome da função.' })}
            helperText={errors.name?.message}
          />
          <Field
            label="Identificador (slug)"
            placeholder="EXEMPLO_FUNCAO"
            required
            {...register('slug', {
              required: 'Informe um identificador único.',
              pattern: {
                value: /^[A-Z0-9_]+$/u,
                message: 'Use apenas letras maiúsculas, números e _.',
              },
            })}
            helperText={errors.slug?.message ?? 'Use letras maiúsculas, números e _.'}
          />
          <Field
            label="Descrição"
            placeholder="Descreva quando utilizar esta função"
            {...register('description')}
            helperText="Opcional"
          />
          <div className="space-y-3">
            <p className="text-sm font-semibold text-brand-escuro">Módulos iniciais ({createSelectedCount})</p>
            {modulesQuery.error ? (
              <p className="text-sm text-red-600">Não foi possível carregar os módulos disponíveis.</p>
            ) : null}
            {availableModules.map((module) => {
              const checked = createSelectedModules.has(module.id);
              const checkboxId = `create-module-${module.id}`;
              return (
                <label
                  key={module.id}
                  htmlFor={checkboxId}
                  className="flex items-center justify-between gap-4 rounded-xl border border-brand-azul/40 bg-white/70 px-4 py-3"
                  aria-label={`Selecionar módulo ${module.name}`}
                >
                  <div>
                    <p className="font-semibold text-brand-escuro">{module.name}</p>
                    <p className="text-sm text-brand-grafite/70">{module.description ?? 'Sem descrição cadastrada.'}</p>
                  </div>
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    onChange={() => {
                      setCreateSelectedModules((prev) => {
                        const next = new Set(prev);
                        if (next.has(module.id)) {
                          next.delete(module.id);
                        } else {
                          next.add(module.id);
                        }
                        return next;
                      });
                    }}
                  />
                </label>
              );
            })}
            {!availableModules.length ? (
              <p className="text-sm text-brand-grafite/60">Nenhum módulo cadastrado até o momento.</p>
            ) : null}
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(moduleModalRole)}
        onClose={closeModulesModal}
        title={moduleModalRole ? `Ajustar módulos de ${moduleModalRole.name}` : 'Ajustar módulos'}
        description="Marque os módulos que a função poderá acessar."
        actions={
          <>
            <Button variant="ghost" onClick={closeModulesModal}>
              Cancelar
            </Button>
            <Button onClick={saveModules} disabled={updateRoleModules.isPending || modulesQuery.isLoading}>
              Salvar ({selectedCount})
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {modulesQuery.error ? (
            <p className="text-sm text-red-600">Não foi possível carregar os módulos disponíveis.</p>
          ) : null}
          {availableModules.map((module) => {
            const checkboxId = `role-module-${module.id}`;
            return (
              <label
                key={module.id}
                htmlFor={checkboxId}
                className="flex items-center justify-between gap-4 rounded-xl border border-brand-azul/40 bg-white/70 px-4 py-3"
                aria-label={`Selecionar módulo ${module.name}`}
              >
                <div>
                  <p className="font-semibold text-brand-escuro">{module.name}</p>
                  <p className="text-sm text-brand-grafite/70">{module.description ?? 'Sem descrição cadastrada.'}</p>
                </div>
                <input
                  id={checkboxId}
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedModuleIds.has(module.id)}
                  onChange={() => toggleModuleSelection(module.id)}
                />
              </label>
            );
          })}
          {!availableModules.length ? (
            <p className="text-sm text-brand-grafite/60">Nenhum módulo cadastrado até o momento.</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export default RolesPage;
