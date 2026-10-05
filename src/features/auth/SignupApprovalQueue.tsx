import React, { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api';
import { Building2, Check, Clock3, Inbox, RefreshCw, X } from 'lucide-react';

interface PendingSignup {
  id: string;
  name: string;
  email: string;
  department: string;
  requestedRole: string | null;
  createdAt: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  assignedRole: string | null;
  linkedUserId: string | null;
  reviewedAt: string | null;
}

type RequestStatus = 'pending' | 'approved' | 'rejected';

const REQUEST_STATUSES: Array<{ value: RequestStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Disapproved' },
];

interface SignupOptions {
  roles: Array<{ key: string; label: string }>;
}

export function SignupApprovalQueue() {
  const [requests, setRequests] = useState<PendingSignup[]>([]);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('pending');
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [approvalRoles, setApprovalRoles] = useState<SignupOptions['roles']>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { success: toastSuccess, error: toastError } = useToast();

  useEffect(() => {
    void apiFetch('/api/auth/signup/options')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Unable to load role catalog.');
        setApprovalRoles((result as SignupOptions).roles);
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load role catalog.'),
      );
  }, []);

  const loadRequests = useCallback(async (status: RequestStatus) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`/api/auth/signup/requests?status=${status}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to load signup requests.');
      setRequests(result as PendingSignup[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load signup requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests(requestStatus);
  }, [loadRequests, requestStatus]);

  const decide = async (signup: PendingSignup, approve: boolean) => {
    setBusyId(signup.id);
    setError('');
    try {
      const response = await apiFetch(
        approve
          ? `/api/auth/signup/requests/${encodeURIComponent(signup.id)}/approve`
          : `/api/auth/signup/requests/${encodeURIComponent(signup.id)}`,
        {
          method: approve ? 'POST' : 'DELETE',
          ...(approve
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: roles[signup.id] ?? 'department_requester' }),
              }
            : {}),
        },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? 'Unable to update signup request.');
      }
      toastSuccess(
        approve
          ? `${signup.name} approved and added to Users.`
          : `${signup.name}'s request disapproved.`,
      );
      await loadRequests(requestStatus);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to update signup request.';
      setError(message);
      toastError(message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="signup-approvals-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="signup-approvals-heading" className="text-lg font-semibold text-foreground">
            Signup approvals
          </h2>
          <p className="text-sm text-muted-foreground">
            Verified Fleet account requests awaiting a role assignment.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Refresh signup requests"
          onClick={() => void loadRequests(requestStatus)}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div
        role="tablist"
        aria-label="Signup request statuses"
        className="flex items-center gap-2 bg-muted/40 p-0.5 rounded-lg w-fit"
      >
        {REQUEST_STATUSES.map((status) => (
          <button
            key={status.value}
            type="button"
            role="tab"
            aria-selected={requestStatus === status.value}
            onClick={() => setRequestStatus(status.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium ${requestStatus === status.value ? 'bg-card shadow-sm text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading requests...</p>
      ) : requests.length === 0 ? (
        <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
          <Inbox className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {requestStatus === 'pending'
              ? 'No requests awaiting review'
              : `No ${requestStatus} signup requests`}
          </p>
          <p className="text-xs text-muted-foreground">
            {requestStatus === 'pending'
              ? 'Verified account requests will appear here.'
              : 'Decisions will remain available here for review.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((signup) => (
            <article
              key={signup.id}
              className="flex flex-col gap-4 rounded-lg border border-border bg-card/50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-foreground">
                  {signup.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0] ?? '')
                    .join('')
                    .toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{signup.name}</p>
                    <Badge
                      variant={
                        signup.status === 'pending_approval'
                          ? 'secondary'
                          : signup.status === 'approved'
                            ? 'default'
                            : 'destructive'
                      }
                    >
                      {signup.status === 'pending_approval'
                        ? 'Pending'
                        : signup.status === 'approved'
                          ? 'Approved'
                          : 'Disapproved'}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{signup.email}</span>
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {signup.department}
                    </span>
                  </div>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    {signup.status === 'pending_approval'
                      ? `Requested role: ${approvalRoles.find((role) => role.key === signup.requestedRole)?.label ?? signup.requestedRole ?? 'Not specified'}`
                      : signup.status === 'approved'
                        ? `Assigned role: ${approvalRoles.find((role) => role.key === signup.assignedRole)?.label ?? signup.assignedRole ?? 'Assigned'}`
                        : 'Request declined'}
                    {' · '}
                    {new Date(signup.reviewedAt ?? signup.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {signup.status === 'pending_approval' && (
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <select
                    aria-label={`Assign role to ${signup.name}`}
                    className="h-9 min-w-48 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                    value={roles[signup.id] ?? signup.requestedRole ?? approvalRoles[0]?.key ?? ''}
                    onChange={(event) =>
                      setRoles((previous) => ({ ...previous, [signup.id]: event.target.value }))
                    }
                    disabled={busyId === signup.id || approvalRoles.length === 0}
                  >
                    {approvalRoles.map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void decide(signup, true)}
                    disabled={busyId === signup.id || approvalRoles.length === 0}
                    title="Approve and assign role"
                  >
                    <Check className="mr-1.5 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void decide(signup, false)}
                    disabled={busyId === signup.id}
                    title="Reject signup request"
                  >
                    <X className="mr-1.5 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
