import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, employeesApi } from '../lib/api';
import { LocationFields } from './LocationFields';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

type ExperienceItem = { title: string; company: string; years: string; description: string };
type QualificationItem = { name: string; institution: string; year: string };

type ProfileForm = {
  phone: string;
  bio: string;
  skills: string[];
  experience: ExperienceItem[];
  qualifications: QualificationItem[];
  country: string;
  state: string;
  district: string;
  location: string;
};

const emptyExp = (): ExperienceItem => ({ title: '', company: '', years: '', description: '' });
const emptyQual = (): QualificationItem => ({ name: '', institution: '', year: '' });

function asList(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((v) => String(v ?? '').trim()).filter(Boolean);
}

function asExperience(val: unknown): ExperienceItem[] {
  if (!Array.isArray(val)) return [];
  return val.map((item) => {
    if (typeof item === 'string') return { title: item, company: '', years: '', description: '' };
    const o = (item || {}) as Record<string, unknown>;
    return {
      title: String(o.title ?? ''),
      company: String(o.company ?? ''),
      years: String(o.years ?? o.period ?? ''),
      description: String(o.description ?? ''),
    };
  });
}

function asQualifications(val: unknown): QualificationItem[] {
  if (!Array.isArray(val)) return [];
  return val.map((item) => {
    if (typeof item === 'string') return { name: item, institution: '', year: '' };
    const o = (item || {}) as Record<string, unknown>;
    return {
      name: String(o.name ?? o.title ?? ''),
      institution: String(o.institution ?? ''),
      year: String(o.year ?? ''),
    };
  });
}

