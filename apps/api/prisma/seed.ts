import { randomBytes, scrypt as scryptCallback } from 'crypto';

import {
  Prisma,
  PrismaClient,
  TipoServico,
  Especie,
  AppointmentStatus,
} from '@prisma/client';


const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

console.log('>>>> SEED AURAVET: INICIANDO <<<<');

const parseSaltRounds = () => {
  const rawValue = process.env.PASSWORD_SALT_ROUNDS;
  const parsedValue = rawValue ? Number(rawValue) : 10;

  if (!Number.isFinite(parsedValue)) {
    return 10;
  }

  return parsedValue;
};

const SCRYPT_COST = Math.min(Math.max(Math.round(parseSaltRounds()), 10), 18);
const SCRYPT_OPTIONS = { N: 2 ** SCRYPT_COST, r: 8, p: 1 } as const;

const runScrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey as Buffer);
    });
  });

const hashPassword = async (password: string) => {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = await runScrypt(password, salt);
  return `${SCRYPT_COST}:${salt}:${derivedKey.toString('hex')}`;
};

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@auravet.com';
const DEFAULT_ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Administrador Auravet';
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
const ADMIN_ROLE_SLUG = 'ADMINISTRADOR';

const DEFAULT_COLLABORATOR_PASSWORD =
  process.env.SEED_COLLABORATOR_PASSWORD ?? 'Auravet123!';

const DEFAULT_COLLABORATORS = [
  // ADMINISTRADOR
  {
    slug: 'ADMINISTRADOR',
    nome: 'Marina Duarte Azevedo',
    email: 'marina.azevedo@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Gestão Administrativa e Operacional',
      crmv: null,
      turnos: ['MANHA', 'TARDE'],
      bio: 'Responsável pela gestão da Auravet, coordenando equipe, agendas e experiência dos tutores e pets.',
    },
  },

  // MÉDICOS
  {
    slug: 'MEDICO',
    nome: 'Dr. Rafael Nogueira Prado',
    email: 'rafael.prado@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Clínica Geral e Medicina Preventiva',
      crmv: 'CRMV-SP 21457',
      turnos: ['MANHA', 'TARDE'],
      bio: 'Atua na linha de frente dos atendimentos gerais, com foco em check-ups, vacinação e orientação preventiva.',
    },
  },
  {
    slug: 'MEDICO',
    nome: 'Dra. Camila Teixeira Lins',
    email: 'camila.lins@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Dermatologia Veterinária',
      crmv: 'CRMV-SP 23109',
      turnos: ['MANHA', 'TARDE'],
      bio: 'Especialista em pele e alergias, acompanha casos crônicos e monta planos de tratamento de longo prazo.',
    },
  },
  {
    slug: 'MEDICO',
    nome: 'Dr. Lucas Almeida Furtado',
    email: 'lucas.furtado@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Ortopedia e Cirurgia de Tecidos Moles',
      crmv: 'CRMV-SP 21983',
      turnos: ['TARDE', 'NOITE'],
      bio: 'Focado em ortopedia e cirurgias, acompanha desde o pré-operatório até a reabilitação dos pacientes.',
    },
  },
  {
    slug: 'MEDICO',
    nome: 'Dra. Bianca Correia Menezes',
    email: 'bianca.menezes@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Cardiologia Veterinária',
      crmv: 'CRMV-SP 22864',
      turnos: ['TARDE', 'NOITE'],
      bio: 'Referência em cardiologia, realiza exames específicos e monitora pacientes com doenças cardíacas crônicas.',
    },
  },
  {
    slug: 'MEDICO',
    nome: 'Dr. Henrique Sales Pacheco',
    email: 'henrique.pacheco@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Emergência e Terapia Intensiva',
      crmv: 'CRMV-SP 23741',
      turnos: ['NOITE', 'MANHA'],
      bio: 'Responsável pela rotina de pronto-atendimento noturno, estabilização de casos graves e UTI.',
    },
  },

  // AUXILIARES ADMINISTRATIVOS
  {
    slug: 'AUXILIAR_ADMINISTRATIVO',
    nome: 'Juliana Costa Ribeiro',
    email: 'juliana.ribeiro@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Atendimento ao Cliente e Agendamento',
      crmv: null,
      turnos: ['MANHA', 'TARDE'],
      bio: 'Cuida da recepção, organização de agendas e primeiro contato dos tutores com a clínica.',
    },
  },
  {
    slug: 'AUXILIAR_ADMINISTRATIVO',
    nome: 'Bruno Henrique Matos',
    email: 'bruno.matos@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Central de Relacionamento com o Cliente',
      crmv: null,
      turnos: ['MANHA', 'TARDE'],
      bio: 'Responsável pelo contato via telefone e WhatsApp, confirmações de consulta e retorno de orçamentos.',
    },
  },

  // ASSISTENTES ADMINISTRATIVOS
  {
    slug: 'ASSISTENTE_ADMINISTRATIVO',
    nome: 'Carolina Pires Andrade',
    email: 'carolina.andrade@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Faturamento e Convênios',
      crmv: null,
      turnos: ['MANHA', 'TARDE'],
      bio: 'Faz a ponte entre clínica, convênios e tutores, garantindo clareza em orçamentos e cobranças.',
    },
  },
  {
    slug: 'ASSISTENTE_ADMINISTRATIVO',
    nome: 'Eduardo Lima Sanches',
    email: 'eduardo.sanches@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Compras e Suprimentos',
      crmv: null,
      turnos: ['MANHA', 'TARDE'],
      bio: 'Gerencia estoque de medicamentos, materiais e insumos, garantindo que a clínica esteja sempre abastecida.',
    },
  },

  // ENFERMEIROS
  {
    slug: 'ENFERMEIRO',
    nome: 'Enf. Vanessa Borges Freire',
    email: 'vanessa.freire@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Centro de Imunização e Coleta',
      crmv: null,
      turnos: ['MANHA', 'TARDE'],
      bio: 'Responsável por vacinas, coletas de exames e orientação de rotina de cuidados aos tutores.',
    },
  },
  {
    slug: 'ENFERMEIRO',
    nome: 'Enf. Thiago Ramos Silveira',
    email: 'thiago.silveira@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Preparação Pré-operatória',
      crmv: null,
      turnos: ['MANHA', 'TARDE'],
      bio: 'Organiza pacientes para cirurgias, faz triagem e acompanha sinais vitais antes dos procedimentos.',
    },
  },
  {
    slug: 'ENFERMEIRO',
    nome: 'Enf. Larissa Melo Coutinho',
    email: 'larissa.coutinho@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Pós-operatório e Reabilitação',
      crmv: null,
      turnos: ['TARDE', 'NOITE'],
      bio: 'Acompanha a recuperação dos pacientes, orienta tutores e cuida de curativos e medicações.',
    },
  },
  {
    slug: 'ENFERMEIRO',
    nome: 'Enf. Gustavo Vieira Campos',
    email: 'gustavo.campos@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Internação Clínica',
      crmv: null,
      turnos: ['TARDE', 'NOITE'],
      bio: 'Responsável pelos pacientes internados, controle de medicação e atualização diária dos tutores.',
    },
  },
  {
    slug: 'ENFERMEIRO',
    nome: 'Enf. Paula Regina Saldanha',
    email: 'paula.saldanha@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Emergência e UTI',
      crmv: null,
      turnos: ['NOITE', 'MANHA'],
      bio: 'Trabalha em conjunto com o plantonista noturno, monitorando casos críticos e suporte intensivo.',
    },
  },

  // CONTADOR
  {
    slug: 'CONTADOR',
    nome: 'Rodrigo Faria Montenegro',
    email: 'rodrigo.montenegro@auravet.com.br',
    password: DEFAULT_COLLABORATOR_PASSWORD,
    profile: {
      especialidade: 'Controladoria e Planejamento Financeiro',
      crmv: null,
      turnos: ['MANHA', 'TARDE'],
      bio: 'Cuida da saúde financeira da Auravet, projeções, fluxo de caixa e relacionamento com o escritório fiscal.',
    },
  },
] as const;

