import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import { apiClient } from '../lib/apiClient';
import type { Animal, Owner, Service } from '../types/api';

interface ServiceFormValues {
  ownerId: string;
  animalId: string;
  tipo: Service['tipo'];
  data: string;
  preco: string;
  observacoes?: string;
}

const serviceLabels: Record<Service['tipo'], string> = {
  CONSULTA: 'Consulta',
  EXAME: 'Exame',
  VACINACAO: 'Vacinação',
  CIRURGIA: 'Cirurgia',
  OUTROS: 'Outros cuidados',
};

const NewServicePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, reset, setValue } = useForm<ServiceFormValues>({
    defaultValues: {
      ownerId: '',
      animalId: '',
      tipo: 'CONSULTA',
      data: '',
      preco: '',
      observacoes: '',
    },
  });

  const ownerId = watch('ownerId');

  const { data: owners } = useQuery({
    queryKey: ['owners'],
    queryFn: () => apiClient.get<Owner[]>('/owners'),
  });

  const { data: animals } = useQuery({
    queryKey: ['animals', ownerId],
    queryFn: () =>
      ownerId ? apiClient.get<Animal[]>(`/animals?ownerId=${ownerId}`) : apiClient.get<Animal[]>('/animals'),
  });

  useEffect(() => {
    setValue('animalId', '');
  }, [ownerId, setValue]);

  const createService = useMutation({
    mutationFn: (payload: Omit<ServiceFormValues, 'ownerId'>) => apiClient.post<Service>('/services', payload),
    onSuccess: (service) => {
      toast.success('Serviço registrado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      reset({ ownerId: '', animalId: '', tipo: 'CONSULTA', data: '', preco: '', observacoes: '' });
      navigate(`/animals`, { state: { highlight: service.animalId } });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o serviço.');
    },
  });

  const onSubmit = handleSubmit(({ ownerId: _owner, ...values }) => {
    if (!values.animalId) {
      toast.error('Selecione um pet para registrar o serviço.');
      return;
    }

    const normalizedPrice = values.preco.replace(',', '.');
    if (Number.isNaN(Number(normalizedPrice))) {
      toast.error('Informe um valor numérico válido.');
      return;
    }

    createService.mutate({ ...values, preco: normalizedPrice });
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Registrar serviço</h1>
          <p className="text-sm text-brand-grafite/70">
            Um registro detalhado fortalece o cuidado contínuo e inspira confiança nos tutores.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link to="/services">Voltar para serviços</Link>
        </Button>
      </div>

      <Card title="Dados do atendimento" description="Preencha com atenção para manter o histórico impecável.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <SelectField label="Tutor" required {...register('ownerId')}>
            <option value="">Selecione um tutor</option>
            {owners?.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.nome}
              </option>
            ))}
          </SelectField>

          <SelectField label="Pet" required {...register('animalId')}>
            <option value="">Selecione um pet</option>
            {animals?.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.nome} — Tutor(a): {animal.owner?.nome ?? '—'}
              </option>
            ))}
          </SelectField>

          <SelectField label="Tipo de serviço" required {...register('tipo')}>
            {Object.entries(serviceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <Field label="Data" type="date" required {...register('data')} />

          <Field label="Preço" type="number" step="0.01" min="0" placeholder="0,00" required {...register('preco')} />

          <label className="md:col-span-2">
            <span className="font-semibold text-brand-escuro">Observações</span>
            <textarea
              {...register('observacoes')}
              className="mt-1 w-full rounded-xl border border-brand-azul/60 bg-white/90 px-4 py-3 text-sm text-brand-grafite focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/50"
              rows={4}
              placeholder="Detalhes que ajudam a equipe a manter o cuidado alinhado."
            />
          </label>

          <div className="md:col-span-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => reset()}>
              Limpar
            </Button>
            <Button type="submit" disabled={createService.isPending}>
              {createService.isPending ? 'Registrando...' : 'Registrar serviço'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default NewServicePage;
