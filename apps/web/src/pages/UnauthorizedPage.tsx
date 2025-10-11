import type { Location } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';

import Button from '../components/Button';

const UnauthorizedPage = () => {
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from;

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-brand-azul/40 bg-white/80 p-10 text-center shadow-lg shadow-brand-escuro/10">
      <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Acesso não autorizado</h1>
      <p className="mt-3 text-sm text-brand-grafite/80">
        Este conteúdo é reservado para colaboradores com permissões específicas. Se acredita que deveria ter acesso, converse com
        um Administrador Auravet.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
        {from ? (
          <Button asChild variant="secondary">
            <Link to={from.pathname ?? '/'}>Tentar novamente</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default UnauthorizedPage;
