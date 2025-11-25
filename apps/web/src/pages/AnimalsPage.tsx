import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import Modal from '../components/Modal';
import SelectField from '../components/SelectField';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/apiClient';
import type { Animal, AttendanceStatus, Owner } from '../types/api';
import { getAttendanceTotal } from '../utils/attendance';
import { buildOwnerAddress, formatCpf } from '../utils/owner';

interface AnimalFormValues {
  nome: string;
  especie: Animal['especie'];
  raca?: string;
  nascimento?: string;
  ownerId: string;
}

const specieLabels: Record<Animal['especie'], string> = {
  CACHORRO: 'Cachorro',
  GATO: 'Gato',
  OUTROS: 'Outros',
};

const AnimalsPage = () => {
  const location = useLocation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [filterName, setFilterName] = useState('');
  const [filterTutor, setFilterTutor] = useState('');
  const [filterSpecie, setFilterSpecie] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<AttendanceStatus | ''>('');
  const [attendanceStartDate, setAttendanceStartDate] = useState('');
  const [attendanceEndDate, setAttendanceEndDate] = useState('');

  const queryClient = useQueryClient();
  const { hasModule } = useAuth();
  const canManageAnimals = hasModule('animals:write');
  const canRegisterAttendances = hasModule('services:write');
  const canViewAttendances = hasModule('services:read');

  const { data: animals, isLoading, error } = useQuery({
    queryKey: ['animals'],
    queryFn: () => apiClient.get<Animal[]>('/animals'),
  });

  const { data: owners } = useQuery({
    queryKey: ['owners'],
    queryFn: () => apiClient.get<Owner[]>('/owners'),
  });

  const { register, handleSubmit, reset } = useForm<AnimalFormValues>({
    defaultValues: {
      nome: '',
      especie: 'CACHORRO',
      raca: '',
      nascimento: '',
      ownerId: '',
    },
  });

  const selectedAnimal = useMemo(
    () => animals?.find((animal) => animal.id === selectedAnimalId) ?? null,
    [animals, selectedAnimalId],
  );
  const selectedOwner = selectedAnimal?.owner ?? null;
  const selectedOwnerCpf = formatCpf(selectedOwner?.cpf);
  const selectedOwnerAddress = selectedOwner ? buildOwnerAddress(selectedOwner) : null;
  const attendances = useMemo(() => selectedAnimal?.services ?? [], [selectedAnimal]);

  const filteredAnimals = useMemo(() => {
    if (!animals) return [];

    const normalize = (value: string) => value.toLowerCase();

    return animals.filter((animal) => {
      const matchesName = animal.nome ? normalize(animal.nome).includes(normalize(filterName)) : false;
      const matchesTutor = animal.owner?.nome
        ? normalize(animal.owner.nome).includes(normalize(filterTutor))
        : false;
      const matchesSpecie = filterSpecie ? animal.especie === filterSpecie : true;

      return (!filterName || matchesName) && (!filterTutor || matchesTutor) && matchesSpecie;
    });
  }, [animals, filterName, filterTutor, filterSpecie]);

  const filteredAttendances = useMemo(() => {
    return attendances.filter((attendance) => {
      const attendanceDate = new Date(attendance.data);
      const startMatch = attendanceStartDate ? attendanceDate >= new Date(attendanceStartDate) : true;
      const endMatch = attendanceEndDate ? attendanceDate <= new Date(attendanceEndDate) : true;
      const statusMatch = attendanceStatusFilter ? attendance.status === attendanceStatusFilter : true;
      return startMatch && endMatch && statusMatch;
    });
  }, [attendances, attendanceEndDate, attendanceStartDate, attendanceStatusFilter]);
  useEffect(() => {
    const highlight = (location.state as { highlight?: string } | null)?.highlight;
    if (highlight) {
      setSelectedAnimalId(highlight);
    }
  }, [location.state]);


  const openCreateModal = () => {
    setEditingAnimal(null);
    reset({ nome: '', especie: 'CACHORRO', raca: '', nascimento: '', ownerId: '' });
    setModalOpen(true);
  };

  const openEditModal = (animal: Animal) => {
    setEditingAnimal(animal);
    reset({
      nome: animal.nome,
      especie: animal.especie,
      raca: animal.raca ?? '',
      nascimento: animal.nascimento ? animal.nascimento.substring(0, 10) : '',
      ownerId: animal.ownerId,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAnimal(null);
    reset();
  };

  const createAnimal = useMutation({
    mutationFn: (payload: AnimalFormValues) => apiClient.post<Animal>('/animals', payload),
    onSuccess: () => {
      toast.success('Pet cadastrado na Auravet.');
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      closeModal();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar o animal.');
    },
  });

  const updateAnimal = useMutation({
    mutationFn: ({ id, ...payload }: AnimalFormValues & { id: string }) =>
      apiClient.put<Animal>(`/animals/${id}`, payload),
    onSuccess: () => {
      toast.success('Dados do pet atualizados.');
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      closeModal();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o animal.');
    },
  });

  const deleteAnimal = useMutation({
    mutationFn: (animalId: string) => apiClient.delete(`/animals/${animalId}`),
    onSuccess: (_, deletedAnimalId) => {
      toast.success('Animal removido com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      if (selectedAnimalId === deletedAnimalId) {
        setSelectedAnimalId(null);
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover o animal.');
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (editingAnimal) {
      updateAnimal.mutate({ id: editingAnimal.id, ...values });
    } else {
      createAnimal.mutate(values);
    }
  });

  const handleExportAnimals = () => {
    if (!filteredAnimals.length) return;

    const headers = ['Nome', 'Espécie', 'Raça', 'Tutor', 'Nascimento'];
    const rows = filteredAnimals.map((animal) => [
      animal.nome ?? '',
      specieLabels[animal.especie] ?? '',
      animal.raca ?? '',
      animal.owner?.nome ?? '',
      animal.nascimento ? new Date(animal.nascimento).toLocaleDateString('pt-BR') : '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const safeCell = cell.replace(/"/g, '""');
            return `"${safeCell}"`;
          })
          .join(','),
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'animais.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportAttendances = () => {
    if (!filteredAttendances.length) return;

    const headers = ['Data', 'Responsável', 'Assistente', 'Valor', 'Notas'];
    const rows = filteredAttendances.map((attendance) => {
      const attendanceTotal = getAttendanceTotal(attendance);
      const notes = attendance.notes?.map((note) => `${note.author.nome}: ${note.conteudo}`).join(' | ') ?? '';

      return [
        new Date(attendance.data).toLocaleDateString('pt-BR'),
        attendance.responsavel?.nome ?? '',
        attendance.assistant?.nome ?? '',
        `R$ ${attendanceTotal.toFixed(2)}`,
        notes || attendance.observacoes || '',
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const safeCell = cell.replace(/"/g, '""');
            return `"${safeCell}"`;
          })
          .join(','),
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedAnimal?.nome ?? 'pet'}-atendimentos.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Pets</h1>
          <p className="text-sm text-brand-grafite/70">
            Cada pet carrega uma história. Visualize tutores, espécie e histórico de atendimentos em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRegisterAttendances ? (
            <Button variant="secondary" asChild>
              <Link to="/new-service">Registrar Atendimento</Link>
            </Button>
          ) : null}
          {canManageAnimals ? <Button onClick={openCreateModal}>Novo Pet</Button> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
        <Card
          title="Pets acompanhados"
          description="Toque em um pet para abrir o histórico completo."
          actions={
            <div className="flex gap-2">
              <Button variant="ghost" className="text-sm" onClick={handleExportAnimals}>
                Exportar lista
              </Button>
            </div>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Buscar por pet"
              placeholder="Nome do pet"
              value={filterName}
              onChange={(event) => setFilterName(event.target.value)}
            />
            <Field
              label="Tutor"
              placeholder="Nome do tutor"
              value={filterTutor}
              onChange={(event) => setFilterTutor(event.target.value)}
            />
            <SelectField
              label="Espécie"
              value={filterSpecie}
              onChange={(event) => setFilterSpecie(event.target.value)}
            >
              <option value="">Todas</option>
              {Object.entries(specieLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
          {isLoading ? <p>Carregando pets...</p> : null}
          {error ? <p className="text-red-500">Não foi possível carregar os pets.</p> : null}
          {filteredAnimals.length ? (
            <ul className="space-y-3">
              {filteredAnimals.map((animal) => (
                <li
                  key={animal.id}
                  className={`rounded-2xl border p-4 transition hover:border-brand-escuro/50 ${
                    selectedAnimalId === animal.id
                      ? 'border-brand-escuro/70 bg-brand-azul/40'
                      : 'border-brand-azul/30 bg-white/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => setSelectedAnimalId(animal.id)}
                    >
                      <p className="font-montserrat text-lg font-semibold text-brand-escuro">{animal.nome}</p>
                      <p className="text-sm text-brand-grafite/70">
                        {specieLabels[animal.especie]} • Tutor(a): {animal.owner?.nome ?? '—'}
                      </p>
                      {animal.raca ? (
                        <p className="text-xs uppercase tracking-wide text-brand-grafite/60">{animal.raca}</p>
                      ) : null}
                    </button>
                    {canManageAnimals ? (
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => openEditModal(animal)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-red-600 hover:bg-red-100"
                          onClick={() => deleteAnimal.mutate(animal.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {!isLoading && !filteredAnimals.length ? (
            <p className="text-sm text-brand-grafite/70">
              Comece cadastrando os pets dos tutores para ativar acompanhamentos personalizados.
            </p>
          ) : null}
        </Card>

        <Card
          title="Histórico do pet"
          description="Atendimentos realizados com datas e valores."
          actions={
            selectedAnimal && canViewAttendances ? (
              <Button variant="ghost" className="text-sm" onClick={handleExportAttendances}>
                Exportar atendimentos
              </Button>
            ) : undefined
          }
        >
          {selectedAnimal ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-brand-azul/40 p-4">
                <p className="font-montserrat text-lg font-semibold text-brand-escuro">
                  {selectedAnimal.nome}
                </p>
                <p className="text-sm text-brand-grafite/70">
                  {specieLabels[selectedAnimal.especie]} • Tutor(a): {selectedAnimal.owner?.nome ?? '—'}
                </p>
                {selectedAnimal.nascimento ? (
                  <p className="text-xs uppercase tracking-wide text-brand-grafite/60">
                    Nascimento: {new Date(selectedAnimal.nascimento).toLocaleDateString('pt-BR')}
                  </p>
                ) : null}
                {selectedOwner ? (
                  <div className="mt-3 rounded-xl border border-brand-azul/20 bg-white/80 p-3 text-xs text-brand-grafite/70">
                    <p className="font-semibold text-brand-escuro">Contato do tutor</p>
                    <p>{selectedOwner.email}</p>
                    {selectedOwner.telefone ? <p>{selectedOwner.telefone}</p> : null}
                    {selectedOwnerCpf ? <p>CPF: {selectedOwnerCpf}</p> : null}
                    {selectedOwnerAddress ? <p>{selectedOwnerAddress}</p> : null}
                  </div>
                ) : null}
              </div>
                {canViewAttendances ? (
                  <div className="flex justify-end">
                    <Button variant="ghost" className="px-3 py-2 text-sm" asChild>
                      <Link to={`/animals/${selectedAnimalId}/attendances`}>Abrir histórico completo</Link>
                    </Button>
                  </div>
                ) : null}

              {canViewAttendances ? (
                filteredAttendances.length ? (
                  <>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Field
                        label="Início"
                        type="date"
                        value={attendanceStartDate}
                        onChange={(event) => setAttendanceStartDate(event.target.value)}
                      />
                      <Field
                        label="Fim"
                        type="date"
                        value={attendanceEndDate}
                        onChange={(event) => setAttendanceEndDate(event.target.value)}
                      />
                      <SelectField
                        label="Status"
                        value={attendanceStatusFilter}
                        onChange={(event) => setAttendanceStatusFilter(event.target.value as AttendanceStatus | '')}
                      >
                        <option value="">Todos</option>
                        <option value="EM_ANDAMENTO">Em andamento</option>
                        <option value="CANCELADO">Cancelado</option>
                        <option value="CONCLUIDO">Concluído</option>
                      </SelectField>
                    </div>
                    <ul className="space-y-3">
                      {filteredAttendances.map((attendance) => (
                        <li key={attendance.id} className="rounded-2xl border border-brand-azul/30 bg-white/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-brand-escuro">{attendance.tipo}</p>
                              <p className="text-sm text-brand-grafite/70">
                                {new Date(attendance.data).toLocaleDateString('pt-BR')} • R${' '}
                                {getAttendanceTotal(attendance).toFixed(2)}
                              </p>
                              {attendance.responsavel ? (
                                <p className="text-sm text-brand-grafite/70">Responsável: {attendance.responsavel.nome}</p>
                              ) : null}
                              {attendance.assistant ? (
                                <p className="text-sm text-brand-grafite/70">Assistente: {attendance.assistant.nome}</p>
                              ) : null}
                            </div>
                            {canRegisterAttendances ? (
                              <Button variant="ghost" className="text-sm" asChild>
                                <Link to={`/services/${attendance.id}/edit`}>Editar</Link>
                              </Button>
                            ) : null}
                          </div>
                        {(attendance.notes?.length ?? 0) > 0 ? (
                          <ul className="mt-3 space-y-2 text-sm text-brand-grafite/80">
                            {attendance.notes.map((note) => (
                              <li key={note.id} className="rounded-xl bg-brand-azul/10 p-2">
                                <p className="font-semibold text-brand-escuro">{note.author.nome}</p>
                                <p className="text-xs text-brand-grafite/60">
                                  {new Date(note.createdAt).toLocaleString('pt-BR')}
                                </p>
                                <p className="mt-1 leading-snug text-brand-grafite">{note.conteudo}</p>
                              </li>
                            ))}
                          </ul>
                        ) : attendance.observacoes ? (
                          <p className="text-sm text-brand-grafite/80">{attendance.observacoes}</p>
                        ) : null}
                      </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-brand-grafite/70">
                    Nenhum atendimento registrado ainda. Que tal registrar o primeiro cuidado?
                  </p>
                )
              ) : (
                <p className="text-sm text-brand-grafite/70">
                  Você não possui permissão para visualizar o histórico clínico deste pet.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-brand-grafite/70">
              Selecione um pet na lista ao lado para visualizar o histórico de carinho clínico.
            </p>
          )}
        </Card>
      </div>

      {canManageAnimals ? (
        <Modal
          open={modalOpen}
          onClose={closeModal}
          title={editingAnimal ? 'Editar pet' : 'Novo pet Auravet'}
          description="Quanto mais detalhes, mais personalizada fica a jornada de bem-estar do animal."
          actions={
            <>
              <Button variant="ghost" onClick={closeModal}>
                Cancelar
              </Button>
              <Button type="submit" form="animal-form">
                {editingAnimal ? 'Salvar' : 'Cadastrar pet'}
              </Button>
            </>
          }
        >
          <form id="animal-form" className="space-y-4" onSubmit={onSubmit}>
            <Field label="Nome" placeholder="Nome do pet" required {...register('nome')} />
            <SelectField label="Espécie" required {...register('especie')}>
              {Object.entries(specieLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <Field label="Raça" placeholder="Opcional" {...register('raca')} />
            <Field label="Data de nascimento" type="date" {...register('nascimento')} />
            <SelectField label="Tutor" required {...register('ownerId')}>
              <option value="">Selecione um tutor</option>
              {owners?.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.nome}
                </option>
              ))}
            </SelectField>
          </form>
        </Modal>
      ) : null}
    </div>
  );
};

export default AnimalsPage;
