import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env';
import { swaggerDocument } from './docs/swagger';
import { errorHandler } from './middlewares/error-handler';
import { animalsRouter } from './routes/animals';
import { authRouter } from './routes/auth';
import { ownersRouter } from './routes/owners';
import { servicesRouter } from './routes/services';
import { usersRouter } from './routes/users';

const app = express();

const corsOrigin = env.CORS_ORIGIN?.split(',').map((origin) => origin.trim());

app.use(
  cors({
    origin: corsOrigin && corsOrigin.length > 0 ? corsOrigin : true,
  }),
);
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'Auravet API saudável' });
});

app.use('/auth', authRouter);
app.use('/owners', ownersRouter);
app.use('/animals', animalsRouter);
app.use('/services', servicesRouter);
app.use('/users', usersRouter);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(errorHandler);

export { app };
