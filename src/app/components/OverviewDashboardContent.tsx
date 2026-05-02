'use client';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { DollarSign, Package, TrendingUp, AlertTriangle, Clock, Truck, Calendar } from 'lucide-react';
import KpiCard from './KpiCard';
import ActivityFeed from './ActivityFeed';
import ChatButton from '@/components/ui/ChatButton';
import { CHART_DATA } from './SpendChart';

const SpendChart = dynamic(() => import('./SpendChart'), { ssr: false });
const QuotesByCategoryChart = dynamic(() => import('./QuotesByCategoryChart'), { ssr: false });

const TIME_RANGES = [
  { id: 'range-7d', label: 'Last 7 days' },
  { id: 'range-30d', label: 'Last 30 days' },
  { id: 'range-monthly', label: 'Monthly' },
  { id: 'range-custom', label: 'Custom range' },
];

const ROLES = ['buyer', 'admin', 'viewer'] as const;
type Role = typeof ROLES[number];

const ROLE_SUBTITLES: Record<Role, string> = {
  buyer: "Sourcing performance for Honey's Org",
  admin: "Admin view — all teams & spend for Honey's Org",
  viewer: "Read-only view — Honey's Org",
};

const kpiData = {
  'range-7d': {
    spend: '$12,300', spendSub: 'vs $9,800 prev. week', spendTrend: '+25.5% vs previous period',
    active: '6', acceptance: '71%', acceptanceTrend: '+2.1% vs previous period',
    actionRequired: '2', turnaround: '4.2 days', turnaroundTrend: '-0.5 days vs last period',
    ordersInProgress: '3',
  },
  'range-30d': {
    spend: '$38,950', spendSub: 'vs $31,200 prev. month', spendTrend: '+24.9% vs previous period',
    active: '6', acceptance: '68%', acceptanceTrend: '-3.1% vs previous period',
    actionRequired: '2', turnaround: '5.1 days', turnaroundTrend: '-0.8 days vs last period',
    ordersInProgress: '3',
  },
  'range-monthly': {
    spend: '$38,950', spendSub: 'April 2026', spendTrend: '+24.9% vs March',
    active: '6', acceptance: '68%', acceptanceTrend: '-3.1% vs March',
    actionRequired: '2', turnaround: '5.1 days', turnaroundTrend: '-0.8 days vs March',
    ordersInProgress: '3',
  },
  'range-custom': {
    spend: '$172,450', spendSub: 'Nov 2025 – May 2026', spendTrend: '+31.2% vs prior 6 months',
    active: '6', acceptance: '67%', acceptanceTrend: '-1.8% overall',
    actionRequired: '2', turnaround: '5.4 days', turnaroundTrend: 'Period average',
    ordersInProgress: '3',
  },
};