const DEFAULT_MODULES = [
  {
    slug: 'owners:read',
    name: 'Visualizar tutores',
    description: 'Permite visualizar a lista de tutores cadastrados.',
  },
  {
    slug: 'owners:write',
    name: 'Gerenciar tutores',
    description: 'Permite criar e editar tutores.',
  },
  {
    slug: 'animals:read',
    name: 'Visualizar animais',
    description: 'Permite visualizar animais cadastrados.',
  },
  {
    slug: 'animals:write',
    name: 'Gerenciar animais',
    description: 'Permite cadastrar e editar animais.',
  },
  {
    slug: 'services:read',
    name: 'Visualizar serviços',
    description: 'Permite visualizar os serviços prestados.',
  },
  {
    slug: 'services:write',
    name: 'Gerenciar serviços',
    description: 'Permite registrar e atualizar serviços.',
  },
  {
    slug: 'products:read',
    name: 'Visualizar produtos',
    description: 'Permite acompanhar o catálogo e estoque de produtos.',
  },
  {
    slug: 'products:write',
    name: 'Gerenciar produtos',
    description: 'Permite cadastrar produtos e ajustar estoque.',
  },
  {
    slug: 'users:manage',
    name: 'Administrar usuários',
    description: 'Permite criar e gerenciar usuários e funções.',
  },
  {
    slug: 'cashier:access',
    name: 'Caixa',
    description: 'Permite gerenciar contas a receber e registrar pagamentos.',
  },
] as const;

const DEFAULT_ROLES: Array<{
  slug: string;
  name: string;
  description?: string;
  modules: string[];
}> = [
  {
    slug: 'ADMINISTRADOR',
    name: 'Administrador',
    description: 'Acesso completo ao ecossistema Auravet.',
    modules: DEFAULT_MODULES.map((module) => module.slug),
  },
  {
    slug: 'AUXILIAR_ADMINISTRATIVO',
    name: 'Auxiliar Administrativo',
    modules: [
      'owners:read',
      'owners:write',
      'animals:read',
      'animals:write',
      'services:read',
      'services:write',
      'products:read',
      'products:write',
      'cashier:access',
    ],
  },
  {
    slug: 'ASSISTENTE_ADMINISTRATIVO',
    name: 'Assistente Administrativo',
    modules: [
      'owners:read',
      'animals:read',
      'services:read',
      'services:write',
      'products:read',
      'cashier:access',
    ],
  },
  {
    slug: 'ENFERMEIRO',
    name: 'Enfermeiro',
    modules: [
      'owners:read',
      'animals:read',
      'animals:write',
      'services:read',
      'services:write',
      'products:read',
      'products:write',
    ],
  },
  {
    slug: 'MEDICO',
    name: 'Médico',
    modules: ['owners:read', 'animals:read', 'services:read', 'services:write', 'products:read'],
  },
  {
    slug: 'CONTADOR',
    name: 'Contador',
    modules: ['services:read', 'products:read', 'cashier:access'],
  },
];

