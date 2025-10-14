import type { Owner } from '../types/api';

export const formatCpf = (cpf?: string | null) => {
  if (!cpf) {
    return null;
  }

  const digits = cpf.replace(/\D/g, '');

  if (digits.length !== 11) {
    return cpf;
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const formatCep = (cep?: string | null) => {
  if (!cep) {
    return null;
  }

  const digits = cep.replace(/\D/g, '');

  if (digits.length !== 8) {
    return cep;
  }

  return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
};

export const buildOwnerAddress = (owner: Owner) => {
  const pieces: string[] = [];

  const street = [owner.logradouro, owner.numero].filter(Boolean).join(', ');
  if (street) {
    pieces.push(street);
  }

  if (owner.complemento) {
    pieces.push(owner.complemento);
  }

  if (owner.bairro) {
    pieces.push(owner.bairro);
  }

  const cityState = owner.cidade && owner.estado ? `${owner.cidade} - ${owner.estado}` : owner.cidade ?? owner.estado;
  if (cityState) {
    pieces.push(cityState);
  }

  const cep = formatCep(owner.cep);
  if (cep) {
    pieces.push(`CEP ${cep}`);
  }

  return pieces.length ? pieces.join(' • ') : null;
};
