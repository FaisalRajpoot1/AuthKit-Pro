import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Button, TextField } from '@/components/ui';
import { requestPasswordReset } from '@/features/auth/auth.api';
import {
  forgotPasswordFormSchema,
  type ForgotPasswordFormValues,
} from '@/features/auth/auth.types';
import { getApiErrorMessage } from '@/lib/apiError';
import { AuthShell } from '@/components/AuthShell';

export function ForgotPasswordPage(): JSX.Element {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordFormSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await requestPasswordReset(values.email);
      setSubmitted(true);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  });

  if (submitted) {
    return (
      <AuthShell title="Check your inbox" subtitle="Password reset requested">
        <p className="text-sm text-slate-600">
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </p>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot password" subtitle="We'll email you a reset link">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        {formError ? (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        ) : null}
        <Button type="submit" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