const DEFAULT_INVOICE_STATUSES = [
  { slug: 'ABERTA', name: 'Aberta' },
  { slug: 'QUITADA', name: 'Quitada' },
] as const;

const DEFAULT_OWNERS: Array<{
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}> = [
  {
    nome: 'Kauê Carlos Eduardo Silva',
    email: 'kaue-silva73@advogadostb.com.br',
    telefone: '14998555824',
    cpf: '16203656852',
    logradouro: 'Rua Antonio José da Silva',
    numero: '772',
    bairro: 'Vereador Eduardo Andrade Reis',
    cidade: 'Marília',
    estado: 'SP',
    cep: '17526710',
  },
  {
    nome: 'Victor Henry da Rosa',
    email: 'victor.henry.darosa@live.ie',
    telefone: '14994781561',
    cpf: '95975198879',
    logradouro: 'Rua Anelda Volta Brazini',
    numero: '343',
    bairro: 'Antonio Carlos Nascimento da Silva',
    cidade: 'Marília',
    estado: 'SP',
    cep: '17523893',
  },
  {
    nome: 'Alice Sophie Simone Nogueira',
    email: 'alice-nogueira95@pgpci.com.br',
    telefone: '14999580639',
    cpf: '36391897875',
    logradouro: 'Rua Leonel de Souza Barros',
    numero: '190',
    bairro: 'Jardim Tangará',
    cidade: 'Marília',
    estado: 'SP',
    cep: '17516022',
  },
  {
    nome: 'Ryan Enrico Severino Farias',
    email: 'ryanenricofarias@contabilidadevictoria.com.br',
    telefone: '14997730011',
    cpf: '87375166803',
    logradouro: 'Rua Anna Domingues',
    numero: '356',
    bairro: 'Conjunto Habitacional Vila dos Comerciários II',
    cidade: 'Marília',
    estado: 'SP',
    cep: '17527620',
  },
  {
    nome: 'André Felipe Castro',
    email: 'andre_castro@comercialrafael.com.br',
    telefone: '14988143419',
    cpf: '59602548835',
    logradouro: 'Rua Euclides da Silva Nunes',
    numero: '398',
    bairro: 'Jardim Morumbi',
    cidade: 'Marília',
    estado: 'SP',
    cep: '17526070',
  },
  {
    nome: 'Luna Betina Emily Martins',
    email: 'luna.betina.martins@valeguinchos.com.br',
    telefone: '14986676335',
    cpf: '11475173806',
    logradouro: 'Avenida Alípio Germano da Silva',
    numero: '760',
    bairro: 'Vila Romana',
    cidade: 'Marília',
    estado: 'SP',
    cep: '17514500',
  },
  {
    nome: 'Stella Larissa Vieira',
    email: 'stella.larissa.vieira@br.ibn.com',
    telefone: '14989882589',
    cpf: '35088007841',
    logradouro: 'Rua Tadaiti Ishida',
    numero: '877',
    bairro: 'Parque das Indústrias',
    cidade: 'Marília',
    estado: 'SP',
    cep: '17519720',
  },
  {
    nome: 'Vicente Elias Miguel da Cunha',
    email: 'vicenteeliasdacunha@plenamenterh.com.br',
    telefone: '14992714286',
    cpf: '00290259827',
    logradouro: 'Rua Sebastião Barreto',
    numero: '104',
    bairro: 'Jardim Trieste Cavichioli (Padre Nóbrega)',
    cidade: 'Marília',
    estado: 'SP',
    cep: '17533334',
  },
  {
    nome: 'Calebe Julio Rodrigues',
    email: 'calebe.julio.rodrigues@drimenezes.com',
    telefone: '14998414173',
    cpf: '47496005800',
    logradouro: 'Avenida Antônio Borella',
    numero: '116',
    bairro: 'Jardim São Domingos',
    cidade: 'Marília',
    estado: 'SP',
    cep: '17514747',
  },
  {
    nome: 'Nair Adriana Caldeira',
    email: 'nair_caldeira@focusdm.com.br',
    telefone: '14997774000',
    cpf: '19951358870',
    logradouro: 'Rua Carolina Moraes Almeida',
    numero: '545',
    bairro: 'Senador Salgado Filho',
    cidade: 'Marília',
    estado: 'SP',
    cep: '17502290',
  },
];

