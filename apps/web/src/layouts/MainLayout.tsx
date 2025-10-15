import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

import Sidebar from '../components/Sidebar';

const MainLayout = () => {
  return (
    <div className="flex min-h-screen bg-brand-gelo/60">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <main className="flex-1 px-6 pb-16 pt-24 md:px-10 md:pb-16 md:pt-12 lg:px-16">
          <div className="mx-auto grid w-full max-w-5xl gap-8">
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-brand-azul/20 bg-white/70 py-6">
          <div className="mx-auto w-full max-w-5xl px-6 text-center text-sm text-brand-grafite/70 md:px-10 lg:px-16">
            Na Auravet, seu pet é cuidado com ciência e carinho. © {new Date().getFullYear()}
          </div>
        </footer>
      </div>
      <Toaster
        theme="light"
        position="top-right"
        toastOptions={{
          className: 'rounded-2xl bg-white/95 text-brand-grafite shadow-lg shadow-brand-escuro/20',
        }}
      />
    </div>
  );
};

export default MainLayout;
