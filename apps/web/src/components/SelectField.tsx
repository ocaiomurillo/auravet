import { clsx } from 'clsx';
import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  helperText?: string;
};

const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ id, label, helperText, className, children, ...props }, ref) => {
    const fieldId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <label className="flex flex-col gap-1 text-sm font-medium text-brand-grafite" htmlFor={fieldId}>
        <span className="font-semibold text-brand-escuro">{label}</span>
        <select
          id={fieldId}
          ref={ref}
          className={clsx(
            'w-full rounded-xl border border-brand-azul/60 bg-white/90 px-4 py-2 text-brand-grafite shadow-inner focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/50',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {helperText ? <span className="text-xs text-brand-grafite/70">{helperText}</span> : null}
      </label>
    );
  },
);

SelectField.displayName = 'SelectField';

export default SelectField;
