export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Auravet API',
    description:
      'API oficial da clínica veterinária Auravet. Todos os endpoints retornam respostas JSON e utilizam validação com Zod.',
    version: '1.0.0',
    contact: {
      name: 'Auravet',
      url: 'https://auravet.example',
      email: 'contato@auravet.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Ambiente local de desenvolvimento',
    },
  ],
  components: {
    schemas: {
      Owner: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          nome: { type: 'string' },
          email: { type: 'string', format: 'email' },
          telefone: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'nome', 'email', 'createdAt'],
      },
      Animal: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          nome: { type: 'string' },
          especie: { type: 'string', enum: ['CACHORRO', 'GATO', 'OUTROS'] },
          raca: { type: 'string', nullable: true },
          nascimento: { type: 'string', format: 'date-time', nullable: true },
          ownerId: { type: 'string', format: 'cuid' },
          createdAt: { type: 'string', format: 'date-time' },
          owner: { $ref: '#/components/schemas/Owner' },
        },
        required: ['id', 'nome', 'especie', 'ownerId', 'createdAt'],
      },
      Servico: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          animalId: { type: 'string', format: 'cuid' },
          tipo: {
            type: 'string',
            enum: ['CONSULTA', 'EXAME', 'VACINACAO', 'CIRURGIA', 'OUTROS'],
          },
          data: { type: 'string', format: 'date-time' },
          preco: { type: 'number', format: 'double' },
          observacoes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          animal: { $ref: '#/components/schemas/Animal' },
        },
        required: ['id', 'animalId', 'tipo', 'data', 'preco', 'createdAt'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: {},
        },
        required: ['error'],
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Checa disponibilidade da API',
        responses: {
          '200': {
            description: 'API operacional',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/owners': {
      get: {
        summary: 'Lista todos os tutores cadastrados',
        responses: {
          '200': {
            description: 'Lista de tutores',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Owner' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Cria um novo tutor',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome', 'email'],
                properties: {
                  nome: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  telefone: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Tutor criado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Owner' },
              },
            },
          },
          '422': {
            description: 'Erro de validação',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/owners/{id}': {
      get: {
        summary: 'Obtém um tutor específico',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'cuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Tutor encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Owner' },
              },
            },
          },
          '404': {
            description: 'Tutor não encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      put: {
        summary: 'Atualiza um tutor',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'cuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nome: { type: 'string' },
                  email: { type: 'string' },
                  telefone: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tutor atualizado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Owner' },
              },
            },
          },
          '404': {
            description: 'Tutor não encontrado',
          },
        },
      },
      delete: {
        summary: 'Remove um tutor',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'cuid' },
          },
        ],
        responses: {
          '204': { description: 'Tutor removido' },
          '404': { description: 'Tutor não encontrado' },
        },
      },
    },
    '/animals': {
      get: {
        summary: 'Lista todos os animais',
        parameters: [
          {
            name: 'ownerId',
            in: 'query',
            schema: { type: 'string', format: 'cuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Lista de animais',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Animal' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Cadastra um novo animal',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome', 'especie', 'ownerId'],
                properties: {
                  nome: { type: 'string' },
                  especie: {
                    type: 'string',
                    enum: ['CACHORRO', 'GATO', 'OUTROS'],
                  },
                  raca: { type: 'string' },
                  nascimento: { type: 'string', format: 'date' },
                  ownerId: { type: 'string', format: 'cuid' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Animal criado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Animal' },
              },
            },
          },
          '404': {
            description: 'Tutor não encontrado',
          },
        },
      },
    },
    '/animals/{id}': {
      get: {
        summary: 'Obtém um animal específico',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'cuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Animal encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Animal' },
              },
            },
          },
          '404': {
            description: 'Animal não encontrado',
          },
        },
      },
      put: {
        summary: 'Atualiza um animal',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'cuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nome: { type: 'string' },
                  especie: { type: 'string' },
                  raca: { type: 'string' },
                  nascimento: { type: 'string', format: 'date' },
                  ownerId: { type: 'string', format: 'cuid' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Animal atualizado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Animal' },
              },
            },
          },
          '404': {
            description: 'Animal não encontrado',
          },
        },
      },
      delete: {
        summary: 'Remove um animal',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'cuid' },
          },
        ],
        responses: {
          '204': { description: 'Animal removido' },
          '404': { description: 'Animal não encontrado' },
        },
      },
    },
    '/animals/{id}/services': {
      get: {
        summary: 'Lista serviços relacionados a um animal',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'cuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Histórico de serviços',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Servico' },
                },
              },
            },
          },
          '404': { description: 'Animal não encontrado' },
        },
      },
    },
    '/services': {
      get: {
        summary: 'Lista serviços com filtros por animal, tutor e período',
        parameters: [
          {
            name: 'animalId',
            in: 'query',
            schema: { type: 'string', format: 'cuid' },
          },
          {
            name: 'ownerId',
            in: 'query',
            schema: { type: 'string', format: 'cuid' },
          },
          {
            name: 'from',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'to',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Serviços filtrados',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Servico' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Registra um novo serviço',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['animalId', 'tipo', 'data', 'preco'],
                properties: {
                  animalId: { type: 'string', format: 'cuid' },
                  tipo: {
                    type: 'string',
                    enum: ['CONSULTA', 'EXAME', 'VACINACAO', 'CIRURGIA', 'OUTROS'],
                  },
                  data: { type: 'string', format: 'date' },
                  preco: { type: 'number', format: 'double' },
                  observacoes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Serviço criado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Servico' },
              },
            },
          },
          '404': {
            description: 'Animal não encontrado',
          },
        },
      },
    },
    '/services/{id}': {
      put: {
        summary: 'Atualiza um serviço',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'cuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  animalId: { type: 'string', format: 'cuid' },
                  tipo: { type: 'string' },
                  data: { type: 'string', format: 'date' },
                  preco: { type: 'number', format: 'double' },
                  observacoes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Serviço atualizado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Servico' },
              },
            },
          },
          '404': {
            description: 'Serviço não encontrado',
          },
        },
      },
      delete: {
        summary: 'Remove um serviço',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'cuid' },
          },
        ],
        responses: {
          '204': { description: 'Serviço removido' },
          '404': { description: 'Serviço não encontrado' },
        },
      },
    },
  },
};
