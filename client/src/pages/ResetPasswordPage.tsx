import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, TextField } from '@/components/ui';
import { resetPassword } from '@/features/auth/auth.api';
import {
  resetPasswordFormSchema,
  type ResetPasswordFormValues,
} from '@/features/auth/auth.types';
import { getApiErrorMessage } from '@/lib/apiError';
import { AuthShell } from '@/components/AuthShell';

export function ResetPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordFormSchema) });

  const onSubmit = handleSubmit(async (values) => {
    if (!token) return;
    setFormError(null);
    try {
      await resetPassword(token, values.password);
      setDone(true);
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Unable to reset password'));
    }
  });

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="Reset token missing">
        <p className="text-sm text-slate-600">
          This password reset link is invalid or incomplete. Please request a new one.
        </p>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/forgot-password" className="font-semibold text-indigo-600 hover:underline">
            Request a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You're all set">
        <p className="text-sm text-slate-600">Your password has been reset.</p>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Enter a strong new password">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {formError ? (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        ) : null}
        <Button type="submit" loading={isSubmitting}>
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