const DEFAULT_ANIMALS: Array<{
  nome: string;
  especie: Especie;
  raca?: string;
  nascimento?: Date;
  ownerEmail: string;
}> = [
  {
    nome: 'Trovão',
    especie: Especie.CACHORRO,
    raca: 'Akita',
    nascimento: new Date('2015-02-05'),
    ownerEmail: 'kaue-silva73@advogadostb.com.br',
  },
  {
    nome: 'Golias',
    especie: Especie.CACHORRO,
    raca: 'Rottweiler',
    nascimento: new Date('2016-05-07'),
    ownerEmail: 'victor.henry.darosa@live.ie',
  },
  {
    nome: 'Luna',
    especie: Especie.GATO,
    raca: 'SRD',
    nascimento: new Date('2018-09-12'),
    ownerEmail: 'alice-nogueira95@pgpci.com.br',
  },
  {
    nome: 'Titã',
    especie: Especie.CACHORRO,
    raca: 'Labrador Retriever',
    nascimento: new Date('2017-11-03'),
    ownerEmail: 'ryanenricofarias@contabilidadevictoria.com.br',
  },
  {
    nome: 'Amendoim',
    especie: Especie.GATO,
    raca: 'SRD',
    nascimento: new Date('2020-01-25'),
    ownerEmail: 'andre_castro@comercialrafael.com.br',
  },
  {
    nome: 'Nebulosa',
    especie: Especie.GATO,
    raca: 'Persa',
    nascimento: new Date('2021-08-29'),
    ownerEmail: 'luna.betina.martins@valeguinchos.com.br',
  },
  {
    nome: 'Eco',
    especie: Especie.GATO,
    raca: 'Siamês',
    nascimento: new Date('2019-10-10'),
    ownerEmail: 'stella.larissa.vieira@br.ibn.com',
  },
  {
    nome: 'Zéfiro',
    especie: Especie.CACHORRO,
    raca: 'Border Collie',
    nascimento: new Date('2020-12-08'),
    ownerEmail: 'vicenteeliasdacunha@plenamenterh.com.br',
  },
  {
    nome: 'Corvo',
    especie: Especie.GATO,
    raca: 'Bombay',
    nascimento: new Date('2015-04-04'),
    ownerEmail: 'calebe.julio.rodrigues@drimenezes.com',
  },
  {
    nome: 'Ônix',
    especie: Especie.GATO,
    raca: 'Bengal',
    nascimento: new Date('2020-03-09'),
    ownerEmail: 'nair_caldeira@focusdm.com.br',
  },
];

const DEFAULT_PRODUCTS: Array<{
  nome: string;
  descricao?: string;
  custo: number;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  isActive?: boolean;
  isSellable?: boolean;
}> = [
  {
    nome: 'Vacina V8 Canina',
    descricao: 'Vacina polivalente para cães, prevenção de doenças virais principais.',
    custo: 55,
    precoVenda: 120,
    estoqueAtual: 20,
    estoqueMinimo: 5,
  },
  {
    nome: 'Vacina Tríplice Felina',
    descricao: 'Vacina para gatos contra rinotraqueíte, calicivirose e panleucopenia.',
    custo: 50,
    precoVenda: 115,
    estoqueAtual: 15,
    estoqueMinimo: 4,
  },
  {
    nome: 'Ração Premium Cães Adultos 10kg',
    descricao: 'Ração super premium para cães adultos de porte médio.',
    custo: 95,
    precoVenda: 189.9,
    estoqueAtual: 12,
    estoqueMinimo: 3,
  },
  {
    nome: 'Ração Premium Gatos Castrados 3kg',
    descricao: 'Ração específica para gatos castrados com controle de peso.',
    custo: 48,
    precoVenda: 99.9,
    estoqueAtual: 18,
    estoqueMinimo: 4,
  },
  {
    nome: 'Coleira Antipulgas e Carrapatos',
    descricao: 'Proteção prolongada contra pulgas e carrapatos por até 8 meses.',
    custo: 60,
    precoVenda: 139.9,
    estoqueAtual: 10,
    estoqueMinimo: 3,
  },
  {
    nome: 'Shampoo Hipoalergênico',
    descricao: 'Shampoo dermatológico para cães e gatos com pele sensível.',
    custo: 28,
    precoVenda: 69.9,
    estoqueAtual: 25,
    estoqueMinimo: 6,
  },
  {
    nome: 'Petisco Dental para Cães',
    descricao: 'Petisco funcional para saúde bucal e controle de tártaro.',
    custo: 15,
    precoVenda: 39.9,
    estoqueAtual: 30,
    estoqueMinimo: 8,
  },
  {
    nome: 'Areia Higiênica Granulada 4kg',
    descricao: 'Areia higiênica para gatos com alta absorção e pouco odor.',
    custo: 18,
    precoVenda: 42.9,
    estoqueAtual: 22,
    estoqueMinimo: 6,
  },
  {
    nome: 'Antiparasitário Oral',
    descricao: 'Comprimido antiparasitário de amplo espectro para cães.',
    custo: 32,
    precoVenda: 89.9,
    estoqueAtual: 14,
    estoqueMinimo: 4,
  },
  {
    nome: 'Kit Curativo Pequeno',
    descricao: 'Kit com gaze, esparadrapo, soro e antisséptico para pequenos curativos.',
    custo: 20,
    precoVenda: 54.9,
    estoqueAtual: 8,
    estoqueMinimo: 2,
    isSellable: true,
  },
  {
    nome: 'Anti-inflamatório Oral Canino 20mg',
    descricao:
      'Medicamento anti-inflamatório não esteroidal para cães, uso sob prescrição veterinária.',
    custo: 22,
    precoVenda: 59.9,
    estoqueAtual: 18,
    estoqueMinimo: 5,
  },
  {
    nome: 'Antibiótico de Amplo Espectro Injetável',
    descricao:
      'Antibiótico injetável para tratamento de infecções sistêmicas em cães e gatos.',
    custo: 35,
    precoVenda: 92,
    estoqueAtual: 12,
    estoqueMinimo: 4,
    isSellable: false,
  },
  {
    nome: 'Colírio Lubrificante Oftálmico',
    descricao:
      'Solução oftálmica lubrificante para cães e gatos com olho seco ou irritação leve.',
    custo: 18,
    precoVenda: 49.9,
    estoqueAtual: 20,
    estoqueMinimo: 6,
  },
  {
    nome: 'Pomada Antisséptica para Feridas',
    descricao:
      'Pomada tópica para tratamento de feridas superficiais e pequenas lesões de pele.',
    custo: 16,
    precoVenda: 44.9,
    estoqueAtual: 25,
    estoqueMinimo: 7,
  },
  {
    nome: 'Suplemento Articular para Cães Idosos',
    descricao:
      'Suplemento com condroitina e glucosamina para suporte articular em cães idosos.',
    custo: 40,
    precoVenda: 99.9,
    estoqueAtual: 10,
    estoqueMinimo: 3,
  },
  {
    nome: 'Protetor Gástrico Oral',
    descricao:
      'Medicamento para proteção da mucosa gástrica de cães e gatos, uso sob orientação.',
    custo: 19,
    precoVenda: 55,
    estoqueAtual: 14,
    estoqueMinimo: 4,
    isSellable: false,
  },
  {
    nome: 'Soro Fisiológico 500ml',
    descricao: 'Soro fisiológico para diluição de medicamentos e higienização de feridas.',
    custo: 7.5,
    precoVenda: 24.9,
    estoqueAtual: 30,
    estoqueMinimo: 10,
    isSellable: false,
  },
  {
    nome: 'Coleira Elizabethana Plástica M',
    descricao:
      'Coleira protetora para impedir que o animal lamba ou morda feridas e curativos.',
    custo: 12,
    precoVenda: 39.9,
    estoqueAtual: 16,
    estoqueMinimo: 4,
  },
  {
    nome: 'Tapete Higiênico Super Absorvente',
    descricao:
      'Tapete higiênico descartável para cães, ideal para treinamento e pós-operatório.',
    custo: 20,
    precoVenda: 54.9,
    estoqueAtual: 22,
    estoqueMinimo: 6,
  },
  {
    nome: 'Analgésico Injetável',
    descricao:
      'Analgésico de uso injetável para controle de dor aguda em cães e gatos.',
    custo: 28,
    precoVenda: 78,
    estoqueAtual: 9,
    estoqueMinimo: 3,
    isSellable: false,
  },
];

