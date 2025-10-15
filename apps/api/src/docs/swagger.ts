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
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
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
          catalogItems: {
            type: 'array',
            items: { $ref: '#/components/schemas/ServiceCatalogItem' },
          },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/ServiceItem' },
          },
          responsavel: {
            allOf: [{ $ref: '#/components/schemas/ServiceResponsible' }],
            nullable: true,
          },
        },
        required: ['id', 'animalId', 'tipo', 'data', 'preco', 'createdAt'],
      },
      ServiceItemProduct: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          nome: { type: 'string' },
          precoVenda: { type: 'number', format: 'double' },
          estoqueAtual: { type: 'integer' },
          estoqueMinimo: { type: 'integer' },
        },
        required: ['id', 'nome', 'precoVenda', 'estoqueAtual', 'estoqueMinimo'],
      },
      ServiceItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          productId: { type: 'string', format: 'cuid' },
          quantidade: { type: 'integer' },
          valorUnitario: { type: 'number', format: 'double' },
          valorTotal: { type: 'number', format: 'double' },
          product: { $ref: '#/components/schemas/ServiceItemProduct' },
        },
        required: ['id', 'productId', 'quantidade', 'valorUnitario', 'valorTotal', 'product'],
      },
      ServiceCatalogItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          serviceDefinitionId: { type: 'string', format: 'cuid' },
          quantidade: { type: 'integer' },
          valorUnitario: { type: 'number', format: 'double' },
          valorTotal: { type: 'number', format: 'double' },
          observacoes: { type: 'string', nullable: true },
          definition: { $ref: '#/components/schemas/ServiceDefinition' },
        },
        required: [
          'id',
          'serviceDefinitionId',
          'quantidade',
          'valorUnitario',
          'valorTotal',
          'definition',
        ],
      },
      ServiceDefinition: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          nome: { type: 'string' },
          descricao: { type: 'string', nullable: true },
          tipo: { type: 'string', enum: ['CONSULTA', 'EXAME', 'VACINACAO', 'CIRURGIA', 'OUTROS'] },
          precoSugerido: { type: 'number', format: 'double' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'nome', 'tipo', 'precoSugerido', 'createdAt', 'updatedAt'],
      },
      ServiceResponsible: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          nome: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
        required: ['id', 'nome', 'email'],
      },
      Module: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          slug: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'slug', 'name', 'isActive', 'createdAt', 'updatedAt'],
      },
      RoleModule: {
        allOf: [
          { $ref: '#/components/schemas/Module' },
          {
            type: 'object',
            properties: {
              isEnabled: { type: 'boolean' },
            },
            required: ['isEnabled'],
          },
        ],
      },
      Role: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          modules: {
            type: 'array',
            items: { $ref: '#/components/schemas/RoleModule' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'slug', 'isActive', 'modules', 'createdAt', 'updatedAt'],
      },
      UserRole: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          slug: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['id', 'slug', 'name'],
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          nome: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { $ref: '#/components/schemas/UserRole' },
          isActive: { type: 'boolean' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
          modules: {
            type: 'array',
            items: { type: 'string' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'nome', 'email', 'role', 'isActive', 'modules', 'createdAt', 'updatedAt'],
      },
      AuthLoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
      AuthLoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
        required: ['token', 'user'],
      },
      RegisterUserRequest: {
        type: 'object',
        required: ['nome', 'email', 'password', 'roleId'],
        properties: {
          nome: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          roleId: { type: 'string', format: 'cuid' },
        },
      },
      CreateRoleRequest: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string', description: 'Identificador único em letras maiúsculas.' },
          description: { type: 'string' },
          moduleIds: {
            type: 'array',
            items: { type: 'string', format: 'cuid' },
          },
        },
      },
      UpdateRoleRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
        },
      },
      UpdateRoleModulesRequest: {
        type: 'object',
        required: ['modules'],
        properties: {
          modules: {
            type: 'array',
            items: {
              type: 'object',
              required: ['moduleId', 'isEnabled'],
              properties: {
                moduleId: { type: 'string', format: 'cuid' },
                isEnabled: { type: 'boolean' },
              },
            },
          },
        },
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
    '/auth/login': {
      post: {
        summary: 'Autentica um colaborador interno',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthLoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Autenticação bem-sucedida',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthLoginResponse' },
              },
            },
          },
          '401': {
            description: 'Credenciais inválidas',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '429': { description: 'Limite de tentativas excedido' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Cadastra um novo colaborador interno',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterUserRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Colaborador criado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                  required: ['user'],
                },
              },
            },
          },
          '403': { description: 'Permissão insuficiente' },
          '409': {
            description: 'E-mail já cadastrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Retorna informações do usuário autenticado',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Dados do usuário autenticado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                  required: ['user'],
                },
              },
            },
          },
          '401': { description: 'Sessão inválida' },
        },
      },
    },
    '/users': {
      get: {
        summary: 'Lista colaboradores internos',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Colaboradores encontrados',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/User' },
                    },
                  },
                  required: ['users'],
                },
              },
            },
          },
          '403': { description: 'Permissão insuficiente' },
        },
      },
    },
    '/users/{id}': {
      patch: {
        summary: 'Atualiza dados básicos de um colaborador',
        security: [{ BearerAuth: [] }],
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
                  roleId: { type: 'string', format: 'cuid' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Colaborador atualizado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                  required: ['user'],
                },
              },
            },
          },
          '404': { description: 'Colaborador não encontrado' },
        },
      },
    },
    '/users/{id}/status': {
      patch: {
        summary: 'Ativa ou desativa um colaborador',
        security: [{ BearerAuth: [] }],
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
                required: ['isActive'],
                properties: {
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Status atualizado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                  required: ['user'],
                },
              },
            },
          },
          '400': { description: 'Operação não permitida' },
          '404': { description: 'Colaborador não encontrado' },
        },
      },
    },
    '/roles': {
      get: {
        summary: 'Lista funções cadastradas',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Funções encontradas',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    roles: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Role' },
                    },
                  },
                  required: ['roles'],
                },
              },
            },
          },
          '403': { description: 'Permissão insuficiente' },
        },
      },
      post: {
        summary: 'Cria uma nova função',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateRoleRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Função criada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { role: { $ref: '#/components/schemas/Role' } },
                  required: ['role'],
                },
              },
            },
          },
          '403': { description: 'Permissão insuficiente' },
        },
      },
    },
    '/roles/modules': {
      get: {
        summary: 'Lista módulos disponíveis',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Módulos disponíveis',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    modules: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Module' },
                    },
                  },
                  required: ['modules'],
                },
              },
            },
          },
          '403': { description: 'Permissão insuficiente' },
        },
      },
    },
    '/roles/{id}': {
      get: {
        summary: 'Obtém uma função específica',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } }],
        responses: {
          '200': {
            description: 'Função encontrada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { role: { $ref: '#/components/schemas/Role' } },
                  required: ['role'],
                },
              },
            },
          },
          '404': { description: 'Função não encontrada' },
        },
      },
      patch: {
        summary: 'Atualiza informações básicas de uma função',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateRoleRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Função atualizada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { role: { $ref: '#/components/schemas/Role' } },
                  required: ['role'],
                },
              },
            },
          },
          '404': { description: 'Função não encontrada' },
        },
      },
      delete: {
        summary: 'Remove uma função',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } }],
        responses: {
          '204': { description: 'Função removida' },
          '400': { description: 'Função em uso' },
          '404': { description: 'Função não encontrada' },
        },
      },
    },
    '/roles/{id}/modules': {
      patch: {
        summary: 'Atualiza os módulos disponíveis para uma função',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'cuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateRoleModulesRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Módulos da função atualizados',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { role: { $ref: '#/components/schemas/Role' } },
                  required: ['role'],
                },
              },
            },
          },
          '404': { description: 'Função não encontrada' },
        },
      },
    },
    '/owners': {
      get: {
        summary: 'Lista todos os tutores cadastrados',
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
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
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['animalId', 'tipo', 'data'],
                properties: {
                  animalId: { type: 'string', format: 'cuid' },
                  tipo: {
                    type: 'string',
                    enum: ['CONSULTA', 'EXAME', 'VACINACAO', 'CIRURGIA', 'OUTROS'],
                  },
                  data: { type: 'string', format: 'date' },
                  preco: { type: 'number', format: 'double' },
                  observacoes: { type: 'string' },
                  responsavelId: { type: 'string', format: 'cuid' },
                  catalogItems: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['serviceDefinitionId', 'quantidade', 'precoUnitario'],
                      properties: {
                        serviceDefinitionId: { type: 'string', format: 'cuid' },
                        quantidade: { type: 'integer', minimum: 1 },
                        precoUnitario: { type: 'number', format: 'double' },
                        observacoes: { type: 'string' },
                      },
                    },
                  },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['productId', 'quantidade', 'precoUnitario'],
                      properties: {
                        productId: { type: 'string', format: 'cuid' },
                        quantidade: { type: 'integer', minimum: 1 },
                        precoUnitario: { type: 'number', format: 'double' },
                      },
                    },
                  },
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
          '400': {
            description: 'Estoque insuficiente para os produtos informados',
          },
          '404': {
            description: 'Animal não encontrado',
          },
        },
      },
    },
    '/services/catalog': {
      get: {
        summary: 'Lista serviços disponíveis no catálogo padrão',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Catálogo de serviços ativos',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    definitions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ServiceDefinition' },
                    },
                  },
                  required: ['definitions'],
                },
              },
            },
          },
        },
      },
    },
    '/services/responsibles': {
      get: {
        summary: 'Lista usuários aptos a serem responsáveis por serviços',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Responsáveis disponíveis',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    responsibles: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ServiceResponsible' },
                    },
                  },
                  required: ['responsibles'],
                },
              },
            },
          },
        },
      },
    },
    '/services/{id}': {
      put: {
        summary: 'Atualiza um serviço',
        security: [{ BearerAuth: [] }],
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
                  responsavelId: { type: 'string', format: 'cuid' },
                  catalogItems: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['serviceDefinitionId', 'quantidade', 'precoUnitario'],
                      properties: {
                        serviceDefinitionId: { type: 'string', format: 'cuid' },
                        quantidade: { type: 'integer', minimum: 1 },
                        precoUnitario: { type: 'number', format: 'double' },
                        observacoes: { type: 'string' },
                      },
                    },
                  },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['productId', 'quantidade', 'precoUnitario'],
                      properties: {
                        productId: { type: 'string', format: 'cuid' },
                        quantidade: { type: 'integer', minimum: 1 },
                        precoUnitario: { type: 'number', format: 'double' },
                      },
                    },
                  },
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
          '400': {
            description: 'Estoque insuficiente para os produtos informados',
          },
        },
      },
      delete: {
        summary: 'Remove um serviço',
        security: [{ BearerAuth: [] }],
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
