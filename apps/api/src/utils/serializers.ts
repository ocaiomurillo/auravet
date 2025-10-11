import { Animal, Owner, Servico } from '@prisma/client';

type ServicoWithRelations = Servico & {
  createdAt: Date;
  data: Date;
  animal?: AnimalWithRelations;
};

type AnimalWithRelations = Animal & {
  createdAt: Date;
  nascimento: Date | null;
  owner?: Owner | null;
  services?: ServicoWithRelations[];
};

type OwnerWithRelations = Owner & {
  createdAt: Date;
  animals?: AnimalWithRelations[];
};

export const serializeService = (
  service: ServicoWithRelations,
  options?: { includeAnimal?: boolean },
) => {
  const serialized = {
    ...service,
    data: service.data.toISOString(),
    createdAt: service.createdAt.toISOString(),
    preco: Number(service.preco),
  };

  if (options?.includeAnimal && service.animal) {
    serialized.animal = serializeAnimal({
      ...service.animal,
      services: undefined,
    });
  } else {
    delete (serialized as Partial<typeof serialized>).animal;
  }

  return serialized;
};

export const serializeAnimal = (animal: AnimalWithRelations) => ({
  ...animal,
  createdAt: animal.createdAt.toISOString(),
  nascimento: animal.nascimento ? animal.nascimento.toISOString() : null,
  owner: animal.owner
    ? {
        ...animal.owner,
        createdAt: animal.owner.createdAt.toISOString(),
      }
    : undefined,
  services: animal.services?.map((service) => serializeService(service)),
});

export const serializeOwner = (owner: OwnerWithRelations) => ({
  ...owner,
  createdAt: owner.createdAt.toISOString(),
  animals: owner.animals?.map((animal) =>
    serializeAnimal({
      ...animal,
      services: animal.services?.map((service) => ({ ...service, animal: undefined })),
    }),
  ),
});
