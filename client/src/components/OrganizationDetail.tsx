import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import {
  createTeam,
  deleteOrganization,
  deleteTeam,
  inviteMember,
  leaveOrganization,
  listMembers,
  listTeams,
  removeMember,
  type Organization,
} from '@/features/organizations/organizations.api';
import { getApiErrorMessage } from '@/lib/apiError';

export function OrganizationDetail({
  organization,
  onChanged,
}: {
  organization: Organization;
  onChanged: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const canManage = organization.myRole !== 'MEMBER';
  const isOwner = organization.myRole === 'OWNER';
  const orgId = organization.id;

  const membersKey = ['org-members', orgId];
  const teamsKey = ['org-teams', orgId];

  const members = useQuery({ queryKey: membersKey, queryFn: () => listMembers(orgId) });
  const teams = useQuery({ queryKey: teamsKey, queryFn: () => listTeams(orgId) });

  const invalidate = (key: unknown[]): void => void queryClient.invalidateQueries({ queryKey: key });

  const leave = useMutation({ mutationFn: () => leaveOrganization(orgId), onSuccess: onChanged });
  const destroy = useMutation({ mutationFn: () => deleteOrganization(orgId), onSuccess: onChanged });

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{organization.name}</h2>
        <div className="flex gap-3 text-sm">
          {!isOwner ? (
            <button type="button" onClick={() => leave.mutate()} className="font-medium text-slate-500 hover:underline">
              Leave
            </button>
          ) : null}
          {isOwner ? (
            <button type="button" onClick={() => destroy.mutate()} className="font-medium text-red-600 hover:underline">
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {/* Members */}
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Members</h3>
      <ul className="mb-4 divide-y divide-slate-100">
        {(members.data ?? []).map((member) => (
          <li key={member.userId} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {member.displayName ?? member.username}
              </p>
              <p className="text-xs text-slate-500">{member.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">{member.role}</span>
              {canManage && member.role !== 'OWNER' ? (
                <button
                  type="button"
                  onClick={() => removeMember(orgId, member.userId).then(() => invalidate(membersKey))}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {canManage ? <InviteForm orgId={orgId} /> : null}

      {/* Teams */}
      <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">Teams</h3>
      <ul className="mb-4 divide-y divide-slate-100">
        {(teams.data ?? []).map((team) => (
          <li key={team.id} className="flex items-center justify-between py-2">
            <p className="text-sm font-medium text-slate-800">
              {team.name}{' '}
              <span className="text-xs text-slate-400">
                ({team.memberCount} member{team.memberCount === 1 ? '' : 's'})
              </span>
            </p>
            {canManage ? (
              <button
                type="button"
                onClick={() => deleteTeam(orgId, team.id).then(() => invalidate(teamsKey))}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            ) : null}
          </li>
        ))}
        {teams.data && teams.data.length === 0 ? (
          <li className="py-2 text-sm text-slate-500">No teams yet.</li>
        ) : null}
      </ul>

      {canManage ? <CreateTeamForm orgId={orgId} onCreated={() => invalidate(teamsKey)} /> : null}
    </section>
  );
}

function InviteForm({ orgId }: { orgId: string }): JSX.Element {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => inviteMember(orgId, email.trim(), role),
    onSuccess: () => {
      setMessage('Invitation sent.');
      setEmail('');
    },
    onError: (err) => setMessage(getApiErrorMessage(err)),
  });

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <TextField label="Invite by email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="MEMBER">Member</option>
        <option value="ADMIN">Admin</option>
      </select>
      <Button type="button" onClick={() => mutation.mutate()} loading={mutation.isPending}>
        Invite
      </Button>
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}

function CreateTeamForm({ orgId, onCreated }: { orgId: string; onCreated: () => void }): JSX.Element {
  const [name, setName] = useState('');
  const mutation = useMutation({
    mutationFn: () => createTeam(orgId, name.trim()),
    onSuccess: () => {
      setName('');
      onCreated();
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <TextField label="New team" placeholder="Engineering" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="button" onClick={() => mutation.mutate()} loading={mutation.isPending}>
        Add team
      </Button>
    </div>
  );
}
