import React, { useEffect, useState } from 'react';
import { developmentDemoAuthEnabled, useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Truck, Lock, Mail, Eye, EyeOff, AlertCircle, Building2 } from 'lucide-react';
import { entraEnabled } from '@/lib/authClient';
import { apiFetch } from '@/lib/api';

interface SignupOptions {
  departments: Array<{ code: string; label: string }>;
  roles: Array<{ key: string; label: string }>;
}

export function LoginPage() {
  const { login, signup, verifySignupEmail, loginWithEntra, requestPasswordReset, resetPassword } =
    useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupDepartmentCode, setSignupDepartmentCode] = useState('');
  const [requestedRole, setRequestedRole] = useState('');
  const [signupOptions, setSignupOptions] = useState<SignupOptions>({ departments: [], roles: [] });
  const [signupOptionsLoading, setSignupOptionsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const resetToken = hashParams.get('token');
  const signupVerificationToken = hashParams.get('signupToken');

  useEffect(() => {
    if (!isSignup) return;
    let cancelled = false;
    setSignupOptionsLoading(true);
    void apiFetch('/api/auth/signup/options')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Unable to load signup options.');
        if (cancelled) return;
        const options = result as SignupOptions;
        setSignupOptions(options);
        setSignupDepartmentCode((current) => current || options.departments[0]?.code || '');
        setRequestedRole((current) => current || options.roles[0]?.key || '');
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : 'Unable to load signup options.');
      })
      .finally(() => {
        if (!cancelled) setSignupOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setVerificationUrl('');
    setLoading(true);
    try {
      if (signupVerificationToken) {
        const message = await verifySignupEmail(signupVerificationToken);
        window.history.replaceState({}, '', window.location.pathname);
        setNotice(message);
      } else if (resetToken) {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        await resetPassword(resetToken, password);
        window.history.replaceState({}, '', window.location.pathname);
        setPassword('');
        setConfirmPassword('');
        setNotice('Password updated. Sign in with your new password.');
      } else if (isSignup) {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const result = await signup({
          name: signupName,
          email,
          departmentCode: signupDepartmentCode,
          requestedRole,
          password,
        });
        if (!result.success) {
          setError(result.error ?? 'Unable to submit signup request.');
          return;
        }
        setIsSignup(false);
        setPassword('');
        setConfirmPassword('');
        setNotice(result.message ?? 'Check your email to verify your account request.');
        setVerificationUrl(result.verificationUrl ?? '');
      } else {
        const result = await login(email, password);
        if (!result.success) setError(result.error || 'Login failed.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete the request.');
    } finally {
      setLoading(false);
    }
  };

  const handleEntraLogin = async () => {
    setError('');
    setLoading(true);
    const result = await loginWithEntra();
    setLoading(false);
    if (!result.success) setError(result.error ?? 'Microsoft sign-in failed.');
  };

  const handlePasswordResetRequest = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setNotice('If the account supports local sign-in, reset instructions will be sent.');
    } catch {
      setError('Unable to request a password reset.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = developmentDemoAuthEnabled
    ? [
        {
          role: 'System Admin',
          email: 'admin@hulma.com',
          password: 'admin123',
          color: 'text-violet-400',
        },
        {
          role: 'Fleet Manager',
          email: 'marco.reyes@hulma.com',
          password: 'fleet123',
          color: 'text-blue-400',
        },
        {
          role: 'Finance Manager',
          email: 'sandra.cruz@hulma.com',
          password: 'finance123',
          color: 'text-emerald-400',
        },
        {
          role: 'Procurement Officer',
          email: 'jose.lim@hulma.com',
          password: 'procure123',
          color: 'text-amber-400',
        },
        {
          role: 'Dept. Requester',
          email: 'ana.santos@hulma.com',
          password: 'request123',
          color: 'text-orange-400',
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 relative z-10">
        {/* Left - Branding */}
        <div className="hidden md:flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-primary shadow-lg shadow-primary/30">
              <Truck className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground leading-tight">Hulma Fleet Hub</h1>
              <p className="text-muted-foreground text-sm">Management System</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-foreground mb-3 leading-tight">
            Integrated Fleet
            <br />
            <span className="text-primary">Logistics & Maintenance</span>
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Centralized vehicle operations, automated PMS scheduling, procurement gating, and
            logistics dispatch in one platform.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['5,000 KM PMS Auto-Alert', 'PR Gatekeeper', 'TSRF Dispatch', 'RBAC Security'].map(
              (f) => (
                <span
                  key={f}
                  className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium"
                >
                  {f}
                </span>
              ),
            )}
          </div>
        </div>

        {/* Right - Login Form */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-6 md:hidden">
            <div className="p-2 rounded-xl bg-primary">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">Hulma Fleet Hub</span>
          </div>

          <h3 className="text-xl font-bold text-foreground mb-1">
            {signupVerificationToken
              ? 'Verify your email'
              : resetToken
                ? 'Reset your password'
                : isSignup
                  ? 'Request a Fleet account'
                  : 'Sign in to your account'}
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            {signupVerificationToken
              ? 'Confirm your email before your request is reviewed.'
              : resetToken
                ? 'Choose a new password for your Fleet account.'
                : isSignup
                  ? 'An administrator will assign your Fleet role after email verification.'
                  : 'Access the fleet management portal'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {notice && (
            <div className="mb-4 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              <p>{notice}</p>
              {verificationUrl && (
                <a
                  className="mt-2 inline-block font-medium text-primary underline"
                  href={verificationUrl}
                >
                  Verify this email address
                </a>
              )}
            </div>
          )}

          {!resetToken && !signupVerificationToken && !isSignup && entraEnabled && (
            <Button
              type="button"
              variant="outline"
              className="mb-4 w-full"
              disabled={loading}
              onClick={handleEntraLogin}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Continue with Microsoft
            </Button>
          )}

          {!resetToken && !signupVerificationToken && !isSignup && entraEnabled && (
            <p className="mb-4 text-center text-xs text-muted-foreground">
              Or sign in with a Fleet account
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input
                    id="signup-name"
                    value={signupName}
                    onChange={(event) => setSignupName(event.target.value)}
                    autoComplete="name"
                    minLength={2}
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-department">Department</Label>
                  <Select
                    id="signup-department"
                    value={signupDepartmentCode}
                    onChange={(event) => setSignupDepartmentCode(event.target.value)}
                    required
                    disabled={signupOptionsLoading || signupOptions.departments.length === 0}
                  >
                    {signupOptions.departments.map((department) => (
                      <option key={department.code} value={department.code}>
                        {department.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-role">Requested role</Label>
                  <Select
                    id="signup-role"
                    value={requestedRole}
                    onChange={(event) => setRequestedRole(event.target.value)}
                    required
                    disabled={signupOptionsLoading || signupOptions.roles.length === 0}
                  >
                    {signupOptions.roles.map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    An administrator makes the final role assignment.
                  </p>
                </div>
              </>
            )}

            {!resetToken && !signupVerificationToken && (
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@hulma.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
            )}

            {!signupVerificationToken && (
              <div className="space-y-1.5">
                <Label htmlFor="login-password">
                  {resetToken ? 'New password' : isSignup ? 'Password' : 'Password'}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={
                      resetToken || isSignup ? 'At least 12 characters' : 'Enter your password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9"
                    required
                    minLength={resetToken || isSignup ? 12 : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {(resetToken || isSignup) && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={12}
                  required
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                loading ||
                (isSignup &&
                  (signupOptionsLoading ||
                    !signupOptions.departments.length ||
                    !signupOptions.roles.length))
              }
            >
              {loading
                ? 'Please wait...'
                : signupVerificationToken
                  ? 'Verify Email'
                  : resetToken
                    ? 'Reset Password'
                    : isSignup
                      ? 'Submit Signup Request'
                      : 'Sign In'}
            </Button>
          </form>

          {!resetToken && !signupVerificationToken && !isSignup && (
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => void handlePasswordResetRequest()}
              disabled={loading}
            >
              Forgot password?
            </button>
          )}

          {!resetToken && !signupVerificationToken && (
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setError('');
                setNotice('');
                setVerificationUrl('');
                setIsSignup((value) => !value);
              }}
              disabled={loading}
            >
              {isSignup
                ? 'Already have an account? Sign in'
                : 'Need a Fleet account? Request access'}
            </button>
          )}

          {/* Demo accounts */}
          {!isSignup && !resetToken && !signupVerificationToken && demoAccounts.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                Quick Access — Demo Accounts
              </p>
              <div className="space-y-1.5">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword(acc.password);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors flex items-center justify-between text-xs group"
                  >
                    <span className={`font-semibold ${acc.color}`}>{acc.role}</span>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors font-mono">
                      {acc.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