export default function OverviewDashboardContent() {
  const router = useRouter();
  const [activeRange, setActiveRange] = useState('range-30d');
  const [activeRole, setActiveRole] = useState<Role>('buyer');
  const [showCustom, setShowCustom] = useState(false);
  const [chartRange, setChartRange] = useState('range-30d');
  const [chartLabel, setChartLabel] = useState(CHART_DATA['range-30d'].label);
  const [kpiKey, setKpiKey] = useState('range-30d');
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  const kpi = kpiData[activeRange as keyof typeof kpiData];

  const handleRangeChange = (id: string) => {
    setActiveRange(id);
    setKpiKey(id);
    if (id === 'range-custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      setChartRange(id);
      setChartLabel(CHART_DATA[id]?.label || '');
    }
  };

  const handleApplyCustom = () => {
    const from = fromRef.current?.value;
    const to = toRef.current?.value;
    if (from && to) {
      const fmt = (d: string) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      };
      setChartLabel(`${fmt(from)} – ${fmt(to)}`);
      setChartRange('range-custom');
    }
  };

  return (
    <div className="px-8 py-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Overview</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {ROLE_SUBTITLES[activeRole]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-[var(--border)] rounded-lg p-1">
            {ROLES.map((role) => (
              <button
                key={`role-${role}`}
                onClick={() => setActiveRole(role)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 capitalize ${
                  activeRole === role
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white border border-[var(--border)] rounded-lg p-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => handleRangeChange(r.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  activeRange === r.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showCustom && (
        <div className="mb-5 flex items-center gap-3 bg-white border border-[var(--border)] rounded-xl px-4 py-3 w-fit animate-slide-down-in">
          <Calendar size={15} className="text-[var(--muted-foreground)]" />
          <div className="flex items-center gap-2">
            <input
              ref={fromRef}
              type="date"
              defaultValue="2025-11-01"
              className="text-sm border border-[var(--border)] rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 transition-shadow duration-150"
            />
            <span className="text-[var(--muted-foreground)] text-sm">to</span>
            <input
              ref={toRef}
              type="date"
              defaultValue="2026-05-02"
              className="text-sm border border-[var(--border)] rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 transition-shadow duration-150"
            />
          </div>
          <button
            onClick={handleApplyCustom}
            className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:bg-[#2e29c4] active:scale-95 transition-all duration-150"
          >
            Apply
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div key={kpiKey} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4 mb-8 stagger-children">
        <div className="animate-slide-up">
          <KpiCard
            label="Total Spend"
            value={kpi.spend}
            subValue={kpi.spendSub}
            trend="up"
            trendValue={kpi.spendTrend}
            icon={<DollarSign size={18} className="text-primary" />}
            iconBg="bg-[var(--secondary)]"
          />
        </div>
        <div className="animate-slide-up">
          <KpiCard
            label="Active Sourcing Requests"
            value={kpi.active}
            subValue="Products currently in Quoting"
            trend="neutral"
            trendValue="Same as last period"
            icon={<Package size={18} className="text-blue-600" />}
            iconBg="bg-blue-50"
            href="/products-list"
          />
        </div>
        <div className="animate-slide-up">
          <KpiCard
            label="Quote Acceptance Rate"
            value={kpi.acceptance}
            subValue="Of all received quotes"
            trend="down"
            trendValue={kpi.acceptanceTrend}
            icon={<TrendingUp size={18} className="text-purple-600" />}
            iconBg="bg-purple-50"
          />
        </div>
        <div className="animate-slide-up">
          <KpiCard
            label="Action Required"
            value={kpi.actionRequired}
            subValue="Items needing your response"
            trend="down"
            trendValue="Needs attention now"
            alert
            icon={<AlertTriangle size={18} className="text-red-500" />}
            iconBg="bg-red-50"
            href="/products-list"
          />
        </div>
        <div className="animate-slide-up">
          <KpiCard
            label="Avg. Quote Turnaround"
            value={kpi.turnaround}
            subValue="From RFQ to first quote"
            trend="up"
            trendValue={kpi.turnaroundTrend}
            icon={<Clock size={18} className="text-amber-600" />}
            iconBg="bg-amber-50"
          />
        </div>
        <div className="animate-slide-up">
          <KpiCard
            label="Orders In Progress"
            value={kpi.ordersInProgress}
            subValue="Active production / delivery"
            trend="neutral"
            trendValue="On track"
            icon={<Truck size={18} className="text-teal-600" />}
            iconBg="bg-teal-50"
            href="/products-list"
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 transition-all duration-200 hover:shadow-md hover:shadow-black/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">Total Spend Over Time</h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Confirmed order value (USD)</p>
            </div>
            <span className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-1 rounded-md">
              {chartLabel}
            </span>
          </div>
          <SpendChart range={chartRange} />
        </div>
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 transition-all duration-200 hover:shadow-md hover:shadow-black/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">Quotes by Product Category</h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Received vs. accepted quotes</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#c7c5f8] inline-block" />Received</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />Accepted</span>
            </div>
          </div>
          <QuotesByCategoryChart range={activeRange} />
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 transition-all duration-200 hover:shadow-md hover:shadow-black/5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Recent Activity</h2>
          <button
            onClick={() => router.push('/products-list')}
            className="text-xs text-primary font-medium hover:underline transition-all duration-150"
          >
            View all
          </button>
        </div>
        <ActivityFeed limit={6} />
      </div>

      <ChatButton />
    </div>
  );
}
