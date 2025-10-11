import { app } from './app';
import { env } from './config/env';

const port = env.API_PORT;
const host = env.API_HOST;

app.listen(port, host, () => {
  console.log(`🚀 Auravet API pronta em http://${host}:${port}`);
});
