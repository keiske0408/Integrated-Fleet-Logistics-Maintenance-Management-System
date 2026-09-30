import React from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useRoles } from '@/features/roles/RolesContext';
import { Truck, Wrench, Shield, Calendar, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  trend?: string;
  trendColor?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, trend, trendColor }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trendColor}`}>{trend}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground mb-0.5">{value}</p>
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

export function DashboardOverview() {
  const { currentUser } = useAuth();
  const { roles } = useRoles();
  const currentRoleDef = roles.find((r) => r.key === currentUser?.role);

  const stats: StatCardProps[] = [
    {
      title: 'Active Vehicles',
      value: 8,
      subtitle: '2 with PMS due soon',
      icon: Truck,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/10',
      trend: '+2 this month',
      trendColor: 'bg-blue-500/10 text-blue-400',
    },
    {
      title: 'PMS Alerts',
      value: 2,
      subtitle: '1 overdue, 1 approaching',
      icon: Wrench,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      trend: '⚠ Action needed',
      trendColor: 'bg-amber-500/10 text-amber-400',
    },
    {
      title: 'Pending PRs',
      value: 3,
      subtitle: '₱ 24,700 total value',
      icon: Shield,
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/10',
      trend: '1 awaiting finance',
      trendColor: 'bg-violet-500/10 text-violet-400',
    },
    {
      title: 'Open TSRFs',
      value: 5,
      subtitle: '2 dispatched today',
      icon: Calendar,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      trend: 'On schedule',
      trendColor: 'bg-emerald-500/10 text-emerald-400',
    },
  ];

  const recentActivity = [
    { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', text: 'Vehicle XYZ-9876 is overdue for 5,000 KM PMS service', time: '2 hrs ago' },
    { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', text: 'PR-2026-1011 approved by Finance Manager (₱6,200)', time: '4 hrs ago' },
    { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', text: 'TSRF-0042 dispatched — IT Department → Main Office', time: '5 hrs ago' },
    { icon: Wrench, color: 'text-violet-400', bg: 'bg-violet-500/10', text: 'Work Order WO-2026-0041 created for brake overhaul', time: 'Yesterday' },
    { icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10', text: 'NCR-5566 odometer logged at 9,800 KM (PMS in 200 KM)', time: 'Yesterday' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Welcome back, {currentUser?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Here's what's happening with the fleet today.
            </p>
          </div>
          {currentRoleDef && (
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border shrink-0 ${currentRoleDef.color}`}>
                {currentRoleDef.label}
              </span>
            )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className={`p-1.5 rounded-lg ${item.bg} shrink-0 mt-0.5`}>
                  <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{item.text}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick access modules */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">System Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Truck, label: 'Fleet & KM Monitoring', desc: 'Track vehicles and PMS schedules', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { icon: Shield, label: 'PR Gatekeeper', desc: 'Manage purchase requisitions', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
            { icon: Calendar, label: 'TSRF Logistics', desc: 'Service request & dispatch', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className={`p-4 rounded-xl border ${m.border} ${m.bg} hover:scale-[1.02] transition-transform cursor-default`}>
                <Icon className={`h-6 w-6 ${m.color} mb-2`} />
                <p className="font-semibold text-foreground text-sm">{m.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
