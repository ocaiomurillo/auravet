import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { Location } from 'react-router-dom';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import { useAuth } from '../contexts/AuthContext';

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginPage = () => {
  const { login, user } = useAuth();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      toast.success('Bem-vindo de volta à Auravet!');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível autenticar.');
    },
  });

  if (user) {
    const redirectTo = (location.state as { from?: Location })?.from;
    return <Navigate to={redirectTo?.pathname ?? '/'} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    await loginMutation.mutateAsync(values);
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-gelo/70 px-4 py-10">
      <Card className="w-full max-w-md border border-brand-azul/40 bg-white/80 p-8 shadow-xl shadow-brand-escuro/10">
        <div className="text-center">
          <h1 className="font-montserrat text-3xl font-semibold text-brand-escuro">Portal Auravet</h1>
          <p className="mt-2 text-sm text-brand-grafite/70">Entre com suas credenciais internas para cuidar dos nossos pacientes.</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <Field
            label="E-mail corporativo"
            type="email"
            placeholder="colaborador@auravet.com"
            autoComplete="email"
            required
            {...register('email', { required: 'Informe seu e-mail.' })}
            helperText={errors.email?.message}
          />
          <Field
            label="Senha"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            {...register('password', { required: 'Informe sua senha.' })}
            helperText={errors.password?.message}
          />

          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? 'Entrando...' : 'Entrar na Auravet'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-brand-grafite/70">
          Precisa de acesso? Procure um Administrador Auravet para criar seu usuário interno.
        </p>
      </Card>
    </div>
  );
};

export default LoginPage;