const DEFAULT_SERVICE_DEFINITIONS: Array<{
  nome: string;
  tipo: TipoServico;
  precoSugerido: number;
  profissional?: string;
  descricao?: string;
}> = [
  {
    nome: 'Consulta clínica geral',
    tipo: TipoServico.CONSULTA,
    precoSugerido: 180,
    profissional: 'Médico',
    descricao:
      'Consulta clínica geral para avaliação completa da saúde do pet, definição de conduta e pedidos de exames quando necessário.',
  },
  {
    nome: 'Consulta de retorno',
    tipo: TipoServico.CONSULTA,
    precoSugerido: 120,
    profissional: 'Médico',
    descricao:
      'Reavaliação de caso já acompanhado na clínica, com ajuste de tratamento e análise da resposta clínica.',
  },
  {
    nome: 'Atendimento de emergência',
    tipo: TipoServico.CONSULTA,
    precoSugerido: 280,
    profissional: 'Médico',
    descricao:
      'Atendimento imediato em situações de urgência e emergência, com estabilização inicial do paciente.',
  },
  {
    nome: 'Avaliação pré-cirúrgica',
    tipo: TipoServico.CONSULTA,
    precoSugerido: 220,
    profissional: 'Médico',
    descricao:
      'Consulta pré-operatória para avaliação clínica, revisão de exames e liberação para cirurgia.',
  },
  {
    nome: 'Avaliação cardiológica básica',
    tipo: TipoServico.EXAME,
    precoSugerido: 260,
    profissional: 'Médico',
    descricao:
      'Avaliação cardiológica com exame físico direcionado e interpretação de exames complementares quando indicados.',
  },
  {
    nome: 'Acompanhamento pós-operatório (consulta)',
    tipo: TipoServico.CONSULTA,
    precoSugerido: 160,
    profissional: 'Médico',
    descricao:
      'Consulta de revisão após cirurgia, avaliação de dor, cicatrização e evolução clínica do paciente.',
  },
  {
    nome: 'Check-up preventivo completo',
    tipo: TipoServico.CONSULTA,
    precoSugerido: 320,
    profissional: 'Ambos',
    descricao:
      'Check-up preventivo com avaliação clínica detalhada, histórico, orientações e indicação de exames de rotina.',
  },
  {
    nome: 'Vacinação polivalente (cães)',
    tipo: TipoServico.VACINACAO,
    precoSugerido: 150,
    profissional: 'Enfermeiro',
    descricao:
      'Aplicação de vacina polivalente em cães, com conferência de carteirinha e orientação de protocolo vacinal.',
  },
  {
    nome: 'Vacinação tríplice (gatos)',
    tipo: TipoServico.VACINACAO,
    precoSugerido: 150,
    profissional: 'Enfermeiro',
    descricao:
      'Aplicação de vacina tríplice em gatos, com checagem de histórico vacinal e orientações ao tutor.',
  },
  {
    nome: 'Aplicação de medicação injetável',
    tipo: TipoServico.OUTROS,
    precoSugerido: 70,
    profissional: 'Enfermeiro',
    descricao:
      'Aplicação de medicamentos injetáveis prescritos pelo médico, via subcutânea, intramuscular ou intravenosa.',
  },
  {
    nome: 'Coleta de sangue para exames laboratoriais',
    tipo: TipoServico.EXAME,
    precoSugerido: 90,
    profissional: 'Enfermeiro',
    descricao:
      'Coleta de amostras de sangue para realização de exames laboratoriais internos ou externos.',
  },
  {
    nome: 'Curativo simples',
    tipo: TipoServico.OUTROS,
    precoSugerido: 80,
    profissional: 'Enfermeiro',
    descricao:
      'Limpeza e realização de curativo simples em feridas superficiais ou pequenas lesões de pele.',
  },
  {
    nome: 'Curativo avançado / troca de curativo',
    tipo: TipoServico.OUTROS,
    precoSugerido: 130,
    profissional: 'Enfermeiro',
    descricao:
      'Curativos avançados ou trocas em feridas cirúrgicas e lesões complexas, com técnicas específicas de proteção.',
  },
  {
    nome: 'Hidratação subcutânea',
    tipo: TipoServico.OUTROS,
    precoSugerido: 110,
    profissional: 'Enfermeiro',
    descricao:
      'Administração de fluidoterapia via subcutânea para suporte à hidratação em casos leves e crônicos.',
  },
  {
    nome: 'Monitorização de paciente internado (por dia)',
    tipo: TipoServico.OUTROS,
    precoSugerido: 190,
    profissional: 'Enfermeiro',
    descricao:
      'Monitorização diária de sinais vitais, administração de medicações e registro da evolução de pacientes internados.',
  },
  {
    nome: 'Acompanhamento pós-operatório (enfermagem)',
    tipo: TipoServico.OUTROS,
    precoSugerido: 120,
    profissional: 'Enfermeiro',
    descricao:
      'Cuidados de enfermagem no pós-operatório, incluindo curativos, medicações e orientação prática ao tutor.',
  },
  {
    nome: 'Orientação de cuidados domiciliares',
    tipo: TipoServico.CONSULTA,
    precoSugerido: 100,
    profissional: 'Ambos',
    descricao:
      'Sessão de orientação sobre manejo, medicações, rotina domiciliar e enriquecimento ambiental para o pet.',
  },
  {
    nome: 'Consulta de controle de doença crônica',
    tipo: TipoServico.CONSULTA,
    precoSugerido: 200,
    profissional: 'Médico',
    descricao:
      'Consulta periódica para acompanhamento de doenças crônicas, ajuste de tratamento e revisão de exames.',
  },
  {
    nome: 'Sessão de reabilitação / fisioterapia simples',
    tipo: TipoServico.OUTROS,
    precoSugerido: 140,
    profissional: 'Ambos',
    descricao:
      'Sessão de reabilitação ou fisioterapia com exercícios guiados e orientações para continuidade em casa.',
  },
];

