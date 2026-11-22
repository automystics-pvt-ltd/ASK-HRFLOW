import React, { useEffect, useMemo, useState } from 'react';
import { locationsApi } from '../lib/api';
import { Label } from './ui/label';
import { SearchableSelect } from './ui/searchable-select';

export type LocationValue = {
  country: string;
  state: string;
  district: string;
  city: string;
};

type Props = {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  disabled?: boolean;
  fullWidth?: boolean;
};

type Opt = { value: string; label: string; id?: number };

/**
 * Cascading searchable Country → State → District → City (DB-backed).
 * District appears when the selected state has districts (e.g. Tamil Nadu).
 */
export function LocationFields({ value, onChange, disabled, fullWidth }: Props) {
  const [countries, setCountries] = useState<Opt[]>([]);
  const [states, setStates] = useState<Opt[]>([]);
  const [districts, setDistricts] = useState<Opt[]>([]);
  const [cities, setCities] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(false);

  const countryOpt = useMemo(
    () =>
      countries.find(
        (c) => c.label.toLowerCase() === value.country.toLowerCase() || c.value.toLowerCase() === value.country.toLowerCase(),
      ),
    [countries, value.country],
  );
  const stateOpt = useMemo(
    () =>
      states.find(
        (s) => s.label.toLowerCase() === value.state.toLowerCase() || s.value.toLowerCase() === value.state.toLowerCase(),
      ),
    [states, value.state],
  );
  const districtOpt = useMemo(
    () =>
      districts.find(
        (d) =>
          d.label.toLowerCase() === value.district.toLowerCase() || d.value.toLowerCase() === value.district.toLowerCase(),
      ),
    [districts, value.district],
  );

  useEffect(() => {
    let cancelled = false;
    locationsApi
      .countries()
      .then(({ countries: rows }) => {
        if (cancelled) return;
        setCountries(
          (rows ?? []).map((r) => ({
            value: String(r.code),
            label: String(r.name),
            id: Number(r.id),
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!countryOpt?.id && !countryOpt?.value) {
      setStates([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    locationsApi
      .states({ countryId: countryOpt.id, countryCode: countryOpt.value })
      .then(({ states: rows }) => {
        if (cancelled) return;
        setStates(
          (rows ?? []).map((r) => ({
            value: String(r.code),
            label: String(r.name),
            id: Number(r.id),
          })),
        );
      })
      .catch(() => setStates([]))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryOpt?.id, countryOpt?.value]);

  useEffect(() => {
    if (!stateOpt?.id) {
      setDistricts([]);
      setCities([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      locationsApi.districts({ stateId: stateOpt.id }),
      locationsApi.cities({ stateId: stateOpt.id }),
    ])
      .then(([dRes, cRes]) => {
        if (cancelled) return;
        setDistricts(
          (dRes.districts ?? []).map((r) => ({
            value: String(r.name),
            label: String(r.name),
            id: Number(r.id),
          })),
        );
        setCities(
          (cRes.cities ?? []).map((r) => ({
            value: String(r.name),
            label: String(r.name),
            id: Number(r.id),
          })),
        );
      })
      .catch(() => {
        setDistricts([]);
        setCities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [stateOpt?.id]);

  useEffect(() => {
    if (!stateOpt?.id || !districtOpt?.id) return;
    let cancelled = false;
    locationsApi
      .cities({ stateId: stateOpt.id, districtId: districtOpt.id })
      .then(({ cities: rows }) => {
        if (cancelled) return;
        setCities(
          (rows ?? []).map((r) => ({
            value: String(r.name),
            label: String(r.name),
            id: Number(r.id),
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stateOpt?.id, districtOpt?.id]);

  const span = fullWidth ? 'md:col-span-2' : '';
  const hasDistricts = districts.length > 0;

  return (
    <>
      <div className={`space-y-2 ${span}`}>
        <Label htmlFor="loc-country">Country</Label>
        <SearchableSelect
          id="loc-country"
          value={countryOpt?.value ?? ''}
          options={countries}
          disabled={disabled || loading}
          placeholder="Select country"
          searchPlaceholder="Search country…"
          emptyText="No country found."
          onChange={(code) => {
            const c = countries.find((x) => x.value === code);
            onChange({ country: c?.label ?? '', state: '', district: '', city: '' });
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="loc-state">State / Province</Label>
        <SearchableSelect
          id="loc-state"
          value={stateOpt?.value ?? ''}
          options={states}
          disabled={disabled || !countryOpt || states.length === 0}
          placeholder={
            !countryOpt ? 'Select country first' : states.length ? 'Select state' : 'No states listed'
          }
          searchPlaceholder="Search state…"
          emptyText="No state found."
          onChange={(code) => {
            const s = states.find((x) => x.value === code);
            onChange({ ...value, state: s?.label ?? '', district: '', city: '' });
          }}
        />
      </div>
      {hasDistricts || value.district ? (
        <div className="space-y-2">
          <Label htmlFor="loc-district">District</Label>
          <SearchableSelect
            id="loc-district"
            value={districtOpt?.value ?? value.district}
            options={districts}
            disabled={disabled || !stateOpt || districts.length === 0}
            placeholder={!stateOpt ? 'Select state first' : 'Search district…'}
            searchPlaceholder="Search district…"
            emptyText="No district found."
            onChange={(name) => {
              onChange({ ...value, district: name, city: '' });
            }}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="loc-city">City</Label>
        <SearchableSelect
          id="loc-city"
          value={value.city}
          options={cities}
          disabled={disabled || !stateOpt}
          placeholder={
            !stateOpt
              ? 'Select state first'
              : hasDistricts && !value.district
                ? 'Select district first (or search city)'
                : 'Search or select city'
          }
          searchPlaceholder="Search city…"
          emptyText="No city found. Type a name to use a custom city."
          allowCustom
          customLabel={(q) => `Use city “${q}”`}
          onChange={(city) => onChange({ ...value, city })}
        />
      </div>
    </>
  );
}
