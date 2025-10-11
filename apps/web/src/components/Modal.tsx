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
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
        <Dialog.Overlay className="fixed inset-0 bg-brand-grafite/40 backdrop-blur" />
        <Dialog.Panel
          className={twMerge(
            'relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl focus:outline-none',
          )}
        >
          <div className="space-y-2">
            <Dialog.Title className="font-montserrat text-xl font-semibold text-brand-escuro">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="text-sm text-brand-grafite/70">
                {description}
              </Dialog.Description>
            ) : null}
          </div>
          <div className="mt-6 space-y-4">{children}</div>
          {actions ? <div className="mt-6 flex justify-end gap-3">{actions}</div> : null}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default Modal;
