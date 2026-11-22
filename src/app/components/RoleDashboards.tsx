import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Timesheet } from './Timesheet';
import { useAccess } from '../lib/access';
import { CalendarDays, CheckCircle2, ClipboardList, Cake, Megaphone, Users, UserPlus, Clock, FileCheck2, PartyPopper } from 'lucide-react';

const card = 'border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl';
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export function WelcomeBanner({ subtitle, chips }: { subtitle: string; chips?: React.ReactNode }) {
  const { user } = useAccess();
  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#061a52] via-[#0a3a9e] to-[#1d6bff] p-4 sm:p-6 text-white">
      <h1 className="text-xl sm:text-2xl mb-1 !text-white">{greeting()}, {user?.name.split(' ')[0]}</h1>
      <p className="text-white/80 text-sm sm:text-base">{subtitle}</p>
      {chips && <div className="flex flex-wrap gap-2 mt-4">{chips}</div>}
    </div>
  );
}
const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs">{children}</span>
);

const holidays = [{ d: 'Jan 26', n: 'Republic Day' }, { d: 'Mar 14', n: 'Holi' }, { d: 'Apr 18', n: 'Good Friday' }];
const announcements = [
  { t: 'Q1 town hall', b: 'Join the all-hands on Friday at 4:00 PM.' },
  { t: 'Health insurance renewal', b: 'Review your coverage options before the month end.' },
];

function Stat({ label, value, icon: Icon, hint }: { label: string; value: React.ReactNode; icon: any; hint?: string }) {
  return (
    <Card className={card}><CardContent className="p-5 flex items-start justify-between">
      <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-medium">{value}</p>{hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}</div>
      <Icon className="w-5 h-5 text-primary" />
    </CardContent></Card>
  );
}

export function EmployeeDashboard({ go }: { go: (t: string) => void }) {
  const leave = [{ n: 'Annual', used: 6, total: 18 }, { n: 'Sick', used: 2, total: 10 }, { n: 'Casual', used: 3, total: 8 }];
  return (
    <div className="space-y-6">
      <WelcomeBanner subtitle="Here is your day at a glance." />
      <Timesheet />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Attendance this month" value="94%" icon={Clock} hint="19 of 20 working days" />
        <Stat label="Timesheet status" value={<Badge variant="secondary">Draft</Badge>} icon={FileCheck2} hint="Week due Friday" />
        <Stat label="Pending tasks" value="3" icon={ClipboardList} hint="1 due today" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card className={card}>
          <CardHeader><CardTitle className="text-base">Leave balance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {leave.map((l) => (
              <div key={l.n}><div className="flex justify-between text-sm mb-1"><span>{l.n}</span><span className="text-muted-foreground">{l.total - l.used} of {l.total} left</span></div><Progress value={(l.used / l.total) * 100} /></div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => go('attendance')}>Apply for leave</Button>
          </CardContent>
        </Card>
        <Card className={card}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4" />Upcoming holidays</CardTitle></CardHeader>
          <CardContent className="space-y-3">{holidays.map((h) => <div key={h.n} className="flex justify-between text-sm"><span>{h.n}</span><Badge variant="secondary">{h.d}</Badge></div>)}</CardContent>
        </Card>
        <Card className={card}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Megaphone className="w-4 h-4" />Announcements</CardTitle></CardHeader>
          <CardContent className="space-y-3">{announcements.map((a) => <div key={a.t}><p className="text-sm font-medium">{a.t}</p><p className="text-xs text-muted-foreground">{a.b}</p></div>)}</CardContent>
        </Card>
      </div>
    </div>
  );
}

export function HRDashboard({ go }: { go: (t: string) => void }) {
  const { can } = useAccess();
  return (
    <div className="space-y-6">
      <WelcomeBanner subtitle="People operations overview for your departments."
        chips={<><Chip><Users className="w-3.5 h-3.5" />247 employees</Chip><Chip><UserPlus className="w-3.5 h-3.5" />4 onboarding</Chip></>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Present today" value="231" icon={CheckCircle2} hint="Late arrivals: 9" />
        <Stat label="Pending leave" value="5" icon={CalendarDays} hint="Awaiting your review" />
        <Stat label="Timesheet approvals" value="12" icon={FileCheck2} hint="Submitted this week" />
        <Stat label="New joiners" value="4" icon={UserPlus} hint="This month" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={`${card} lg:col-span-2`}>
          <CardHeader><CardTitle className="text-base">HR tasks</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[['Review 5 pending leave requests', 'attendance'], ['Complete onboarding for 2 new joiners', 'employees'], ['Schedule interviews for Senior Developer', 'recruitment']].map(([t, tab]) => (
              <div key={t} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm">
                <span>{t}</span>
                <Button size="sm" variant="outline" disabled={!can(tab, 'read')} onClick={() => go(tab)}>Open</Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className={card}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cake className="w-4 h-4" />Birthdays & anniversaries</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><PartyPopper className="w-4 h-4 text-primary" />Sarah Johnson · birthday Fri</div>
            <div className="flex items-center gap-2"><PartyPopper className="w-4 h-4 text-primary" />Mike Chen · 3 years Mon</div>
            <div className="flex items-center gap-2"><PartyPopper className="w-4 h-4 text-primary" />David Wilson · 5 years Wed</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
