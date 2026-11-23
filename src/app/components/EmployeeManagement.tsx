import React, { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import { useRole } from '../lib/roles';
import { useCurrency, formatMoney } from '../lib/currency';
import { accessApi, employeesApi } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Search, Plus, Edit, MoreVertical, Mail, MapPin, Users, UserCheck, UserX, Building, Download, Upload } from 'lucide-react';
import { LocationFields } from './LocationFields';

export type EmployeeRecord = {
  id: number;
  userId?: string | null;
  name: string;
  email: string;
  phone?: string;
  department: string;
  position: string;
  status: string;
  joinDate: string;
  /** null when API hides confidential salary from this viewer */
  salary: number | null;
  location: string;
  state: string;
  district: string;
  country: string;
  avatar?: string;
  manager?: string;
  managerUserId?: string | null;
  role?: string | null;
  skills?: string[];
};

function formatLocation(e: Pick<EmployeeRecord, 'location' | 'district' | 'state' | 'country'>) {
  return [e.location, e.district, e.state, e.country].filter(Boolean).join(', ');
}

/** Legacy type placeholder — list data comes from `/api/employees`. */
export const mockEmployees: EmployeeRecord[] = [];

const departments = ['All', 'Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'HR'];
const statuses = ['All', 'Active', 'On Leave', 'Inactive'];

function mapRow(row: Record<string, unknown>): EmployeeRecord {
  const skills = row.skills;
  return {
    id: Number(row.id),
    userId: row.user_id != null ? String(row.user_id) : row.userId != null ? String(row.userId) : null,
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    phone: row.phone ? String(row.phone) : undefined,
    department: String(row.department ?? ''),
    position: String(row.position ?? ''),
    status: String(row.status ?? 'Active'),
    joinDate: String(row.join_date ?? row.joinDate ?? '2020-01-01').slice(0, 10),
    salary: row.salary == null || row.salary === '' ? null : Number(row.salary),
    location: String(row.location ?? ''),
    state: String(row.state ?? ''),
    district: String(row.district ?? ''),
    country: String(row.country ?? 'United States'),
    avatar: row.avatar ? String(row.avatar) : undefined,
    manager: row.manager ? String(row.manager) : undefined,
    managerUserId:
      row.managerUserId != null
        ? String(row.managerUserId)
        : row.manager_user_id != null
          ? String(row.manager_user_id)
          : null,
    role: row.role != null ? String(row.role) : row.user_role != null ? String(row.user_role) : null,
    skills: Array.isArray(skills) ? skills.map(String) : typeof skills === 'string' ? skills.split(',') : [],
  };
}

export function EmployeeManagement() {
  const { can } = useRole();
  const { currencyFor } = useCurrency();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [managerOptions, setManagerOptions] = useState<
    { id: string; name: string; role: string; email: string }[]
  >([]);
  const [searchTerm, setSearchTerm] = useState(() => { const q = sessionStorage.getItem('global-search') ?? ''; sessionStorage.removeItem('global-search'); return q; });
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: 'Engineering',
    position: '',
    salary: '',
    joinDate: new Date().toISOString().slice(0, 10),
    location: '',
    state: '',
    district: '',
    country: 'India',
    managerUserId: 'none',
  });
  const [addBusy, setAddBusy] = useState(false);
  const [listError, setListError] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: 'Engineering',
    position: '',
    salary: '',
    status: 'Active',
    location: '',
    state: '',
    district: '',
    country: 'India',
    managerUserId: 'none',
  });

  const reloadEmployees = () =>
    Promise.all([
      employeesApi.list(),
      accessApi.managers().catch(() => ({ managers: [] as { id: string; name: string; role: string; email: string }[] })),
    ])
      .then(([{ employees: rows }, mgrs]) => {
        setEmployees((rows ?? []).map(mapRow));
        setManagerOptions(mgrs.managers ?? []);
      })
      .catch((e) => setListError(e instanceof Error ? e.message : 'Failed to load employees'));

  useEffect(() => {
    const on = (ev: Event) => setSearchTerm((ev as CustomEvent<string>).detail);
    window.addEventListener('global-search', on);
    return () => window.removeEventListener('global-search', on);
  }, []);

  useEffect(() => {
    void reloadEmployees();
  }, []);

  const openEdit = (employee: EmployeeRecord) => {
    setSelectedEmployee(employee);
    setEditForm({
      name: employee.name,
      email: employee.email,
      phone: employee.phone ?? '',
      department: employee.department,
      position: employee.position,
      salary: String(employee.salary || ''),
      status: employee.status,
      location: employee.location,
      state: employee.state || '',
      district: employee.district || '',
      country: employee.country,
      managerUserId: employee.managerUserId || 'none',
    });
  };

  const submitEditEmployee = async () => {
    if (!selectedEmployee) return;
    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.position.trim()) {
      toast.error('Name, email and position are required.');
      return;
    }
    if (editForm.managerUserId !== 'none' && editForm.managerUserId === selectedEmployee.userId) {
      toast.error('An employee cannot be their own manager.');
      return;
    }
    const mgr = managerOptions.find((m) => m.id === editForm.managerUserId);
    setEditBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        department: editForm.department,
        position: editForm.position.trim(),
        status: editForm.status,
        location: editForm.location.trim() || null,
        state: editForm.state.trim() || null,
        district: editForm.district.trim() || null,
        country: editForm.country,
        managerUserId: editForm.managerUserId === 'none' ? null : editForm.managerUserId,
        manager: mgr?.name ?? null,
      };
      // Only send salary when the viewer can see it — omit preserves existing confidential value
      if (selectedEmployee.salary != null || can.canEditEmployee) {
        if (editForm.salary !== '') payload.salary = Number(editForm.salary) || 0;
      }
      await employeesApi.update(selectedEmployee.id, payload);
      toast.success('Employee updated');
      setSelectedEmployee(null);
      await reloadEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update employee');
    } finally {
      setEditBusy(false);
    }
  };

  const submitAddEmployee = async () => {
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.position.trim()) {
      toast.error('Name, email and position are required.');
      return;
    }
    const mgr = managerOptions.find((m) => m.id === addForm.managerUserId);
    setAddBusy(true);
    try {
      await employeesApi.create({
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim() || null,
        department: addForm.department,
        position: addForm.position.trim(),
        salary: Number(addForm.salary) || 0,
        joinDate: addForm.joinDate,
        location: addForm.location.trim() || null,
        state: addForm.state.trim() || null,
        district: addForm.district.trim() || null,
        country: addForm.country,
        status: 'Active',
        managerUserId: addForm.managerUserId === 'none' ? null : addForm.managerUserId,
        manager: mgr?.name ?? null,
      });
      toast.success('Employee created');
      setIsAddEmployeeOpen(false);
      setAddForm({
        name: '',
        email: '',
        phone: '',
        department: 'Engineering',
        position: '',
        salary: '',
        joinDate: new Date().toISOString().slice(0, 10),
        location: '',
        state: '',
        district: '',
        country: 'India',
        managerUserId: 'none',
      });
      await reloadEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create employee');
    } finally {
      setAddBusy(false);
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === 'All' || employee.department === selectedDepartment;
    const matchesStatus = selectedStatus === 'All' || employee.status === selectedStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      Active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      'On Leave': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      Inactive: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    };
    return <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  const exportCsv = () => {
    const rows = ['Name,Email,Department,Position,Status', ...filteredEmployees.map((x) => [x.name, x.email, x.department, x.position, x.status].join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = 'employees.csv';
    a.click();
  };

  const importCsv = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        toast.error('CSV needs a header row and at least one employee');
        return;
      }
      const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const idx = (name: string) => header.findIndex((h) => h === name || h.includes(name));
      const nameI = idx('name');
      const emailI = idx('email');
      const deptI = idx('department');
      const posI = idx('position');
      if (nameI < 0 || emailI < 0) {
        toast.error('CSV must include name and email columns');
        return;
      }
      let created = 0;
      let failed = 0;
      for (const line of lines.slice(1)) {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const name = cols[nameI] || '';
        const email = cols[emailI] || '';
        if (!name || !email) {
          failed += 1;
          continue;
        }
        try {
          await employeesApi.create({
            name,
            email,
            department: (deptI >= 0 ? cols[deptI] : '') || 'Engineering',
            position: (posI >= 0 ? cols[posI] : '') || 'Team Member',
            joinDate: new Date().toISOString().slice(0, 10),
            salary: 0,
            location: '',
            country: 'India',
          });
          created += 1;
        } catch {
          failed += 1;
        }
      }
      await reloadEmployees();
      toast.success(`Imported ${created} employee(s)${failed ? `, ${failed} failed` : ''}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    }
  };

  const setStatus = async (employee: EmployeeRecord, status: string) => {
    try {
      await employeesApi.update(employee.id, { status });
      toast.success(`${employee.name} marked ${status}`);
      await reloadEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-medium">Employee Management</h1><p className="text-muted-foreground">Manage your team members and their information</p></div>
        <div className="flex gap-2">
          {can.canAddEmployee && (
            <>
              <input
                id="employee-csv-import"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  void importCsv(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => document.getElementById('employee-csv-import')?.click()}
              >
                <Upload className="w-4 h-4" />
                Import
              </Button>
            </>
          )}
          {can.canExportData && <Button variant="outline" className="gap-2" onClick={exportCsv}><Download className="w-4 h-4" />Export</Button>}
          {can.canAddEmployee && (
            <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Add Employee</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  <div className="space-y-2 md:col-span-2"><Label>Full name</Label><Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="Full name" /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="name@company.com" /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="+1 …" /></div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={addForm.department} onValueChange={(v) => setAddForm({ ...addForm, department: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{departments.slice(1).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Position</Label><Input value={addForm.position} onChange={(e) => setAddForm({ ...addForm, position: e.target.value })} placeholder="Job title" /></div>
                  <div className="space-y-2"><Label>Salary</Label><Input type="number" value={addForm.salary} onChange={(e) => setAddForm({ ...addForm, salary: e.target.value })} placeholder="0" /></div>
                  <div className="space-y-2"><Label>Start date</Label><Input type="date" value={addForm.joinDate} onChange={(e) => setAddForm({ ...addForm, joinDate: e.target.value })} /></div>
                  <LocationFields
                    fullWidth
                    value={{
                      country: addForm.country,
                      state: addForm.state,
                      district: addForm.district,
                      city: addForm.location,
                    }}
                    onChange={(loc) =>
                      setAddForm({
                        ...addForm,
                        country: loc.country,
                        state: loc.state,
                        district: loc.district,
                        location: loc.city,
                      })
                    }
                  />
                  <div className="space-y-2 md:col-span-2">
                    <Label>Reporting manager</Label>
                    <Select value={addForm.managerUserId} onValueChange={(v) => setAddForm({ ...addForm, managerUserId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No manager</SelectItem>
                        {managerOptions.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>Cancel</Button>
                  <Button disabled={addBusy} onClick={() => void submitAddEmployee()}>{addBusy ? 'Saving…' : 'Add Employee'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      {listError && <p className="text-sm text-destructive">{listError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Employees', value: employees.length, icon: Users },
          { label: 'Active', value: employees.filter((e) => e.status === 'Active').length, icon: UserCheck },
          { label: 'On Leave', value: employees.filter((e) => e.status === 'On Leave').length, icon: UserX },
          { label: 'Departments', value: departments.length - 1, icon: Building },
        ].map((s) => (
          <Card key={s.label} className="border border-border shadow-[0_8px_24px_-12px_rgba(11,87,240,0.25)] bg-gradient-to-br from-card via-card to-primary/10 rounded-xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-medium">{s.value}</p></div>
              <s.icon className="w-8 h-8 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-border rounded-xl">
        <CardContent className="p-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="table">
        <TabsList className="grid w-full grid-cols-2 max-w-md"><TabsTrigger value="table">Table View</TabsTrigger><TabsTrigger value="cards">Card View</TabsTrigger></TabsList>
        <TabsContent value="table">
          <Card className="border border-border rounded-xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar><AvatarImage src={employee.avatar} /><AvatarFallback>{employee.name.slice(0, 2)}</AvatarFallback></Avatar>
                          <div><p className="font-medium">{employee.name}</p><p className="text-sm text-muted-foreground">{employee.email}</p></div>
                        </div>
                      </TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{getStatusBadge(employee.status)}</TableCell>
                      <TableCell>{new Date(employee.joinDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(employee)} aria-label={`Edit ${employee.name}`}><Edit className="w-4 h-4" /></Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`More actions for ${employee.name}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(employee)}>View / Edit</DropdownMenuItem>
                            {can.canEditEmployee && employee.status !== 'Active' && (
                              <DropdownMenuItem onClick={() => void setStatus(employee, 'Active')}>
                                Mark Active
                              </DropdownMenuItem>
                            )}
                            {can.canEditEmployee && employee.status !== 'On Leave' && (
                              <DropdownMenuItem onClick={() => void setStatus(employee, 'On Leave')}>
                                Mark On Leave
                              </DropdownMenuItem>
                            )}
                            {can.canEditEmployee && employee.status !== 'Inactive' && (
                              <DropdownMenuItem onClick={() => void setStatus(employee, 'Inactive')}>
                                Mark Inactive
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map((employee) => (
              <Card key={employee.id} className="border border-border rounded-xl cursor-pointer" onClick={() => openEdit(employee)}>
                <CardContent className="p-6">
                  <div className="flex justify-between mb-4">
                    <motionEmployeeHeader employee={employee} />
                    {getStatusBadge(employee.status)}
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Building className="w-4 h-4" />{employee.department}</div>
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4" />{employee.email}</div>
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{formatLocation(employee) || '—'}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedEmployee && (
            <>
              <DialogHeader><DialogTitle>Edit {selectedEmployee.name}</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">
                {selectedEmployee.salary == null
                  ? 'Salary confidential'
                  : `${formatMoney(selectedEmployee.salary, currencyFor(selectedEmployee.id, selectedEmployee.country))} current salary baseline`}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                <div className="space-y-2 md:col-span-2"><Label>Full name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} disabled={!can.canEditEmployee} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} disabled={!can.canEditEmployee} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} disabled={!can.canEditEmployee} /></div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={editForm.department} onValueChange={(v) => setEditForm({ ...editForm, department: v })} disabled={!can.canEditEmployee}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{departments.slice(1).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Position</Label><Input value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} disabled={!can.canEditEmployee} /></div>
                {selectedEmployee.salary != null || can.canEditEmployee ? (
                  <div className="space-y-2">
                    <Label>Salary</Label>
                    <Input
                      type="number"
                      value={editForm.salary}
                      onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
                      disabled={!can.canEditEmployee}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Salary</Label>
                    <p className="text-sm text-muted-foreground py-2">Confidential</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })} disabled={!can.canEditEmployee}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statuses.slice(1).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <LocationFields
                  fullWidth
                  disabled={!can.canEditEmployee}
                  value={{
                    country: editForm.country,
                    state: editForm.state,
                    district: editForm.district,
                    city: editForm.location,
                  }}
                  onChange={(loc) =>
                    setEditForm({
                      ...editForm,
                      country: loc.country,
                      state: loc.state,
                      district: loc.district,
                      location: loc.city,
                    })
                  }
                />
                <div className="space-y-2 md:col-span-2">
                  <Label>Reporting manager</Label>
                  <Select
                    value={editForm.managerUserId}
                    onValueChange={(v) => setEditForm({ ...editForm, managerUserId: v })}
                    disabled={!can.canEditEmployee}
                  >
                    <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No manager</SelectItem>
                      {managerOptions
                        .filter((m) => m.id !== selectedEmployee.userId)
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.role})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedEmployee(null)}>Close</Button>
                {can.canEditEmployee && (
                  <Button disabled={editBusy} onClick={() => void submitEditEmployee()}>{editBusy ? 'Saving…' : 'Save changes'}</Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function motionEmployeeHeader({ employee }: { employee: EmployeeRecord }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="w-12 h-12"><AvatarImage src={employee.avatar} /><AvatarFallback>{employee.name.slice(0, 2)}</AvatarFallback></Avatar>
      <div><h3 className="font-medium">{employee.name}</h3><p className="text-sm text-muted-foreground">{employee.position}</p></div>
    </div>
  );
}