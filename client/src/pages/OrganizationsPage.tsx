import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, TextField } from '@/components/ui';
import {
  createOrganization,
  listOrganizations,
  type Organization,
} from '@/features/organizations/organizations.api';
import { getApiErrorMessage } from '@/lib/apiError';
import { OrganizationDetail } from '@/components/OrganizationDetail';

const ORGS_KEY = ['organizations'];

export function OrganizationsPage(): JSX.Element {
  const { data: organizations, isLoading } = useQuery({
    queryKey: ORGS_KEY,
    queryFn: listOrganizations,
  });
  const [selected, setSelected] = useState<Organization | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
        <Link to="/dashboard" className="text-sm font-semibold text-indigo-600 hover:underline">
          Back to dashboard
        </Link>
      </header>

      <CreateOrganization />

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {organizations && organizations.length === 0 ? (
          <p className="text-sm text-slate-500">You’re not part of any organization yet.</p>
        ) : null}
        {(organizations ?? []).map((org) => (
          <button
            key={org.id}
            type="button"
            onClick={() => setSelected(selected?.id === org.id ? null : org)}
            className={`flex items-center justify-between rounded-2xl bg-white p-5 text-left shadow-sm ring-1 transition ${
              selected?.id === org.id ? 'ring-indigo-300' : 'ring-slate-200 hover:ring-slate-300'
            }`}
          >
            <div>
              <p className="font-semibold text-slate-800">{org.name}</p>
              <p className="text-xs text-slate-500">
                {org.memberCount} member{org.memberCount === 1 ? '' : 's'} · /{org.slug}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {org.myRole}
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="mt-6">
          <OrganizationDetail organization={selected} onChanged={() => setSelected(null)} />
        </div>
      ) : null}
    </div>
  );
}

function CreateOrganization(): JSX.Element {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createOrganization(name.trim()),
    onSuccess: () => {
      setName('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ORGS_KEY });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Create an organization</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField label="Name" placeholder="Acme Inc." value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="button" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Create
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
