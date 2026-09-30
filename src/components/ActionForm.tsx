"use client";

import { createContext, useContext, useEffect, useRef, useTransition } from "react";

const PendingContext = createContext(false);

/** True while the enclosing ActionForm is being submitted. */
export function useFormPending(): boolean {
  return useContext(PendingContext);
}

/** Fired on a form after its file inputs have been emptied, so they can clear their status text. */
export const FILES_CLEARED = "rsp:files-cleared";

type Props = Omit<React.FormHTMLAttributes<HTMLFormElement>, "action"> & {
  /** The dispatcher returned by useActionState. */
  action: (formData: FormData) => void;
  /** The pending flag returned by useActionState. */
  pending: boolean;
  /** Pass the success message (or anything that changes on success) to empty the file inputs afterwards. */
  clearFilesOn?: unknown;
};

/**
 * A form that keeps what was typed. React resets every field of a form once its action has
 * run, including when the action answered with a validation error, which would throw away
 * a long listing because of one bad field. Submitting through a transition avoids the reset.
 * Without JavaScript the form still posts to the same action.
 */
export function ActionForm({ action, pending, clearFilesOn, children, onSubmit, ...rest }: Props) {
  const ref = useRef<HTMLFormElement | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    const form = ref.current;
    if (!clearFilesOn || !form) return;
    form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => (input.value = ""));
    form.dispatchEvent(new CustomEvent(FILES_CLEARED));
  }, [clearFilesOn]);

  return (
    <PendingContext.Provider value={pending}>
      <form
        ref={ref}
        {...rest}
        action={action}
        onSubmit={(event) => {
          onSubmit?.(event);
          // Something else, such as a photo still being compressed, has asked to hold the submit.
          if (event.defaultPrevented) return;
          event.preventDefault();
          if (pending) return;
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const data = new FormData(event.currentTarget, submitter instanceof HTMLElement ? submitter : undefined);
          start(() => action(data));
        }}
      >
        {children}
      </form>
    </PendingContext.Provider>
  );
}
