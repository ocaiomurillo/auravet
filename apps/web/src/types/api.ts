export interface Module {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleModule extends Module {
  isEnabled: boolean;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  modules: RoleModule[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleSummary {
  id: string;
  slug: string;
  name: string;
}

export interface Owner {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  cpf?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  createdAt: string;
  animals?: Animal[];
}

export type OwnerSummary = Pick<Owner, 'id' | 'nome' | 'email' | 'telefone' | 'cpf' | 'createdAt'>;

export interface Animal {
  id: string;
  nome: string;
  especie: 'CACHORRO' | 'GATO' | 'OUTROS';
  raca?: string | null;
  nascimento?: string | null;
  ownerId: string;
  createdAt: string;
  owner?: Owner;
  services?: Service[];
}

export interface Service {
  id: string;
  animalId: string;
  tipo: 'CONSULTA' | 'EXAME' | 'VACINACAO' | 'CIRURGIA' | 'OUTROS';
  data: string;
  preco: number;
  observacoes?: string | null;
  createdAt: string;
  appointmentId: string | null;
  animal?: Animal;
  catalogItems: ServiceCatalogItem[];
  items: ServiceItem[];
  responsavel: ServiceResponsible | null;
}

export interface ServiceItem {
  id: string;
  productId: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  product: {
    id: string;
    nome: string;
    precoVenda: number;
    estoqueAtual: number;
    estoqueMinimo: number;
  };
}

export interface ServiceDefinition {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: Service['tipo'];
  precoSugerido: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCatalogItem {
  id: string;
  serviceDefinitionId: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  observacoes: string | null;
  definition: ServiceDefinition;
}

export interface ServiceResponsible {
  id: string;
  nome: string;
  email: string;
}

export interface InvoiceStatus {
  id: string;
  slug: string;
  name: string;
}

export interface InvoiceItemProductSummary {
  id: string;
  nome: string;
}

export interface InvoiceItemServiceSummary {
  id: string;
  tipo: Service['tipo'];
  data: string;
  animal?: {
    id: string;
    nome: string;
    owner?: { id: string; nome: string };
  };
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  servicoId: string | null;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  product: InvoiceItemProductSummary | null;
  service: InvoiceItemServiceSummary | null;
}

export interface Invoice {
  id: string;
  ownerId: string;
  status: InvoiceStatus;
  total: number;
  dueDate: string;
  paidAt: string | null;
  paymentNotes: string | null;
  createdAt: string;
  updatedAt: string;
  owner: Owner;
  responsible: {
    id: string;
    nome: string;
    email: string;
  } | null;
  items: InvoiceItem[];
}

export interface InvoiceSummary {
  openTotal: number;
  paidTotal: number;
  openCount: number;
  paidCount: number;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  summary: InvoiceSummary;
}

export interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  custo: number;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  isActive: boolean;
  isSellable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  nome: string;
  email: string;
  role: UserRoleSummary;
  isActive: boolean;
  lastLoginAt: string | null;
  modules: string[];
  createdAt: string;
  updatedAt: string;
  collaboratorProfile: CollaboratorProfile | null;
}

export interface AuthLoginResponse {
  token: string;
  user: User;
}

export interface CollaboratorProfile {
  especialidade?: string | null;
  crmv?: string | null;
  turnos: string[];
  bio?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollaboratorSummary {
  id: string;
  nome: string;
  email: string;
  role: UserRoleSummary;
  collaboratorProfile: CollaboratorProfile | null;
}

export interface AppointmentAvailability {
  veterinarianConflict: boolean;
  assistantConflict: boolean;
}

export interface Appointment {
  id: string;
  animalId: string;
  ownerId: string;
  veterinarianId: string;
  assistantId: string | null;
  serviceId: string | null;
  status: 'AGENDADO' | 'CONFIRMADO' | 'CONCLUIDO';
  scheduledStart: string;
  scheduledEnd: string;
  confirmedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  durationMinutes: number;
  availability: AppointmentAvailability;
  animal: Animal;
  owner: Owner;
  veterinarian: CollaboratorSummary;
  assistant: CollaboratorSummary | null;
  service: Service | null;
}

export interface AppointmentCalendarSummary {
  total: number;
  confirmed: number;
  concluded: number;
  pending: number;
  capacity: {
    totalSlots: number | null;
    bookedSlots: number;
    availableSlots: number | null;
  };
}

export interface AppointmentCalendarResponse {
  view: 'day' | 'week' | 'month';
  range: { start: string; end: string };
  appointments: Appointment[];
  summary: AppointmentCalendarSummary;
}

export interface DashboardAppointmentsSummary {
  scheduled: number;
  confirmed: number;
  completed: number;
  today: number;
  upcomingWeek: number;
}

export interface DashboardProductsSummary {
  critical: number;
  lowStock: number;
  totalActive: number;
}

export interface DashboardEntitySummary {
  total: number;
}

export interface DashboardSummary {
  appointments?: DashboardAppointmentsSummary;
  products?: DashboardProductsSummary;
  owners?: DashboardEntitySummary;
  animals?: DashboardEntitySummary;
  receivables?: InvoiceSummary;
}

export interface DashboardSummaryResponse {
  summary: DashboardSummary;
}
