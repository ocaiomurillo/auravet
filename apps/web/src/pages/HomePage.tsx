import { ArrowRightCircleIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

import Button from '../components/Button';
import Card from '../components/Card';

const HomePage = () => {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card
        title="Bem-vinda, equipe Auravet"
        description="Na Auravet, seu pet é cuidado com ciência e carinho. Centralize cadastros, históricos e serviços em um fluxo leve e sustentável."
        className="md:col-span-2"
        actions={
          <Button asChild variant="primary">
            <Link to="/new-service" className="flex items-center gap-2">
              <PlusCircleIcon className="h-5 w-5" /> Registrar serviço
            </Link>
          </Button>
        }
      >
        <p>
          Acompanhe tutores, pets e serviços em tempo real. Cada registro fortalece o vínculo entre conhecimento técnico e afeto — a essência do nosso cuidado.
        </p>
      </Card>

      <Card
        title="Tutores"
        description="Cadastre novos tutores e mantenha contatos sempre atualizados."
        actions={
          <Button variant="secondary" asChild>
            <Link to="/owners" className="flex items-center gap-2">
              <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
            </Link>
          </Button>
        }
      >
        <p>Conheça quem confia a energia dos pets à Auravet e acompanhe seus vínculos com cada animal.</p>
      </Card>

      <Card
        title="Animais"
        description="Visualize prontuários, histórico e datas importantes."
        actions={
          <Button variant="secondary" asChild>
            <Link to="/animals" className="flex items-center gap-2">
              <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
            </Link>
          </Button>
        }
      >
        <p>Cada pet é único. Mantenha dados completos e acione rapidamente os serviços vinculados.</p>
      </Card>

      <Card
        title="Serviços"
        description="Monitore consultas, exames, vacinas e cirurgias com filtros inteligentes."
        actions={
          <Button variant="secondary" asChild>
            <Link to="/services" className="flex items-center gap-2">
              <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
            </Link>
          </Button>
        }
      >
        <p>Garanta uma jornada de cuidado contínuo, com visão clara de próximos passos e registros completos.</p>
      </Card>
    </div>
  );
};

export default HomePage;
