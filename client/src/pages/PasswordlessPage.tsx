import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '@/components/AuthShell';
import { TwoFactorStep } from '@/components/TwoFactorStep';
import { Button, TextField } from '@/components/ui';
import {
  requestLoginOtp,
  requestMagicLink,
  verifyLoginOtp,
} from '@/features/auth/auth.api';
import { useAuth } from '@/features/auth/AuthContext';
import { getApiErrorMessage } from '@/lib/apiError';

type Method = 'magic' | 'otp';

export function PasswordlessPage(): JSX.Element {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>('magic');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [magicSent, setMagicSent] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  if (challengeToken) {
    return <TwoFactorStep challengeToken={challengeToken} onCancel={() => setChallengeToken(null)} />;
  }

  const sendMagic = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await requestMagicLink(email.trim());
      setMagicSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await requestLoginOtp(email.trim());
      setOtpSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const result = await verifyLoginOtp(email.trim(), code.trim());
      if (result.kind === 'two_factor_required') {
        setChallengeToken(result.challengeToken);
        return;
      }
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid or expired code'));
    } finally {
      setBusy(false);
    }
  };

  if (magicSent) {
    return (
      <AuthShell title="Check your inbox" subtitle="Sign-in link sent">
        <p className="text-sm text-slate-600">
          If an account exists for that email, we&apos;ve sent a link to sign in.
        </p>
        <BackToLogin />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Passwordless sign-in" subtitle="Use a link or a one-time code">
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        <TabButton active={method === 'magic'} onClick={() => setMethod('magic')}>
          Magic link
        </TabButton>
        <TabButton active={method === 'otp'} onClick={() => setMethod('otp')}>
          Email code
        </TabButton>
      </div>

      <div className="flex flex-col gap-3">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {method === 'otp' && otpSent ? (
          <TextField
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {method === 'magic' ? (
          <Button type="button" onClick={sendMagic} loading={busy} disabled={!email.trim()}>
            Email me a link
          </Button>
        ) : otpSent ? (
          <Button type="button" onClick={verifyOtp} loading={busy} disabled={code.trim().length !== 6}>
            Verify code
          </Button>
        ) : (
          <Button type="button" onClick={sendOtp} loading={busy} disabled={!email.trim()}>
            Email me a code
          </Button>
        )}
      </div>

      <BackToLogin />
    </AuthShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
        active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function BackToLogin(): JSX.Element {
  return (
    <p className="mt-6 text-center text-sm text-slate-500">
      <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
        Back to sign in
      </Link>
    </p>
  );
}
