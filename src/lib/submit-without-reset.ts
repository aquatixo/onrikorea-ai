import * as React from "react";

/**
 * onSubmit handler for a useActionState form that must keep what the user typed when the
 * action comes back with a validation error.
 *
 * Passing formAction to <form action> makes React 19 reset every uncontrolled field once
 * the action finishes -- including when it returned errors, so a typo in one field wiped
 * the whole form. Calling formAction ourselves inside a transition skips that reset;
 * isPending, redirects from the action, and state updates all behave the same.
 */
export function submitWithoutReset(formAction: (formData: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(e.currentTarget, submitter);
    React.startTransition(() => {
      formAction(formData);
    });
  };
}
