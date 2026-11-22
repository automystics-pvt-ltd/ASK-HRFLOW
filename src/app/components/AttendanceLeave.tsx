import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Calendar } from './ui/calendar';
import { Timesheet } from './Timesheet';
import { toast } from 'sonner';
import { useAccess } from '../lib/access';
import { useRole } from '../lib/roles';
import { leaveApi } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Clock, CalendarDays, AlertCircle, Plus, Download, MapPin, TrendingUp, Coffee, Plane, Heart, Calendar as CalendarIcon } from 'lucide-react';

type LeaveReq = {
  id: number;
  userId: string;
  employee: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason: string;
  avatar?: string;
  comment?: string;
  decidedBy?: string;
};

const mockAttendanceData = [
  { date: '2024-01-15', checkIn: '09:00', checkOut: '17:30', status: 'Present', hours: 8.5, location: 'Office' },
  { date: '2024-01-14', checkIn: '09:15', checkOut: '17:45', status: 'Present', hours: 8.5, location: 'Office' },
];

const mockLeaveRequests: LeaveReq[] = [
  { id: 1, userId: 'u-emp2', employee: 'Sarah Johnson', type: 'Vacation', startDate: '2026-12-15', endDate: '2026-12-21', days: 5, status: 'Pending', reason: 'Family vacation', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b1d3?w=40&h=40&fit=crop&crop=face' },
];

const leaveTypes = [
  { value: 'vacation', label: 'Vacation', icon: Plane },
  { value: 'sick', label: 'Sick Leave', icon: Heart },
  { value: 'personal', label: 'Personal', icon: Coffee },
];

const mockLeaveBalance = { vacation: { used: 8, total: 25 }, sick: { used: 3, total: 10 }, personal: { used: 2, total: 5 }, maternity: { used: 0, total: 90 } };

function workingDays(a: string, b: string) {
  let n = 0;
  for (let d = new Date(a + 'T00:00'); d <= new Date(b + 'T00:00'); d.setDate(d.getDate() + 1)) if (d.getDay() % 6 !== 0) n++;
  return n;
}

export function AttendanceLeave() {
  const { can } = useRole();
  const acc = useAccess();
  const me = acc.user!;
  const [requests, setRequests] = useState<LeaveReq[]>(mockLeaveRequests);
  const [form, setForm] = useState({ type: '', start: '', end: '', reason: '' });
  const [isLeaveRequestOpen, setIsLeaveRequestOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('attendance');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    leaveApi.list().then(({ requests: rows }) => {
      if (rows?.length) setRequests(rows as LeaveReq[]);
    }).catch(() => {});
  }, []);

  const visibleRequests = can.canApproveLeave ? requests : requests.filter((r) => r.userId === me.id);

  const submitLeave = async () => {
    if (!form.type || !form.start || !form.end || !form.reason.trim()) {
      toast.error('Fill in all fields');
      return;
    }
    const days = workingDays(form.start, form.end);
    const label = leaveTypes.find((t) => t.value === form.type)!.label;
    try {
      await leaveApi.create({ type: label, startDate: form.start, endDate: form.end, days, reason: form.reason });
      setRequests((r) => [{ id: Date.now(), userId: me.id, employee: me.name, type: label, startDate: form.start, endDate: form.end, days, status: 'Pending', reason: form.reason }, ...r]);
      toast.success('Leave request submitted');
      setIsLeaveRequestOpen(false);
      setForm({ type: '', start: '', end: '', reason: '' });
    } catch {
      setRequests((r) => [{ id: Date.now(), userId: me.id, employee: me.name, type: label, startDate: form.start, endDate: form.end, days, status: 'Pending', reason: form.reason }, ...r]);
      toast.success('Leave request submitted (offline)');
      setIsLeaveRequestOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-medium">Attendance & Leave</h1><p className="text-muted-foreground">Track attendance and manage leave requests</p></div>
        <div className="flex gap-2">
          {acc.can('attendance', 'export') && <Button variant="outline" className="gap-2"><Download className="w-4 h-4" />Export Report</Button>}
          <Dialog open={isLeaveRequestOpen} onOpenChange={setIsLeaveRequestOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Request Leave</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Leave type" /></SelectTrigger>
                  <SelectContent>{leaveTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <RegistrationDateGrid form={form} setForm={setForm} />
                <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason" />
              </div>
              <Button onClick={() => void submitLeave()}>Submit</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Attendance Rate', value: '94.2%', icon: TrendingUp },
          { label: 'Hours Worked', value: '168h', icon: Clock },
          { label: 'Avg Hours/Day', value: '8.4h', icon: CalendarDays },
          { label: 'Pending Leave', value: String(visibleRequests.filter((r) => r.status === 'Pending').length), icon: AlertCircle },
        ].map((s) => (
          <Card key={s.label} className="border border-border rounded-xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-medium">{s.value}</p></div>
              <s.icon className="w-8 h-8 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="space-y-6">
          <Timesheet />
          <Card className="border border-border rounded-xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Recent Attendance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {mockAttendanceData.map((record, index) => (
                <div key={index} className="flex justify-between p-4 rounded-lg border border-border/50">
                  <AttendanceRecordRow record={record} />
                  <Badge>{record.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="leave" className="space-y-6">
          <Card className="border border-border rounded-xl">
            <CardHeader><CardTitle>Leave Balance</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-4 gap-4">
              {Object.entries(mockLeaveBalance).map(([type, bal]) => (
                <div key={type} className="p-4 border rounded-lg">
                  <p className="font-medium capitalize mb-2">{type}</p>
                  <Progress value={(bal.used / bal.total) * 100} />
                  <p className="text-xs text-muted-foreground mt-2">{bal.used}/{bal.total} days used</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border border-border rounded-xl">
            <CardHeader><CardTitle>Leave Requests</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {visibleRequests.map((request) => (
                <div key={request.id} className="flex justify-between p-4 border rounded-lg">
                  <div className="flex gap-3">
                    <Avatar><AvatarImage src={request.avatar} /><AvatarFallback>{request.employee.slice(0, 2)}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-medium">{request.employee}</p>
                      <p className="text-sm text-muted-foreground">{request.type} · {request.days} day(s)</p>
                    </div>
                  </div>
                  <Badge>{request.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="calendar">
          <Card className="border border-border rounded-xl">
            <CardContent className="p-4"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RegistrationDateGrid({ form, setForm }: { form: { type: string; start: string; end: string; reason: string }; setForm: React.Dispatch<React.SetStateAction<{ type: string; start: string; end: string; reason: string }>> }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2"><Label>Start</Label><Input type="date" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} /></div>
      <div className="space-y-2"><Label>End</Label><Input type="date" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} /></div>
    </div>
  );
}

function AttendanceRecordRow({ record }: { record: { date: string; checkIn: string; checkOut: string; location: string } }) {
  return (
    <div>
      <p className="font-medium">{new Date(record.date).toLocaleDateString()}</p>
      <p className="text-sm text-muted-foreground">In: {record.checkIn} · Out: {record.checkOut} · <MapPin className="inline w-3 h-3" /> {record.location}</p>
    </div>
  );
}