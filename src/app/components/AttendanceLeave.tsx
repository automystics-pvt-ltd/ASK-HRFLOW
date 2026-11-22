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
import { attendanceApi, leaveApi, leaveTypesApi, shiftsApi } from '../lib/api';
import { ExpenseClaimsPanel, EmployeeActivityPanel } from './AdvancedHRPanels';
import { ApprovalReasonDialog } from './ApprovalReasonDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Clock, CalendarDays, AlertCircle, Plus, Download, MapPin, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

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

type AttendanceRow = {
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  hours: number;
  location: string;
  locationAddress?: string | null;
};

function workingDays(a: string, b: string) {
  let n = 0;
  for (let d = new Date(a + 'T00:00'); d <= new Date(b + 'T00:00'); d.setDate(d.getDate() + 1)) if (d.getDay() % 6 !== 0) n++;
  return n;
}

export function AttendanceLeave() {
  const { can } = useRole();
  const acc = useAccess();
  const me = acc.user!;
  const [requests, setRequests] = useState<LeaveReq[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<Record<string, { used: number; total: number }>>({});
  const [form, setForm] = useState({ type: '', start: '', end: '', reason: '' });
  const [isLeaveRequestOpen, setIsLeaveRequestOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('attendance');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [shifts, setShifts] = useState<{ id: number; name: string; startTime: string; endTime: string }[]>([]);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState({ name: '', startTime: '09:00', endTime: '17:00' });
  const [leaveTypes, setLeaveTypes] = useState<{ value: string; label: string }[]>([
    { value: 'vacation', label: 'Vacation' },
    { value: 'sick', label: 'Sick Leave' },
    { value: 'personal', label: 'Personal' },
  ]);
  const [leaveDecision, setLeaveDecision] = useState<{ id: number; approve: boolean } | null>(null);
  const canManageShifts = acc.can('attendance', 'update');

  const loadShifts = () => {
    shiftsApi
      .list()
      .then(({ shifts: rows }) =>
        setShifts(
          (rows ?? []).map((r) => ({
            id: Number(r.id),
            name: String(r.name ?? ''),
            startTime: String(r.start_time ?? r.startTime ?? '').slice(0, 5),
            endTime: String(r.end_time ?? r.endTime ?? '').slice(0, 5),
          })),
        ),
      )
      .catch(() => {});
  };

  useEffect(() => {
    leaveApi
      .list()
      .then(({ requests: rows }) => setRequests((rows ?? []) as LeaveReq[]))
      .catch(() => toast.error('Could not load leave requests'));
    attendanceApi
      .list()
      .then(({ attendance: rows }) => {
        setAttendance(
          (rows ?? []).map((r) => ({
            date: String(r.date ?? r.workDate).slice(0, 10),
            checkIn: r.checkIn ? new Date(String(r.checkIn)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—',
            checkOut: r.checkOut ? new Date(String(r.checkOut)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—',
            status: String(r.status ?? 'Present'),
            hours: Number(r.hours ?? 0),
            location: String(r.locationAddress || r.location || 'Location unavailable'),
            locationAddress: r.locationAddress ? String(r.locationAddress) : r.location ? String(r.location) : null,
          })),
        );
      })
      .catch(() => {});
    leaveApi
      .balances()
      .then(({ balances }) => setLeaveBalance(balances))
      .catch(() => {});
    leaveTypesApi
      .list()
      .then(({ types }) => {
        const active = (types ?? [])
          .filter((t) => t.active !== false)
          .map((t) => ({
            value: String(t.code ?? ''),
            label: String(t.name ?? t.code ?? ''),
          }))
          .filter((t) => t.value);
        if (active.length) setLeaveTypes(active);
      })
      .catch(() => {});
    loadShifts();
  }, []);

  const visibleRequests = can.canApproveLeave ? requests : requests.filter((r) => r.userId === me.id);

  const submitLeave = async () => {
    if (!form.type || !form.start || !form.end || !form.reason.trim()) {
      toast.error('Fill in all fields');
      return;
    }
    if (form.end < form.start) {
      toast.error('To Date must be on or after From Date');
      return;
    }
    const label = leaveTypes.find((t) => t.value === form.type)?.label || form.type;
    try {
      const { days: calcDays } = await leaveApi.calculateDays(form.start, form.end);
      await leaveApi.create({
        type: label,
        startDate: form.start,
        endDate: form.end,
        days: calcDays,
        reason: form.reason,
        leaveTypeCode: form.type,
      });
      const { requests: rows } = await leaveApi.list();
      setRequests((rows ?? []) as LeaveReq[]);
      toast.success('Leave request submitted');
      setIsLeaveRequestOpen(false);
      setForm({ type: '', start: '', end: '', reason: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit leave request');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-medium">Attendance & Leave</h1><p className="text-muted-foreground">Track attendance and manage leave requests</p></div>
        <div className="flex gap-2">
          {acc.can('attendance', 'export') && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                const header = 'Date,Check In,Check Out,Status,Hours,Location';
                const lines = attendance.map((a) =>
                  [a.date, a.checkIn, a.checkOut, a.status, a.hours, a.locationAddress || a.location]
                    .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                    .join(','),
                );
                const csv = [header, ...lines].join('\n');
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                a.download = 'attendance-report.csv';
                a.click();
                toast.success('Attendance report exported');
              }}
            >
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          )}
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
          {
            label: 'Attendance Rate',
            value: attendance.length
              ? `${Math.round((attendance.filter((a) => a.status === 'Present').length / attendance.length) * 100)}%`
              : '—',
            icon: TrendingUp,
          },
          { label: 'Hours Worked', value: `${Math.round(attendance.reduce((s, a) => s + a.hours, 0))}h`, icon: Clock },
          {
            label: 'Avg Hours/Day',
            value: attendance.length ? `${(attendance.reduce((s, a) => s + a.hours, 0) / attendance.length).toFixed(1)}h` : '—',
            icon: CalendarDays,
          },
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 max-w-3xl">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="space-y-6">
          <Timesheet />
          <Card className="border border-border rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Shifts
              </CardTitle>
              {canManageShifts && (
                <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1">
                      <Plus className="w-4 h-4" />
                      Add shift
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create shift</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="shift-name">Name</Label>
                        <Input
                          id="shift-name"
                          value={shiftForm.name}
                          onChange={(e) => setShiftForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Day shift"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="shift-start">Start</Label>
                          <Input
                            id="shift-start"
                            type="time"
                            value={shiftForm.startTime}
                            onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="shift-end">End</Label>
                          <Input
                            id="shift-end"
                            type="time"
                            value={shiftForm.endTime}
                            onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))}
                          />
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          if (!shiftForm.name.trim()) {
                            toast.error('Name is required');
                            return;
                          }
                          void shiftsApi
                            .create({
                              name: shiftForm.name.trim(),
                              startTime: shiftForm.startTime,
                              endTime: shiftForm.endTime,
                            })
                            .then(() => {
                              toast.success('Shift created');
                              setShiftOpen(false);
                              setShiftForm({ name: '', startTime: '09:00', endTime: '17:00' });
                              loadShifts();
                            })
                            .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not create shift'));
                        }}
                      >
                        Save shift
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {shifts.length === 0 && <p className="text-sm text-muted-foreground">No shifts configured yet.</p>}
              {shifts.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.startTime} – {s.endTime}
                    </p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border border-border rounded-xl">
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Recent Attendance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {attendance.length === 0 && <p className="text-sm text-muted-foreground">No attendance records yet.</p>}
              {attendance.map((record, index) => (
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
              {Object.keys(leaveBalance).length === 0 && <p className="text-sm text-muted-foreground col-span-full">No leave balances loaded.</p>}
              {Object.entries(leaveBalance).map(([type, bal]) => (
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
                <div key={request.id} className="flex justify-between gap-3 p-4 border rounded-lg items-center">
                  <div className="flex gap-3 min-w-0">
                    <Avatar><AvatarImage src={request.avatar} /><AvatarFallback>{request.employee.slice(0, 2)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{request.employee}</p>
                      <p className="text-sm text-muted-foreground">{request.type} · {request.days} day(s) · {request.startDate} → {request.endDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge>{request.status}</Badge>
                    {request.status === 'Pending' && can.canApproveLeave && request.userId !== me.id && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLeaveDecision({ id: request.id, approve: false })}
                        >
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => setLeaveDecision({ id: request.id, approve: true })}>
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
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
        <TabsContent value="claims">
          <ExpenseClaimsPanel />
        </TabsContent>
        <TabsContent value="activity">
          <EmployeeActivityPanel />
        </TabsContent>
      </Tabs>
      <ApprovalReasonDialog
        open={Boolean(leaveDecision)}
        title={leaveDecision?.approve ? 'Approval reason' : 'Rejection reason'}
        actionLabel={leaveDecision?.approve ? 'Approve' : 'Reject'}
        onOpenChange={(open) => {
          if (!open) setLeaveDecision(null);
        }}
        onConfirm={async (comment) => {
          if (!leaveDecision) return;
          await leaveApi.approve(leaveDecision.id, leaveDecision.approve, comment);
          const { requests: rows } = await leaveApi.list();
          setRequests((rows ?? []) as LeaveReq[]);
          toast.success(leaveDecision.approve ? 'Leave approved' : 'Leave rejected');
          setLeaveDecision(null);
        }}
      />
    </div>
  );
}

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (yyyyMmDd: string) => void;
}) {
  const selected = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected ? format(selected, 'PPP') : <span className="text-muted-foreground">Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (!d) return;
              onChange(format(d, 'yyyy-MM-dd'));
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {/* Keep native input as accessible fallback / form value mirror */}
      <Input
        type="date"
        className="sr-only"
        tabIndex={-1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-hidden
      />
    </div>
  );
}

function RegistrationDateGrid({
  form,
  setForm,
}: {
  form: { type: string; start: string; end: string; reason: string };
  setForm: React.Dispatch<React.SetStateAction<{ type: string; start: string; end: string; reason: string }>>;
}) {
  const [days, setDays] = React.useState(0);
  React.useEffect(() => {
    if (!form.start || !form.end || form.end < form.start) {
      setDays(0);
      return;
    }
    void leaveApi
      .calculateDays(form.start, form.end)
      .then(({ days: d }) => setDays(d))
      .catch(() => setDays(workingDays(form.start, form.end)));
  }, [form.start, form.end]);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DatePickerField
          label="From Date"
          value={form.start}
          onChange={(start) =>
            setForm((f) => ({
              ...f,
              start,
              end: f.end && f.end < start ? start : f.end,
            }))
          }
        />
        <DatePickerField
          label="To Date"
          value={form.end}
          onChange={(end) => setForm((f) => ({ ...f, end }))}
        />
      </div>
      {form.start && form.end && (
        <p className="text-sm text-muted-foreground">
          {form.end < form.start
            ? 'To Date must be on or after From Date.'
            : `Calculated leave days (per policy): ${days}`}
        </p>
      )}
    </div>
  );
}

function AttendanceRecordRow({
  record,
}: {
  record: { date: string; checkIn: string; checkOut: string; location: string; locationAddress?: string | null };
}) {
  return (
    <div>
      <p className="font-medium">{new Date(record.date).toLocaleDateString()}</p>
      <p className="text-sm text-muted-foreground">
        In: {record.checkIn} · Out: {record.checkOut} · <MapPin className="inline w-3 h-3" />{' '}
        {record.locationAddress || record.location}
      </p>
    </div>
  );
}