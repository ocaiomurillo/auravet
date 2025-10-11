import { Slot } from '@radix-ui/react-slot';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  asChild?: boolean;
};

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-brand-escuro text-white shadow-lg shadow-brand-escuro/30 hover:bg-brand-escuro/90 focus-visible:ring-2 focus-visible:ring-brand-azul/70',
  secondary:
    'bg-brand-azul/50 text-brand-grafite hover:bg-brand-azul focus-visible:ring-2 focus-visible:ring-brand-escuro/40',
  ghost:
    'bg-transparent text-brand-escuro hover:bg-brand-azul/40 focus-visible:ring-2 focus-visible:ring-brand-escuro/40',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', type = 'button', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref as never}
        type={asChild ? undefined : type}
        className={twMerge(
          'inline-flex items-center justify-center rounded-full px-5 py-2.5 font-semibold transition focus:outline-none',
          variantStyles[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export default Button;