console.log('>> Iniciando seed Auravet...');

async function main() {
  const modules = await Promise.all(
    DEFAULT_MODULES.map((module) =>
      prisma.module.upsert({
        where: { slug: module.slug },
        update: {
          name: module.name,
          description: module.description,
          isActive: true,
        },
        create: {
          slug: module.slug,
          name: module.name,
          description: module.description,
        },
      }),
    ),
  );

  const moduleMap = new Map(modules.map((module) => [module.slug, module]));

  const roles = await Promise.all(
    DEFAULT_ROLES.map(async (role) => {
      const savedRole = await prisma.role.upsert({
        where: { slug: role.slug },
        update: {
          name: role.name,
          description: role.description,
          isActive: true,
        },
        create: {
          slug: role.slug,
          name: role.name,
          description: role.description,
        },
      });

      await prisma.roleModuleAccess.deleteMany({ where: { roleId: savedRole.id } });

      const modulesToAssign = role.modules
        .map((slug) => moduleMap.get(slug))
        .filter((module): module is (typeof modules)[number] => Boolean(module))
        .map((module) => ({
          roleId: savedRole.id,
          moduleId: module.id,
          isEnabled: true,
        }));

      if (modulesToAssign.length > 0) {
        await prisma.roleModuleAccess.createMany({ data: modulesToAssign, skipDuplicates: true });
      }

      return savedRole;
    }),
  );

  const adminRole = roles.find((role) => role.slug === ADMIN_ROLE_SLUG);

  if (!adminRole) {
    throw new Error('Função de administrador não encontrada na seed.');
  }

await Promise.all(
  DEFAULT_SERVICE_DEFINITIONS.map((definition) =>
    prisma.serviceDefinition.upsert({
      where: { nome: definition.nome },
      update: {
        descricao: definition.descricao,
        tipo: definition.tipo,
        profissional: definition.profissional,
        precoSugerido: new Prisma.Decimal(definition.precoSugerido),
        isActive: true,
      },
      create: {
        nome: definition.nome,
        descricao: definition.descricao,
        tipo: definition.tipo,
        profissional: definition.profissional,
        precoSugerido: new Prisma.Decimal(definition.precoSugerido),
      },
    }),
  ),
);

  const owners = await Promise.all(
    DEFAULT_OWNERS.map((owner) =>
      prisma.owner.upsert({
        where: { email: owner.email },
        update: {
          nome: owner.nome,
          telefone: owner.telefone,
          cpf: owner.cpf,
          logradouro: owner.logradouro,
          numero: owner.numero,
          bairro: owner.bairro,
          cidade: owner.cidade,
          estado: owner.estado,
          cep: owner.cep,
        },
        create: {
          nome: owner.nome,
          email: owner.email,
          telefone: owner.telefone,
          cpf: owner.cpf,
          logradouro: owner.logradouro,
          numero: owner.numero,
          bairro: owner.bairro,
          cidade: owner.cidade,
          estado: owner.estado,
          cep: owner.cep,
        },
      }),
    ),
  );

  const ownerByEmail = new Map(owners.map((o) => [o.email, o]));

  await Promise.all(
    DEFAULT_ANIMALS.map(async (animal) => {
      const owner = ownerByEmail.get(animal.ownerEmail);

      if (!owner) {
        console.warn(
          `⚠️  Tutor com email ${animal.ownerEmail} não encontrado. Pet ${animal.nome} não será criado.`,
        );
        return;
      }

      const existing = await prisma.animal.findFirst({
        where: { nome: animal.nome, ownerId: owner.id },
      });

      const data = {
        nome: animal.nome,
        especie: animal.especie,
        raca: animal.raca,
        nascimento: animal.nascimento,
        ownerId: owner.id,
      };

      if (existing) {
        await prisma.animal.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.animal.create({ data });
      }
    }),
  );

  for (const product of DEFAULT_PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { nome: product.nome },
    });

    const data = {
      nome: product.nome,
      descricao: product.descricao,
      custo: new Prisma.Decimal(product.custo),
      precoVenda: new Prisma.Decimal(product.precoVenda),
      estoqueAtual: product.estoqueAtual,
      estoqueMinimo: product.estoqueMinimo,
      isActive: product.isActive ?? true,
      isSellable: product.isSellable ?? true,
    };

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.product.create({ data });
    }
  }



  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    create: {
      nome: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
    update: {
      nome: DEFAULT_ADMIN_NAME,
      roleId: adminRole.id,
      isActive: true,
      passwordHash,
    },
  });

  console.log(`👩‍⚕️ Usuário administrador pronto: ${admin.email}`);

  for (const collaborator of DEFAULT_COLLABORATORS) {
    const role = roles.find((item) => item.slug === collaborator.slug);

    if (!role) {
      console.warn(`⚠️  Função ${collaborator.slug} não encontrada. Perfil ${collaborator.email} não será criado.`);
      continue;
    }

    const collaboratorPasswordHash = await hashPassword(collaborator.password);

    const user = await prisma.user.upsert({
      where: { email: collaborator.email },
      create: {
        nome: collaborator.nome,
        email: collaborator.email,
        passwordHash: collaboratorPasswordHash,
        roleId: role.id,
        isActive: true,
      },
      update: {
        nome: collaborator.nome,
        roleId: role.id,
        isActive: true,
        passwordHash: collaboratorPasswordHash,
      },
    });

    await prisma.collaboratorProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        especialidade: collaborator.profile.especialidade,
        crmv: collaborator.profile.crmv,
        turnos: [...collaborator.profile.turnos],
        bio: collaborator.profile.bio,
      },
      update: {
        especialidade: collaborator.profile.especialidade,
        crmv: collaborator.profile.crmv,
        turnos: [...collaborator.profile.turnos],
        bio: collaborator.profile.bio,
      },
    });

    console.log(`🤝 Perfil clínico pronto: ${collaborator.email}`);
  }

  const invoiceStatuses = await Promise.all(
    DEFAULT_INVOICE_STATUSES.map((status) =>
      prisma.invoiceStatus.upsert({
        where: { slug: status.slug },
        update: { name: status.name },
        create: { slug: status.slug, name: status.name },
      }),
    ),
  );

    // -----------------------------
  // Seed de agendamentos e atendimentos
  // -----------------------------
  const animals = await prisma.animal.findMany({
    include: { owner: true },
  });

  const veterinarians = await prisma.user.findMany({
    where: { role: { slug: 'MEDICO' } },
  });

  const nurses = await prisma.user.findMany({
    where: { role: { slug: 'ENFERMEIRO' } },
  });

  const serviceDefs = await prisma.serviceDefinition.findMany({
    where: { isActive: true },
  });

  const products = await prisma.product.findMany();

  const pickRandom = <T,>(arr: T[]): T | null =>
    arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;

  const now = new Date();

