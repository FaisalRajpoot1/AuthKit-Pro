import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button, TextField } from '@/components/ui';
import { OAuthButtons } from '@/components/OAuthButtons';
import { useAuth } from '@/features/auth/AuthContext';
import { loginFormSchema, type LoginFormValues } from '@/features/auth/auth.types';
import { getApiErrorMessage } from '@/lib/apiError';

export function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

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

/** Second-factor step shown after a correct password when 2FA is enabled. */
function TwoFactorStep({
  challengeToken,
  onCancel,
}: {
  challengeToken: string;
  onCancel: () => void;
}): JSX.Element {
  const { completeTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await completeTwoFactor({ challengeToken, code: code.trim(), trustDevice });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid authentication code'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Two-factor authentication" subtitle="Enter the code from your authenticator app">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Authentication code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="123456 or a backup code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Trust this device for 30 days
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={submitting}>
          Verify
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-center text-sm text-slate-500 hover:underline"
        >
          Back to sign in
        </button>
      </form>
    </AuthShell>
  );
}

/** Shared centered card layout for auth screens. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
