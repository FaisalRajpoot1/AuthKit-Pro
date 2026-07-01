import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '@/components/AuthShell';
import { OAuthButtons } from '@/components/OAuthButtons';
import { TwoFactorStep } from '@/components/TwoFactorStep';
import { Button, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { loginFormSchema, type LoginFormValues } from '@/features/auth/auth.types';
import { loginWithPasskey, passkeysSupported } from '@/features/passkeys/passkeys.api';
import { getApiErrorMessage } from '@/lib/apiError';

export function LoginPage(): JSX.Element {
  const { login, refresh } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const signInWithPasskey = async (): Promise<void> => {
    setFormError(null);
    setPasskeyBusy(true);
    try {
      await loginWithPasskey();
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Passkey sign-in failed or was cancelled'));
    } finally {
      setPasskeyBusy(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await login(values);
      if (result.kind === 'two_factor_required') {
        setChallengeToken(result.challengeToken);
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Unable to sign in'));
    }
  });

  if (challengeToken) {
    return <TwoFactorStep challengeToken={challengeToken} onCancel={() => setChallengeToken(null)} />;
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your AuthKit Pro account">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Email or username"
          autoComplete="username"
          error={errors.identifier?.message}
          {...register('identifier')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {formError ? (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        ) : null}
        <div className="-mt-1 text-right">
          <Link to="/forgot-password" className="text-xs font-medium text-indigo-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      {passkeysSupported() ? (
        <button
          type="button"
          onClick={signInWithPasskey}
          disabled={passkeyBusy}
          className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {passkeyBusy ? 'Waiting for passkey…' : '🔑 Sign in with a passkey'}
        </button>
      ) : null}

      <p className="mt-4 text-center text-sm text-slate-500">
        <Link to="/passwordless" className="font-medium text-indigo-600 hover:underline">
          Sign in without a password
        </Link>
      </p>

      <div className="mt-6">
        <OAuthButtons />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        No account?{' '}
        <Link to="/register" className="font-semibold text-indigo-600 hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
