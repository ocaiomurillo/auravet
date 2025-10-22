import type { CollaboratorProfileInput } from '../schema/user';

const toNullable = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeCollaboratorProfileInput = (
  input: CollaboratorProfileInput,
): {
  especialidade?: string | null;
  crmv?: string | null;
  bio?: string | null;
  turnos?: string[];
  hasChanges: boolean;
} => {
  const especialidade = toNullable(input.especialidade ?? undefined);
  const crmv = toNullable(input.crmv ?? undefined);
  const bio = toNullable(input.bio ?? undefined);
  const turnos = input.turnos === undefined ? undefined : [...input.turnos];

  const hasChanges = [especialidade, crmv, bio, turnos].some((value) => value !== undefined);

  return { especialidade, crmv, bio, turnos, hasChanges };
};
