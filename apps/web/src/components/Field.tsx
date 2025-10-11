import { clsx } from 'clsx';
import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  helperText?: string;
};

const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ id, label, error, helperText, className, type = 'text', ...props }, ref) => {
    const fieldId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-grafite" htmlFor={fieldId}>
        <span className="font-semibold text-brand-escuro">{label}</span>
        <input
          id={fieldId}
          ref={ref}
          type={type}
          className={clsx(
            'w-full rounded-xl border border-brand-azul/60 bg-white/90 px-4 py-2 text-brand-grafite shadow-inner focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/50',
            error && 'border-red-400 focus:ring-red-300',
            className,
          )}
          {...props}
        />
        {helperText && !error ? (
          <span className="text-xs text-brand-grafite/70">{helperText}</span>
        ) : null}
        {error ? <span className="text-xs text-red-500">{error}</span> : null}
      </label>
    );
  },
);

Field.displayName = 'Field';

export default Field;
