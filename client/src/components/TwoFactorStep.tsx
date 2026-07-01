import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthShell } from '@/components/AuthShell';
import { Button, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { getApiErrorMessage } from '@/lib/apiError';

/**
 * Second-factor step shown after a successful first factor (password or
 * passwordless) when 2FA is enabled. On success it navigates to the dashboard.
 */
export function TwoFactorStep({
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
          Back
        </button>
      </form>
    </AuthShell>
  );
}
