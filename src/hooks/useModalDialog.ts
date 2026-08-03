import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type ModalDialogOptions = {
  backgroundSelector?: string;
  dialogRef: RefObject<HTMLElement>;
  onClose: () => void;
  open: boolean;
};

type BackgroundState = {
  ariaHidden: string | null;
  element: HTMLElement;
  inert: boolean;
};

export function useModalDialog({
  backgroundSelector = '[data-modal-background]',
  dialogRef,
  onClose,
  open,
}: ModalDialogOptions) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousBodyOverflow = document.body.style.overflow;
    const backgrounds: BackgroundState[] = Array.from(
      document.querySelectorAll<HTMLElement>(backgroundSelector),
    )
      .filter((element) => !element.contains(dialog))
      .map((element) => ({
        ariaHidden: element.getAttribute('aria-hidden'),
        element,
        inert: element.hasAttribute('inert'),
      }));

    document.body.style.overflow = 'hidden';
    for (const background of backgrounds) {
      background.element.setAttribute('aria-hidden', 'true');
      background.element.setAttribute('inert', '');
    }

    const getFocusableElements = () => Array.from(
      dialog.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => element.getAttribute('aria-hidden') !== 'true');

    const initialFocus = dialog.querySelector<HTMLElement>('[data-modal-initial-focus]')
      ?? getFocusableElements()[0]
      ?? dialog;
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;

      for (const background of backgrounds) {
        if (background.ariaHidden === null) {
          background.element.removeAttribute('aria-hidden');
        } else {
          background.element.setAttribute('aria-hidden', background.ariaHidden);
        }

        if (!background.inert) {
          background.element.removeAttribute('inert');
        }
      }

      previouslyFocused?.focus();
    };
  }, [backgroundSelector, dialogRef, open]);
}