// Alguns agendamentos futuros (AGENDADO / CONFIRMADO), sem atendimento ainda
const TOTAL_FUTURE_APPOINTMENTS = 50;

for (let i = 0; i < TOTAL_FUTURE_APPOINTMENTS; i++) {
  const animal = pickRandom(animals);
  const vet = pickRandom(veterinarians);
  const assistant = pickRandom(nurses);

  if (!animal || !vet) continue;

  // Espalha entre os próximos 15 dias
  const daysAhead = 1 + (i % 15);
  const start = new Date(now);
  start.setDate(now.getDate() + daysAhead);

  // Janelas de horário entre 9h e 17h
  const baseHour = 9;
  const hourSlot = i % 9; // 0..8 → 9h..17h
  start.setHours(baseHour + hourSlot, 0, 0, 0);

  const end = new Date(start);
  end.setHours(start.getHours() + 1);

  const isConfirmed = i % 2 === 1;

  await prisma.appointment.create({
    data: {
      animalId: animal.id,
      ownerId: animal.ownerId,
      veterinarianId: vet.id,
      assistantId: assistant?.id ?? null,
      status: isConfirmed ? AppointmentStatus.CONFIRMADO : AppointmentStatus.AGENDADO,
      scheduledStart: start,
      scheduledEnd: end,
      confirmedAt: isConfirmed ? start : null,
      notes: isConfirmed
        ? 'Agendamento confirmado via seed (consulta já confirmada com tutor).'
        : 'Agendamento criado via seed (check-up / consulta rotineira).',
    },
  });
}

