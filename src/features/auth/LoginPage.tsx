import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Login failed.');
    }
  };

  const demoAccounts = [
    { role: 'System Admin', email: 'admin@hulma.com', password: 'admin123', color: 'text-violet-400' },
    { role: 'Fleet Manager', email: 'marco.reyes@hulma.com', password: 'fleet123', color: 'text-blue-400' },
    { role: 'Finance Manager', email: 'sandra.cruz@hulma.com', password: 'finance123', color: 'text-emerald-400' },
    { role: 'Procurement Officer', email: 'jose.lim@hulma.com', password: 'procure123', color: 'text-amber-400' },
    { role: 'Dept. Requester', email: 'ana.santos@hulma.com', password: 'request123', color: 'text-orange-400' },
  ];

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
              <h1 className="text-2xl font-bold text-foreground leading-tight">
                Hulma Fleet Hub
              </h1>
              <p className="text-muted-foreground text-sm">Management System</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-foreground mb-3 leading-tight">
            Integrated Fleet<br />
            <span className="text-primary">Logistics & Maintenance</span>
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Centralized vehicle operations, automated PMS scheduling, procurement gating, and logistics dispatch in one platform.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['5,000 KM PMS Auto-Alert', 'PR Gatekeeper', 'TSRF Dispatch', 'RBAC Security'].map((f) => (
              <span key={f} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                {f}
              </span>
            ))}
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

          <h3 className="text-xl font-bold text-foreground mb-1">Sign in to your account</h3>
          <p className="text-muted-foreground text-sm mb-6">Access the fleet management portal</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9"
                  required
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Quick Access — Demo Accounts</p>
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
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors font-mono">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
