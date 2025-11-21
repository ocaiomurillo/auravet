import { Dialog } from '@headlessui/react';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

const Modal = ({ open, title, description, onClose, children, actions }: ModalProps) => {
  return (
    <Dialog open={open} onClose={onClose} as={Fragment}>
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-6 sm:py-10">
        <Dialog.Overlay className="fixed inset-0 bg-brand-grafite/40 backdrop-blur" />
        <Dialog.Panel
          className={twMerge(
            'relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl focus:outline-none',
          )}
        >
          <div className="flex max-h-[calc(100vh-3rem)] flex-col sm:max-h-[calc(100vh-4rem)]">
            <div className="space-y-2 border-b border-brand-azul/30 bg-white/90 px-6 py-5">
              <Dialog.Title className="font-montserrat text-xl font-semibold text-brand-escuro">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-brand-grafite/70">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-5">{children}</div>
            </div>

            {actions ? (
              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-brand-azul/30 bg-white/95 px-6 py-4">
                {actions}
              </div>
            ) : null}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default Modal;
