import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

import Header from '../components/Header';

const MainLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-brand-gelo/60">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="grid gap-8">
          <Outlet />
        </div>
      </main>
      <footer className="bg-white/70 py-6 text-center text-sm text-brand-grafite/70">
        Na Auravet, seu pet é cuidado com ciência e carinho. © {new Date().getFullYear()}
      </footer>
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