// Alguns atendimentos concluídos, com agendamento já finalizado + serviço vinculado
if (animals.length && serviceDefs.length) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
  });

  for (let i = 0; i < Math.min(animals.length, 50); i++) {
    const animal = animals[animals.length - 1 - i];
    const vet = pickRandom(veterinarians);
    const assistant = pickRandom(nurses);
    const def = pickRandom(serviceDefs);

    if (!vet || !def) break;

    const daysAgo = i + 1;
    const start = new Date(now);
    start.setDate(now.getDate() - daysAgo);
    start.setHours(14, 0, 0, 0);

    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    // Cria o agendamento já concluído
    const appointment = await prisma.appointment.create({
      data: {
        animalId: animal.id,
        ownerId: animal.ownerId,
        veterinarianId: vet.id,
        assistantId: assistant?.id ?? null,
        status: AppointmentStatus.CONCLUIDO,
        scheduledStart: start,
        scheduledEnd: end,
        confirmedAt: start,
        completedAt: end,
        notes: `Atendimento de ${def.nome} concluído via seed.`,
      },
    });

    // Cria o serviço vinculado ao agendamento
    const service = await prisma.servico.create({
      data: {
        animalId: animal.id,
        tipo: def.tipo,
        data: end,
        preco: new Prisma.Decimal(def.precoSugerido),
        observacoes: `Serviço ${def.nome} realizado durante o agendamento seed.`,
        responsavelId: vet.id,
        appointmentId: appointment.id, // vínculo Servico -> Appointment
      },
    });

    // Vincula alguns produtos usados nesse atendimento (1 a 3 itens diferentes)
    if (products.length > 0) {
      const usedProducts = new Set<string>();
      const productsToUse = 1 + (i % 3); // 1, 2 ou 3 produtos

      for (let j = 0; j < productsToUse; j++) {
        const product = pickRandom(products);

        // >>> AQUI está a proteção que faltava
        if (!product) continue;
        if (usedProducts.has(product.id)) continue;

        usedProducts.add(product.id);

        const quantity = 1 + ((i + j) % 3); // 1 a 3 unidades
        const unitPrice = new Prisma.Decimal(product.precoVenda);
        const totalPrice = unitPrice.mul(quantity);

        await prisma.serviceProductUsage.create({
          data: {
            servicoId: service.id,
            productId: product.id,
            quantidade: quantity,
            valorUnitario: unitPrice,
            valorTotal: totalPrice,
          },
        });
      }
    }
  }
}




  const statusMap = new Map(invoiceStatuses.map((status) => [status.slug, status]));
  const openStatus = statusMap.get('ABERTA');

  if (openStatus) {
    const servicesWithoutInvoice = await prisma.servico.findMany({
      where: { invoiceItems: { none: {} } },
      include: {
        animal: { include: { owner: true } },
        items: { include: { product: true } },
      },
    });

    for (const service of servicesWithoutInvoice) {
      const productsTotal = service.items.reduce(
        (acc, item) => acc.add(item.valorTotal),
        new Prisma.Decimal(0),
      );
      const total = service.preco.add(productsTotal);

      const dueDate = new Date(service.data);
      dueDate.setDate(dueDate.getDate() + 7);

      await prisma.invoice.create({
        data: {
          ownerId: service.animal.ownerId,
          statusId: openStatus.id,
          total,
          dueDate,
          items: {
            create: [
              {
                servicoId: service.id,
                description: `Serviço: ${service.tipo}`,
                quantity: 1,
                unitPrice: service.preco,
                total: service.preco,
              },
              ...service.items.map((item) => ({
                productId: item.productId,
                description: item.product ? `Produto: ${item.product.nome}` : 'Produto utilizado',
                quantity: item.quantidade,
                unitPrice: item.valorUnitario,
                total: item.valorTotal,
              })),
            ],
          },
        },
      });
    }
  }
}

console.log('>> Admin seed finalizado com sucesso!');

main()
  .catch((error) => {
    console.error('Não foi possível executar o seed inicial', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
