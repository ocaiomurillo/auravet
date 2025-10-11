const FullScreenSpinner = () => {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-azul/40 border-t-brand-escuro" aria-label="Carregando" />
    </div>
  );
};

export default FullScreenSpinner;
