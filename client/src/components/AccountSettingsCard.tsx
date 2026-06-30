import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import { changeEmail, changePassword, updateProfile } from '@/features/account/account.api';
import { useAuth } from '@/features/auth/AuthContext';
import { getApiErrorMessage } from '@/lib/apiError';

type Feedback = { kind: 'ok' | 'err'; message: string } | null;

export function AccountSettingsCard(): JSX.Element {
  const { user, refresh } = useAuth();

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Account settings</h2>
      <div className="flex flex-col gap-8">
        <ProfileForm initialName={user?.displayName ?? ''} onSaved={refresh} />
        <PasswordForm />
        <EmailForm currentEmail={user?.email ?? ''} />
      </div>
    </section>
  );
}

function FeedbackLine({ feedback }: { feedback: Feedback }): JSX.Element | null {
  if (!feedback) return null;
  return (
    <p className={`text-sm ${feedback.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
      {feedback.message}
    </p>
  );
}

function ProfileForm({
  initialName,
  onSaved,
}: {
  initialName: string;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const [displayName, setDisplayName] = useState(initialName);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await updateProfile(displayName.trim() || null);
      await onSaved();
      setFeedback({ kind: 'ok', message: 'Profile updated.' });
    } catch (err) {
      setFeedback({ kind: 'err', message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Profile</h3>
      <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <FeedbackLine feedback={feedback} />
      <div>
        <Button type="submit" loading={saving}>Save profile</Button>
      </div>
    </form>
  );
}

function PasswordForm(): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setFeedback({ kind: 'ok', message: 'Password changed. Other sessions were signed out.' });
    } catch (err) {
      setFeedback({ kind: 'err', message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Password</h3>
      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <FeedbackLine feedback={feedback} />
      <div>
        <Button type="submit" loading={saving}>Change password</Button>
      </div>
    </form>
  );
}

function EmailForm({ currentEmail }: { currentEmail: string }): JSX.Element {
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await changeEmail(newEmail.trim(), currentPassword);
      setNewEmail('');
      setCurrentPassword('');
      setFeedback({ kind: 'ok', message: 'Confirmation link sent to the new address.' });
    } catch (err) {
      setFeedback({ kind: 'err', message: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Email</h3>
      <p className="text-xs text-slate-500">Current: {currentEmail}</p>
      <TextField label="New email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <FeedbackLine feedback={feedback} />
      <div>
        <Button type="submit" loading={saving}>Change email</Button>
      </div>
    </form>
  );
}
