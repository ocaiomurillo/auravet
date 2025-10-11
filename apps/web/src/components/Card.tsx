import { clsx } from 'clsx';
import type { PropsWithChildren, ReactNode } from 'react';

type CardProps = PropsWithChildren<{
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}>;

const Card = ({ title, description, actions, className, children }: CardProps) => {
  return (
    <section
      className={clsx(
        'flex flex-col gap-3 rounded-3xl bg-white/80 p-6 shadow-card transition hover:shadow-lg',
        className,
      )}
    >
      {title ? (
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-montserrat text-lg font-semibold text-brand-escuro">{title}</h2>
            {description && <p className="text-sm text-brand-grafite/70">{description}</p>}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="flex-1 space-y-4 text-sm text-brand-grafite">{children}</div>
    </section>
  );
};

export default Card;