export function SelfProfilePanel({
  onAvatarChange,
}: {
  onAvatarChange?: (avatarUrl: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [skillInput, setSkillInput] = useState('');
  const [form, setForm] = useState<ProfileForm>({
    phone: '',
    bio: '',
    skills: [],
    experience: [],
    qualifications: [],
    country: 'India',
    state: '',
    district: '',
    location: '',
  });

  const load = () => {
    setLoading(true);
    employeesApi
      .me()
      .then(({ employee }) => {
        setMissing(false);
        setEmployeeName(String(employee.name ?? ''));
        const avatar = employee.avatar ? String(employee.avatar) : null;
        setAvatarUrl(avatar);
        onAvatarChange?.(avatar);
        setForm({
          phone: String(employee.phone ?? ''),
          bio: String(employee.bio ?? ''),
          skills: asList(employee.skills),
          experience: asExperience(employee.experience),
          qualifications: asQualifications(employee.qualifications),
          country: String(employee.country || 'India'),
          state: String(employee.state || ''),
          district: String(employee.district || ''),
          location: String(employee.location || ''),
        });
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          setMissing(true);
          return;
        }
        toast.error(e instanceof ApiError ? e.message : 'Could not load profile');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s) return;
    if (form.skills.some((x) => x.toLowerCase() === s.toLowerCase())) {
      setSkillInput('');
      return;
    }
    if (form.skills.length >= 40) {
      toast.error('Maximum 40 skills');
      return;
    }
    setForm({ ...form, skills: [...form.skills, s] });
    setSkillInput('');
  };

  const saveProfile = async () => {
    if (!form.phone.trim()) {
      toast.error('Phone is required');
      return;
    }
    setSaving(true);
    try {
      const { employee } = await employeesApi.updateMe({
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        skills: form.skills,
        experience: form.experience.filter((x) => x.title.trim()),
        qualifications: form.qualifications.filter((x) => x.name.trim()),
        country: form.country,
        state: form.state,
        district: form.district,
        location: form.location,
      });
      setAvatarUrl(employee.avatar ? String(employee.avatar) : null);
      toast.success('Profile saved');
      window.dispatchEvent(new CustomEvent('employee-profile-updated'));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      toast.error('Use a PNG, JPEG, or WebP image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Photo must be 2 MB or smaller');
      return;
    }
    setPhotoBusy(true);
    try {
      const { avatar } = await employeesApi.uploadAvatar(file);
      const url = `${avatar}?t=${Date.now()}`;
      setAvatarUrl(url);
      onAvatarChange?.(url);
      toast.success('Photo updated');
      window.dispatchEvent(new CustomEvent('employee-profile-updated'));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not upload photo');
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await employeesApi.removeAvatar();
      setAvatarUrl(null);
      onAvatarChange?.(null);
      toast.success('Photo removed');
      window.dispatchEvent(new CustomEvent('employee-profile-updated'));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not remove photo');
    } finally {
      setPhotoBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="border border-border rounded-xl">
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (missing) {
    return (
      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Employee profile</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>No employee record is linked to your login yet.</p>
          <p>Ask Admin/HR to create your employee directory entry with the same email so you can manage your photo and professional details.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Profile photo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar className="size-20 ring-2 ring-primary/20">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={employeeName} /> : null}
            <AvatarFallback className="text-lg">
              {employeeName.slice(0, 2).toUpperCase() || 'ME'}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => void onPickPhoto(e.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={photoBusy}
                onClick={() => fileRef.current?.click()}
              >
                {photoBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {avatarUrl ? 'Change photo' : 'Upload photo'}
              </Button>
              {avatarUrl ? (
                <Button type="button" variant="ghost" disabled={photoBusy} onClick={() => void removePhoto()}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP · max 2 MB</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Contact & bio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="self-phone">Phone</Label>
            <Input
              id="self-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91…"
              required
            />
          </div>
          <LocationFields
            value={{
              country: form.country,
              state: form.state,
              district: form.district,
              city: form.location,
            }}
            onChange={(loc) =>
              setForm({
                ...form,
                country: loc.country,
                state: loc.state,
                district: loc.district,
                location: loc.city,
              })
            }
          />
          <div className="space-y-1.5">
            <Label htmlFor="self-bio">Bio</Label>
            <Textarea
              id="self-bio"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={4}
              maxLength={2000}
              placeholder="Short professional summary"
            />
            <p className="text-xs text-muted-foreground">{form.bio.length}/2000</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {form.skills.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1 pr-1">
                {s}
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted"
                  aria-label={`Remove ${s}`}
                  onClick={() => setForm({ ...form, skills: form.skills.filter((x) => x !== s) })}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {form.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills added yet.</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              placeholder="Add a skill"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addSkill}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Experience</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setForm({ ...form, experience: [...form.experience, emptyExp()] })}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.experience.length === 0 ? (
            <p className="text-sm text-muted-foreground">No experience entries yet.</p>
          ) : null}
          {form.experience.map((item, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-2 border rounded-lg p-3 relative">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute top-1 right-1 h-7 w-7"
                onClick={() =>
                  setForm({ ...form, experience: form.experience.filter((_, i) => i !== idx) })
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <div className="space-y-1.5">
                <Label>Title / role</Label>
                <Input
                  value={item.title}
                  onChange={(e) => {
                    const experience = [...form.experience];
                    experience[idx] = { ...item, title: e.target.value };
                    setForm({ ...form, experience });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input
                  value={item.company}
                  onChange={(e) => {
                    const experience = [...form.experience];
                    experience[idx] = { ...item, company: e.target.value };
                    setForm({ ...form, experience });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Years / period</Label>
                <Input
                  value={item.years}
                  onChange={(e) => {
                    const experience = [...form.experience];
                    experience[idx] = { ...item, years: e.target.value };
                    setForm({ ...form, experience });
                  }}
                  placeholder="2022–2024"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={item.description}
                  onChange={(e) => {
                    const experience = [...form.experience];
                    experience[idx] = { ...item, description: e.target.value };
                    setForm({ ...form, experience });
                  }}
                  rows={2}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border border-border rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Qualifications</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setForm({ ...form, qualifications: [...form.qualifications, emptyQual()] })
            }
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.qualifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No qualifications added yet.</p>
          ) : null}
          {form.qualifications.map((item, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-3 border rounded-lg p-3 relative">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute top-1 right-1 h-7 w-7"
                onClick={() =>
                  setForm({
                    ...form,
                    qualifications: form.qualifications.filter((_, i) => i !== idx),
                  })
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <div className="space-y-1.5 sm:col-span-1">
                <Label>Qualification</Label>
                <Input
                  value={item.name}
                  onChange={(e) => {
                    const qualifications = [...form.qualifications];
                    qualifications[idx] = { ...item, name: e.target.value };
                    setForm({ ...form, qualifications });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Institution</Label>
                <Input
                  value={item.institution}
                  onChange={(e) => {
                    const qualifications = [...form.qualifications];
                    qualifications[idx] = { ...item, institution: e.target.value };
                    setForm({ ...form, qualifications });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input
                  value={item.year}
                  onChange={(e) => {
                    const qualifications = [...form.qualifications];
                    qualifications[idx] = { ...item, year: e.target.value };
                    setForm({ ...form, qualifications });
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={saving} onClick={() => void saveProfile()}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save profile
        </Button>
      </div>
    </div>
  );
}
