import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import Modal from '../components/Modal';
import type { PaymentConditionDetails } from '../types/api';
import { paymentConditionsApi, type PaymentConditionPayload } from '../lib/apiClient';

interface PaymentConditionFormValues {
  nome: string;
  prazoDias: number;
  parcelas: number;
  observacoes: string;
}

const defaultValues: PaymentConditionFormValues = {
  nome: '',
  prazoDias: 0,
  parcelas: 1,
  observacoes: '',
};

const PaymentConditionsPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<PaymentConditionDetails | null>(null);

  const { data: conditions, isLoading, error } = useQuery<PaymentConditionDetails[], Error>({
    queryKey: ['payment-conditions'],
    queryFn: paymentConditionsApi.list,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<PaymentConditionFormValues>({
    defaultValues,
  });

  const sortedConditions = useMemo(
    () => [...(conditions ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)),
    [conditions],
  );

  const openCreateModal = () => {
    setEditingCondition(null);
    reset({ ...defaultValues });
    setIsModalOpen(true);
  };

  const openEditModal = (condition: PaymentConditionDetails) => {
    setEditingCondition(condition);
    reset({
      nome: condition.nome,
      prazoDias: condition.prazoDias,
      parcelas: condition.parcelas,
      observacoes: condition.observacoes ?? '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCondition(null);
    reset({ ...defaultValues });
  };

  const createCondition = useMutation({
    mutationFn: (payload: PaymentConditionPayload) => paymentConditionsApi.create(payload),
    onSuccess: () => {
      toast.success('Condição de pagamento cadastrada com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['payment-conditions'] });
      closeModal();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cadastrar a condição.');
    },
  });

  const updateCondition = useMutation({
    mutationFn: ({ id, ...payload }: PaymentConditionPayload & { id: string }) =>
      paymentConditionsApi.update(id, payload),
    onSuccess: () => {
      toast.success('Condição atualizada.');
      queryClient.invalidateQueries({ queryKey: ['payment-conditions'] });
      closeModal();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar a condição.');
    },
  });

  const deleteCondition = useMutation({
    mutationFn: (id: string) => paymentConditionsApi.remove(id),
    onSuccess: () => {
      toast.success('Condição removida.');
      queryClient.invalidateQueries({ queryKey: ['payment-conditions'] });
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Não foi possível remover a condição. Verifique se ela está em uso em alguma fatura.',
      );
    },
  });

  const onSubmit = handleSubmit((values) => {
    const payload: PaymentConditionPayload = {
      nome: values.nome.trim(),
      prazoDias: Number(values.prazoDias),
      parcelas: Number(values.parcelas),
      observacoes: values.observacoes.trim().length > 0 ? values.observacoes : null,
    };

    if (payload.prazoDias < 0 || Number.isNaN(payload.prazoDias)) {
      toast.error('Informe um prazo em dias válido.');
      return;
    }

    if (payload.parcelas <= 0 || Number.isNaN(payload.parcelas)) {
      toast.error('O número de parcelas deve ser maior que zero.');
      return;
    }

    if (editingCondition) {
      updateCondition.mutate({ id: editingCondition.id, ...payload });
    } else {
      createCondition.mutate(payload);
    }
  });

  const handleDelete = async (condition: PaymentConditionDetails) => {
    const confirmed = window.confirm(
      'Tem certeza que deseja remover esta condição? Se já tiver sido usada em faturas ela não poderá ser excluída.',
    );
    if (!confirmed) return;

    await deleteCondition.mutateAsync(condition.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Formas e condições</h1>
          <p className="text-sm text-brand-grafite/70">
            Cadastre prazos, parcelas e observações para padronizar como as cobranças são exibidas no caixa.
          </p>
        </div>
        <Button onClick={openCreateModal}>Nova condição</Button>
      </div>

      <Card title="Condições cadastradas" description="Edite ou remova condições de pagamento utilizadas pelo caixa.">
        {isLoading ? (
          <p className="text-sm text-brand-grafite/70">Carregando condições...</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error.message}</p>
        ) : sortedConditions.length === 0 ? (
          <p className="text-sm text-brand-grafite/70">Nenhuma condição cadastrada até o momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-azul/20">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-brand-grafite/60">
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Prazo (dias)</th>
                  <th className="px-4 py-2">Parcelas</th>
                  <th className="px-4 py-2">Observações</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-azul/10">
                {sortedConditions.map((condition) => (
                  <tr key={condition.id} className="text-sm text-brand-grafite/80">
                    <td className="px-4 py-3 font-semibold text-brand-escuro">{condition.nome}</td>
                    <td className="px-4 py-3">{condition.prazoDias}</td>
                    <td className="px-4 py-3">{condition.parcelas}</td>
                    <td className="px-4 py-3 text-sm text-brand-grafite/70">
                      {condition.observacoes ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => openEditModal(condition)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-3 py-1 text-xs text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(condition)}
                          disabled={deleteCondition.isPending}
                        >
                          Remover
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingCondition ? 'Editar condição' : 'Nova condição'}
        description="Defina prazos, parcelas e uma descrição clara para orientar o time do caixa."
        actions={
          <>
            <Button variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button onClick={onSubmit} disabled={isSubmitting || createCondition.isPending || updateCondition.isPending}>
              {isSubmitting || createCondition.isPending || updateCondition.isPending
                ? 'Salvando...'
                : 'Salvar condição'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field
            label="Nome da condição"
            placeholder="Ex.: Cartão de crédito, Boleto em 30 dias"
            {...register('nome', { required: true })}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Prazo em dias"
              type="number"
              min={0}
              {...register('prazoDias', { valueAsNumber: true })}
            />
            <Field
              label="Número de parcelas"
              type="number"
              min={1}
              {...register('parcelas', { valueAsNumber: true })}
            />
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-brand-grafite">
            <span className="font-semibold text-brand-escuro">Observações</span>
            <textarea
              className="w-full rounded-xl border border-brand-azul/60 bg-white/90 px-4 py-2 text-brand-grafite shadow-inner focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/50"
              rows={3}
              placeholder="Instruções adicionais, taxas ou combinados específicos"
              {...register('observacoes')}
            />
          </label>
        </form>
      </Modal>
    </div>
  );
};

export default PaymentConditionsPage;
