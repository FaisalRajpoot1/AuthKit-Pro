import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';

/** Minimal, accessible form primitives shared across auth pages. */

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, ...props }, ref) => {
    const fieldId = id ?? props.name ?? label;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <input
          id={fieldId}
          ref={ref}
          aria-invalid={Boolean(error)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 aria-[invalid=true]:border-red-400"
          {...props}
        />
        {error ? (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
TextField.displayName = 'TextField';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function Button({ loading, children, disabled, ...props }: ButtonProps): JSX.Element {
  return (
    <button
      disabled={disabled ?? loading}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
