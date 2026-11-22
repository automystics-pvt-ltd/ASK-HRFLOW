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
import { employeesApi } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Search, Plus, Edit, MoreVertical, Mail, MapPin, Users, UserCheck, UserX, Building, Download, Upload } from 'lucide-react';

export type EmployeeRecord = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  department: string;
  position: string;
  status: string;
  joinDate: string;
  salary: number;
  location: string;
  country: string;
  avatar?: string;
  manager?: string;
  skills?: string[];
};

/** Legacy type placeholder — list data comes from `/api/employees`. */
export const mockEmployees: EmployeeRecord[] = [];

const departments = ['All', 'Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'HR'];
const statuses = ['All', 'Active', 'On Leave', 'Inactive'];

function mapRow(row: Record<string, unknown>): EmployeeRecord {
  const skills = row.skills;
  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    phone: row.phone ? String(row.phone) : undefined,
    department: String(row.department ?? ''),
    position: String(row.position ?? ''),
    status: String(row.status ?? 'Active'),
    joinDate: String(row.join_date ?? row.joinDate ?? '2020-01-01').slice(0, 10),
    salary: row.salary == null ? 0 : Number(row.salary),
    location: String(row.location ?? ''),
    country: String(row.country ?? 'United States'),
    avatar: row.avatar ? String(row.avatar) : undefined,
    manager: row.manager ? String(row.manager) : undefined,
    skills: Array.isArray(skills) ? skills.map(String) : typeof skills === 'string' ? skills.split(',') : [],
  };
}

export function EmployeeManagement() {
  const { can } = useRole();
  const { currencyFor } = useCurrency();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => { const q = sessionStorage.getItem('global-search') ?? ''; sessionStorage.removeItem('global-search'); return q; });
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);

  useEffect(() => {
    const on = (ev: Event) => setSearchTerm((ev as CustomEvent<string>).detail);
    window.addEventListener('global-search', on);
    return () => window.removeEventListener('global-search', on);
  }, []);

  useEffect(() => {
    employeesApi.list().then(({ employees: rows }) => {
      if (rows?.length) setEmployees(rows.map(mapRow));
    }).catch(() => {});
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-medium">Employee Management</h1><p className="text-muted-foreground">Manage your team members and their information</p></div>
        <div className="flex gap-2">
          {can.canAddEmployee && <Button variant="outline" className="gap-2" onClick={() => toast.info('Import accepts a CSV with name, email, department and position columns.')}><Upload className="w-4 h-4" />Import</Button>}
          {can.canExportData && <Button variant="outline" className="gap-2" onClick={exportCsv}><Download className="w-4 h-4" />Export</Button>}
          {can.canAddEmployee && (
            <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Add Employee</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader><div className="py-4 space-y-2"><Label>Name</Label><Input placeholder="Full name" /></div></DialogContent>
            </Dialog>
          )}
        </div>
      </div>

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
                        <Button variant="ghost" size="icon" onClick={() => setSelectedEmployee(employee)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
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
              <Card key={employee.id} className="border border-border rounded-xl cursor-pointer" onClick={() => setSelectedEmployee(employee)}>
                <CardContent className="p-6">
                  <div className="flex justify-between mb-4">
                    <motionEmployeeHeader employee={employee} />
                    {getStatusBadge(employee.status)}
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Building className="w-4 h-4" />{employee.department}</div>
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4" />{employee.email}</div>
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{employee.location}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent>
          {selectedEmployee && (
            <>
              <DialogHeader><DialogTitle>{selectedEmployee.name}</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">{selectedEmployee.position} · {selectedEmployee.department}</p>
              <p className="text-sm">{formatMoney(selectedEmployee.salary, currencyFor(selectedEmployee.id, selectedEmployee.country))}</p>
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