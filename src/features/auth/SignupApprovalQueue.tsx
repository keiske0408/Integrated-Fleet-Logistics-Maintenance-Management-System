import React, { useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

interface PendingSignup {
  id: string;
  name: string;
  email: string;
  department: string;
  createdAt: string;
}

const APPROVAL_ROLES = [
  { value: 'department_requester', label: 'Department Requester' },
  { value: 'driver', label: 'Driver' },
  { value: 'fleet_manager', label: 'Fleet Manager' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'procurement_officer', label: 'Procurement Officer' },
];

export function SignupApprovalQueue() {
  const [requests, setRequests] = useState<PendingSignup[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/auth/signup/requests');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to load signup requests.');
      setRequests(result as PendingSignup[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load signup requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const decide = async (signup: PendingSignup, approve: boolean) => {
    setBusyId(signup.id);
    setError('');
    try {
      const response = await apiFetch(
        approve ? `/api/auth/signup/requests/${encodeURIComponent(signup.id)}/approve` : `/api/auth/signup/requests/${encodeURIComponent(signup.id)}`,
        {
          method: approve ? 'POST' : 'DELETE',
          ...(approve ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: roles[signup.id] ?? 'department_requester' }) } : {}),
        },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? 'Unable to update signup request.');
      }
      setRequests((previous) => previous.filter((request) => request.id !== signup.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update signup request.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4 border-y border-border py-5" aria-labelledby="signup-approvals-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="signup-approvals-heading" className="text-lg font-semibold text-foreground">Signup approvals</h2>
          <p className="text-sm text-muted-foreground">Verified Fleet account requests awaiting a role assignment.</p>
        </div>
        <Button type="button" variant="outline" size="icon" title="Refresh signup requests" onClick={() => void loadRequests()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading ? <p className="text-sm text-muted-foreground">Loading requests...</p> : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No verified signup requests are waiting for review.</p>
      ) : (
        <div className="divide-y divide-border">
          {requests.map((signup) => (
            <div key={signup.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{signup.name}</p>
                <p className="text-sm text-muted-foreground">{signup.email} · {signup.department}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Assign role to ${signup.name}`}
                  className="h-9 min-w-48 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  value={roles[signup.id] ?? 'department_requester'}
                  onChange={(event) => setRoles((previous) => ({ ...previous, [signup.id]: event.target.value }))}
                  disabled={busyId === signup.id}
                >
                  {APPROVAL_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
                <Button type="button" size="sm" onClick={() => void decide(signup, true)} disabled={busyId === signup.id} title="Approve and assign role">
                  <Check className="mr-1.5 h-4 w-4" /> Approve
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void decide(signup, false)} disabled={busyId === signup.id} title="Reject signup request">
                  <X className="mr-1.5 h-4 w-4" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
