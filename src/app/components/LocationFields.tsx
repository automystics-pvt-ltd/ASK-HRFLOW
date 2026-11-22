import React, { useMemo } from 'react';
import {
  GEO_COUNTRIES,
  findCountryByName,
  findStateByName,
  getCities,
  getStates,
} from '../lib/geo-data';
import { Label } from './ui/label';
import { SearchableSelect } from './ui/searchable-select';

export type LocationValue = {
  country: string;
  state: string;
  city: string;
};

type Props = {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  disabled?: boolean;
  /** Span country across a 2-col grid */
  fullWidth?: boolean;
};

/**
 * Cascading searchable Country → State → City selectors.
 * Changing State clears and repopulates City options.
 */
export function LocationFields({ value, onChange, disabled, fullWidth }: Props) {
  const countries = useMemo(
    () => GEO_COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
    [],
  );

  const country = findCountryByName(value.country);
  const countryCode = country?.code ?? '';
  const state = countryCode && value.state ? findStateByName(countryCode, value.state) : undefined;
  const stateCode = state?.code ?? '';

  const states = useMemo(
    () => getStates(countryCode).map((s) => ({ value: s.code, label: s.name })),
    [countryCode],
  );

  const cities = useMemo(() => {
    if (!countryCode || !stateCode) return [];
    return getCities(countryCode, stateCode).map((name) => ({ value: name, label: name }));
  }, [countryCode, stateCode]);

  const span = fullWidth ? 'md:col-span-2' : '';

  return (
    <>
      <div className={`space-y-2 ${span}`}>
        <Label htmlFor="loc-country">Country</Label>
        <SearchableSelect
          id="loc-country"
          value={countryCode}
          options={countries}
          disabled={disabled}
          placeholder="Select country"
          searchPlaceholder="Search country…"
          emptyText="No country found."
          onChange={(code) => {
            const c = GEO_COUNTRIES.find((x) => x.code === code);
            onChange({ country: c?.name ?? '', state: '', city: '' });
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="loc-state">State / Province</Label>
        <SearchableSelect
          id="loc-state"
          value={stateCode}
          options={states}
          disabled={disabled || !countryCode || states.length === 0}
          placeholder={
            !countryCode ? 'Select country first' : states.length ? 'Select state' : 'No states listed'
          }
          searchPlaceholder="Search state…"
          emptyText="No state found."
          onChange={(code) => {
            const s = getStates(countryCode).find((x) => x.code === code);
            onChange({ ...value, state: s?.name ?? '', city: '' });
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="loc-city">City</Label>
        <SearchableSelect
          id="loc-city"
          value={value.city}
          options={cities}
          disabled={disabled || !stateCode || cities.length === 0}
          placeholder={
            !stateCode ? 'Select state first' : cities.length ? 'Select city' : 'No cities listed'
          }
          searchPlaceholder="Search city…"
          emptyText="No city found."
          onChange={(city) => onChange({ ...value, city })}
        />
      </div>
    </>
  );
}
