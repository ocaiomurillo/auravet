export interface ApiErrorLike extends Error {
  status?: number;
  details?: unknown;
}

export const formatApiErrorMessage = (
  error: unknown,
  fallbackMessage = 'Não foi possível concluir a solicitação.',
): string => {
  const status = (error as ApiErrorLike | undefined)?.status;
  const baseMessage = error instanceof Error ? error.message : fallbackMessage;

  if (typeof status === 'number') {
    return `Erro ${status}: ${baseMessage}`;
  }

  return baseMessage;
};
