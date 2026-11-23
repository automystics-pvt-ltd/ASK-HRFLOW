import React, { useEffect, useState } from 'react';
import { MapPin, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { SearchableSelect } from './ui/searchable-select';
import { locationsApi, ApiError } from '../lib/api';
import { toast } from 'sonner';

export function LocationMasterPanel() {
  const [summary, setSummary] = useState({ districts: 0, cities: 0 });
  const [states, setStates] = useState<{ value: string; label: string; id: number }[]>([]);
  const [districts, setDistricts] = useState<{ value: string; label: string; id: number }[]>([]);
  const [cities, setCities] = useState<{ id: number; name: string }[]>([]);
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [newDistrict, setNewDistrict] = useState('');
  const [newCity, setNewCity] = useState('');
  const [busy, setBusy] = useState(false);

  const loadSummary = () =>
    locationsApi
      .summary()
      .then((r) => setSummary(r.tamilNadu))
      .catch(() => {});

  const loadStates = () =>
    locationsApi
      .states({ countryCode: 'IN' })
      .then(({ states: rows }) => {
        const opts = (rows ?? []).map((r) => ({
          value: String(r.id),
          label: String(r.name),
          id: Number(r.id),
        }));
        setStates(opts);
        const tn = opts.find((s) => s.label === 'Tamil Nadu');
        if (tn && !stateId) setStateId(String(tn.id));
      })
      .catch(() => {});

  const loadDistricts = (sid: number) =>
    locationsApi
      .districts({ stateId: sid })
      .then(({ districts: rows }) => {
        setDistricts(
          (rows ?? []).map((r) => ({
            value: String(r.id),
            label: String(r.name),
            id: Number(r.id),
          })),
        );
      })
      .catch(() => setDistricts([]));

  const loadCities = (sid: number, did?: number) =>
    locationsApi
      .cities({ stateId: sid, districtId: did })
      .then(({ cities: rows }) => setCities((rows ?? []).map((r) => ({ id: Number(r.id), name: String(r.name) }))))
      .catch(() => setCities([]));

  useEffect(() => {
    loadSummary();
    loadStates();
  }, []);

  useEffect(() => {
    const sid = Number(stateId);
    if (!sid) return;
    setDistrictId('');
    void loadDistricts(sid);
    void loadCities(sid);
  }, [stateId]);

  useEffect(() => {
    const sid = Number(stateId);
    const did = Number(districtId);
    if (!sid) return;
    void loadCities(sid, did || undefined);
  }, [districtId]);

  const seed = async () => {
    setBusy(true);
    try {
      const r = await locationsApi.seed();
      toast.success(`Seeded Tamil Nadu: ${r.tnDistricts} districts, ${r.tnCities} city rows`);
      await loadSummary();
      if (stateId) {
        await loadDistricts(Number(stateId));
        await loadCities(Number(stateId), Number(districtId) || undefined);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Seed failed');
    } finally {
      setBusy(false);
    }
  };

  const addDistrict = async () => {
    const sid = Number(stateId);
    const name = newDistrict.trim();
    if (!sid || !name) return;
    setBusy(true);
    try {
      await locationsApi.createDistrict({ stateId: sid, name });
      toast.success('District added');
      setNewDistrict('');
      await loadDistricts(sid);
      await loadSummary();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not add district');
    } finally {
      setBusy(false);
    }
  };

  const addCity = async () => {
    const sid = Number(stateId);
    const name = newCity.trim();
    if (!sid || !name) return;
    setBusy(true);
    try {
      await locationsApi.createCity({
        stateId: sid,
        districtId: Number(districtId) || null,
        name,
      });
      toast.success('City added');
      setNewCity('');
      await loadCities(sid, Number(districtId) || undefined);
      await loadSummary();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not add city');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border border-border rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Location master
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">TN districts: {summary.districts}/38</Badge>
          <Badge variant="secondary">TN cities: {summary.cities}</Badge>
          <Button type="button" variant="outline" size="sm" onClick={() => void seed()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Seed / refresh India & Tamil Nadu
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Central Country → State → District → City data. Tamil Nadu includes all 38 districts (Dindigul and others).
          Duplicate names are rejected.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>State</Label>
            <SearchableSelect
              value={stateId}
              options={states}
              placeholder="Select state"
              searchPlaceholder="Search state…"
              onChange={setStateId}
            />
          </div>
          <div className="space-y-2">
            <Label>District</Label>
            <SearchableSelect
              value={districtId}
              options={districts}
              placeholder={districts.length ? 'Filter by district' : 'No districts (cities at state level)'}
              searchPlaceholder="Search district…"
              onChange={setDistrictId}
              disabled={!stateId || districts.length === 0}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Add district</Label>
            <div className="flex gap-2">
              <Input value={newDistrict} onChange={(e) => setNewDistrict(e.target.value)} placeholder="District name" />
              <Button type="button" onClick={() => void addDistrict()} disabled={busy || !stateId || !newDistrict.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Add city / town</Label>
            <div className="flex gap-2">
              <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="City name" />
              <Button type="button" onClick={() => void addCity()} disabled={busy || !stateId || !newCity.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Cities in view ({cities.length})</p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2 text-sm grid grid-cols-2 md:grid-cols-3 gap-1">
            {cities.length === 0 ? (
              <span className="text-muted-foreground col-span-full px-1">No cities yet — seed Tamil Nadu or add cities.</span>
            ) : (
              cities.map((c) => (
                <span key={c.id} className="truncate px-1 py-0.5 rounded hover:bg-accent">
                  {c.name}
                </span>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
