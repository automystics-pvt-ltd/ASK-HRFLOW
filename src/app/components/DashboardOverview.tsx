import { useAccess } from '../lib/access';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { dashboardApi } from '../lib/api';
import {
  Users, Clock, DollarSign, TrendingUp, UserCheck, CalendarDays, Award, AlertCircle,
  ArrowUpRight, Plus, MessageSquare, Heart,
} from 'lucide-react';

const mockData = {
  totalEmployees: 0,
  activeEmployees: 0,
  newHires: 0,
  monthlyPayroll: 0,
  attendanceRate: 0,
  engagementScore: 87,
  pendingLeave: 0,
  recentActivities: [
    { id: 1, user: 'Sarah Johnson', action: 'Submitted leave request', time: '2 hours ago', type: 'leave' },
    { id: 2, user: 'Mike Chen', action: 'Completed performance review', time: '4 hours ago', type: 'performance' },
    { id: 3, user: 'Lisa Brown', action: 'Updated profile information', time: '6 hours ago', type: 'profile' },
    { id: 4, user: 'David Wilson', action: 'Clocked in for work', time: '8 hours ago', type: 'attendance' },
  ],
  upcomingEvents: [
    { id: 1, title: 'Team Building Workshop', date: 'Today, 2:00 PM', type: 'workshop' },
    { id: 2, title: 'Performance Reviews Due', date: 'Tomorrow', type: 'deadline' },
    { id: 3, title: 'Monthly All-Hands', date: 'Friday, 10:00 AM', type: 'meeting' },
  ],
  topPerformers: [
    { name: 'Alex Rodriguez', role: 'Senior Developer', score: 98, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face' },
    { name: 'Emma Davis', role: 'Product Manager', score: 96, avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b1d3?w=40&h=40&fit=crop&crop=face' },
    { name: 'James Wilson', role: 'Designer', score: 94, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face' },
  ],
  pendingApprovals: [
    { id: 1, type: 'Leave Request', employee: 'Sarah Johnson' },
    { id: 2, type: 'Expense Report', employee: 'Mike Chen' },
    { id: 3, type: 'Time Off', employee: 'Lisa Brown' },
  ],
};

export function DashboardOverview() {
  const { user } = useAccess();
  const [stats, setStats] = useState(mockData);
  useEffect(() => {
    dashboardApi
      .stats()
      .then(({ stats: s }) => {
        setStats((prev) => ({
          ...prev,
          totalEmployees: s.totalEmployees,
          activeEmployees: s.activeEmployees,
          newHires: s.newHires,
          monthlyPayroll: s.monthlyPayroll,
          attendanceRate: s.attendanceRate,
          pendingLeave: s.pendingLeave,
        }));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#061a52] via-[#0a3a9e] to-[#1d6bff] p-4 sm:p-6 text-primary-foreground">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-xl sm:text-2xl mb-2 !text-white">Good morning, {user?.name.split(' ')[0]}</h1>
          <p className="text-primary-foreground/80 mb-4 text-sm sm:text-base">Here's what's happening with your team today.</p>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0">
              <Users className="w-4 h-4 mr-2" />{stats.totalEmployees} Total Employees
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0">
              <UserCheck className="w-4 h-4 mr-2" />{stats.activeEmployees} Active Today
            </Badge>
          </div>
        </div>
        <div className="pointer-events-none absolute top-0 right-0 hidden sm:block w-48 lg:w-64 h-32 opacity-20">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1594892342285-9b86df3ad47a?w=1080&q=80"
            alt="Team workspace"
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {[
          { title: 'Total Employees', value: stats.totalEmployees, sub: `+${stats.newHires} new this month`, icon: Users },
          { title: 'Attendance Rate', value: `${stats.attendanceRate}%`, progress: stats.attendanceRate, icon: Clock },
          { title: 'Monthly Payroll', value: `$${(stats.monthlyPayroll / 1e6).toFixed(1)}M`, sub: '+3.2% from last month', icon: DollarSign },
          { title: 'Engagement Score', value: `${stats.engagementScore}%`, progress: stats.engagementScore, icon: Heart },
        ].map((m) => (
          <Card key={m.title} className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{m.title}</CardTitle>
              <m.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium">{m.value}</div>
              {m.progress != null && <Progress value={m.progress} className="mt-2" />}
              {m.sub && <div className="flex items-center text-xs text-muted-foreground mt-1"><ArrowUpRight className="w-3 h-3 mr-1 text-green-500" />{m.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card className="xl:col-span-2 border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" />Recent Activities</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mockData.recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {activity.type === 'leave' && <CalendarDays className="w-4 h-4 text-primary" />}
                  {activity.type === 'performance' && <TrendingUp className="w-4 h-4 text-primary" />}
                  {activity.type === 'profile' && <Users className="w-4 h-4 text-primary" />}
                  {activity.type === 'attendance' && <Clock className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.user}</p>
                  <p className="text-sm text-muted-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><Award className="w-5 h-5" />Top Performers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mockData.topPerformers.map((performer, index) => (
              <div key={performer.name} className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={performer.avatar} alt={performer.name} />
                    <AvatarFallback>{performer.name.split(' ').map((n) => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-xs text-primary-foreground font-medium">{index + 1}</div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{performer.name}</p>
                  <p className="text-xs text-muted-foreground">{performer.role}</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">{performer.score}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2"><AlertCircle className="w-5 h-5" />Pending Approvals</div>
              <Badge variant="secondary">{mockData.pendingApprovals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockData.pendingApprovals.map((approval) => (
              <div key={approval.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div><p className="text-sm font-medium">{approval.type}</p><p className="text-xs text-muted-foreground">{approval.employee}</p></div>
                <div className="flex gap-2"><Button size="sm" variant="outline" className="h-7 px-2">Reject</Button><Button size="sm" className="h-7 px-2">Approve</Button></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5" />Upcoming Events</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {mockData.upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div className="flex-1"><p className="text-sm font-medium">{event.title}</p><p className="text-xs text-muted-foreground">{event.date}</p></div>
                <Badge variant="outline">{event.type}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="h-20 flex-col gap-2"><Plus className="w-6 h-6" />Add Employee</Button>
          <Button variant="outline" className="h-20 flex-col gap-2"><Clock className="w-6 h-6" />View Attendance</Button>
          <Button variant="outline" className="h-20 flex-col gap-2"><DollarSign className="w-6 h-6" />Process Payroll</Button>
          <Button variant="outline" className="h-20 flex-col gap-2"><TrendingUp className="w-6 h-6" />Run Reports</Button>
        </CardContent>
      </Card>
    </div>
  );
}