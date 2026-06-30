/** Renders a one-time list of backup codes with a copy action. */
export function BackupCodes({ codes }: { codes: string[] }): JSX.Element {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        Save these backup codes somewhere safe. Each can be used once if you lose your authenticator.
        They won&apos;t be shown again.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-amber-950">
        {codes.map((code) => (
          <li key={code} className="rounded bg-white/70 px-2 py-1 text-center">
            {code}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}
        className="mt-3 text-xs font-semibold text-amber-800 hover:underline"
      >
        Copy all codes
      </button>
    </div>
  );
}
