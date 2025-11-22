import { app } from './app';
import { env } from './config/env';
import { ensureDatabaseIsMigrated } from './lib/migration-check';

const port = env.API_PORT;
const host = env.API_HOST;

async function bootstrap() {
  await ensureDatabaseIsMigrated();

  app.listen(port, host, () => {
    console.log(`🚀 Auravet API pronta em http://${host}:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error('❌ Falha ao iniciar a API. Verifique as migrações e o banco de dados.', error);
  process.exit(1);
});
