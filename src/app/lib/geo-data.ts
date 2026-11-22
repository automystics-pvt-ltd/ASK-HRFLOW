/** Compact Country → State → City dataset for searchable location dropdowns. */

export type GeoCountry = { code: string; name: string };
export type GeoState = { code: string; name: string };

export const GEO_COUNTRIES: GeoCountry[] = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'SG', name: 'Singapore' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PH', name: 'Philippines' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' },
].sort((a, b) => a.name.localeCompare(b.name));

const IN_STATES: GeoState[] = [
  { code: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CH', name: 'Chandigarh' },
  { code: 'CT', name: 'Chhattisgarh' },
  { code: 'DL', name: 'Delhi' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'MN', name: 'Manipur' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OD', name: 'Odisha' },
  { code: 'PY', name: 'Puducherry' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TS', name: 'Telangana' },
  { code: 'TR', name: 'Tripura' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' },
];

const US_STATES: GeoState[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

/** Cities keyed by `${countryCode}-${stateCode}` */
const CITIES: Record<string, string[]> = {
  'IN-KA': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Kalaburagi', 'Ballari', 'Udupi', 'Tumakuru', 'Shivamogga'],
  'IN-MH': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Navi Mumbai', 'Kolhapur', 'Solapur'],
  'IN-TN': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore'],
  'IN-TS': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  'IN-DL': ['New Delhi', 'Delhi'],
  'IN-HR': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar', 'Karnal'],
  'IN-UP': ['Noida', 'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj'],
  'IN-GJ': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar'],
  'IN-WB': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
  'IN-KL': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kannur'],
  'IN-RJ': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  'IN-PB': ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Mohali', 'Patiala'],
  'IN-MP': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur'],
  'IN-CT': ['Raipur', 'Bhilai', 'Bilaspur'],
  'IN-OR': ['Bhubaneswar', 'Cuttack', 'Rourkela'],
  'IN-OD': ['Bhubaneswar', 'Cuttack', 'Rourkela'],
  'IN-AS': ['Guwahati', 'Dibrugarh', 'Silchar'],
  'IN-BR': ['Patna', 'Gaya', 'Muzaffarpur'],
  'IN-JH': ['Ranchi', 'Jamshedpur', 'Dhanbad'],
  'IN-UK': ['Dehradun', 'Haridwar', 'Nainital'],
  'IN-HP': ['Shimla', 'Dharamshala', 'Solan'],
  'IN-GA': ['Panaji', 'Margao', 'Vasco da Gama'],
  'IN-CH': ['Chandigarh'],
  'IN-PY': ['Puducherry'],
  'IN-AP': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Nellore'],
  'US-CA': ['San Francisco', 'Los Angeles', 'San Jose', 'San Diego', 'Sacramento', 'Oakland', 'Irvine', 'Palo Alto'],
  'US-NY': ['New York', 'Buffalo', 'Rochester', 'Albany', 'Syracuse'],
  'US-TX': ['Austin', 'Dallas', 'Houston', 'San Antonio', 'Fort Worth', 'Plano'],
  'US-WA': ['Seattle', 'Bellevue', 'Redmond', 'Tacoma', 'Spokane'],
  'US-IL': ['Chicago', 'Naperville', 'Evanston', 'Springfield'],
  'US-MA': ['Boston', 'Cambridge', 'Worcester', 'Somerville'],
  'US-FL': ['Miami', 'Orlando', 'Tampa', 'Jacksonville'],
  'US-GA': ['Atlanta', 'Savannah', 'Athens'],
  'US-NJ': ['Jersey City', 'Newark', 'Princeton', 'Hoboken'],
  'US-CO': ['Denver', 'Boulder', 'Colorado Springs'],
  'US-NC': ['Charlotte', 'Raleigh', 'Durham'],
  'US-VA': ['Arlington', 'Richmond', 'Virginia Beach', 'McLean'],
  'US-DC': ['Washington'],
  'AE-DU': ['Dubai'],
  'AE-AZ': ['Abu Dhabi'],
  'AE-SH': ['Sharjah'],
  'GB-ENG': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Cambridge', 'Oxford', 'Reading'],
  'GB-SCT': ['Edinburgh', 'Glasgow', 'Aberdeen'],
  'GB-WLS': ['Cardiff', 'Swansea'],
  'GB-NIR': ['Belfast'],
  'SG-SG': ['Singapore'],
  'CA-ON': ['Toronto', 'Ottawa', 'Mississauga', 'Waterloo', 'Hamilton'],
  'CA-BC': ['Vancouver', 'Victoria', 'Burnaby', 'Surrey'],
  'CA-QC': ['Montreal', 'Quebec City', 'Laval'],
  'CA-AB': ['Calgary', 'Edmonton'],
  'AU-NSW': ['Sydney', 'Newcastle', 'Wollongong'],
  'AU-VIC': ['Melbourne', 'Geelong'],
  'AU-QLD': ['Brisbane', 'Gold Coast', 'Cairns'],
  'AU-WA': ['Perth'],
  'AU-SA': ['Adelaide'],
  'AU-ACT': ['Canberra'],
  'DE-BE': ['Berlin'],
  'DE-BY': ['Munich'],
  'DE-HH': ['Hamburg'],
  'DE-HE': ['Frankfurt'],
  'NL-NH': ['Amsterdam'],
  'NL-ZH': ['Rotterdam', 'The Hague'],
  'IE-L': ['Dublin', 'Cork', 'Galway', 'Limerick'],
  'PH-00': ['Manila', 'Quezon City', 'Cebu City', 'Davao City', 'Makati'],
  'MY-14': ['Kuala Lumpur'],
  'MY-10': ['Penang', 'George Town'],
  'MY-01': ['Johor Bahru'],
  'ID-JK': ['Jakarta'],
  'ID-BA': ['Denpasar', 'Bali'],
  'SA-01': ['Riyadh'],
  'SA-02': ['Jeddah', 'Mecca'],
  'SA-04': ['Dammam', 'Khobar'],
  'QA-DA': ['Doha'],
};

const STATES: Record<string, GeoState[]> = {
  IN: IN_STATES,
  US: US_STATES,
  AE: [
    { code: 'DU', name: 'Dubai' },
    { code: 'AZ', name: 'Abu Dhabi' },
    { code: 'SH', name: 'Sharjah' },
  ],
  GB: [
    { code: 'ENG', name: 'England' },
    { code: 'SCT', name: 'Scotland' },
    { code: 'WLS', name: 'Wales' },
    { code: 'NIR', name: 'Northern Ireland' },
  ],
  SG: [{ code: 'SG', name: 'Singapore' }],
  CA: [
    { code: 'ON', name: 'Ontario' },
    { code: 'BC', name: 'British Columbia' },
    { code: 'QC', name: 'Quebec' },
    { code: 'AB', name: 'Alberta' },
  ],
  AU: [
    { code: 'NSW', name: 'New South Wales' },
    { code: 'VIC', name: 'Victoria' },
    { code: 'QLD', name: 'Queensland' },
    { code: 'WA', name: 'Western Australia' },
    { code: 'SA', name: 'South Australia' },
    { code: 'ACT', name: 'Australian Capital Territory' },
  ],
  DE: [
    { code: 'BE', name: 'Berlin' },
    { code: 'BY', name: 'Bavaria' },
    { code: 'HH', name: 'Hamburg' },
    { code: 'HE', name: 'Hesse' },
  ],
  NL: [
    { code: 'NH', name: 'North Holland' },
    { code: 'ZH', name: 'South Holland' },
  ],
  IE: [{ code: 'L', name: 'Leinster' }],
  PH: [{ code: '00', name: 'Metro Manila / Major cities' }],
  MY: [
    { code: '14', name: 'Kuala Lumpur' },
    { code: '10', name: 'Penang' },
    { code: '01', name: 'Johor' },
  ],
  ID: [
    { code: 'JK', name: 'Jakarta' },
    { code: 'BA', name: 'Bali' },
  ],
  SA: [
    { code: '01', name: 'Riyadh Province' },
    { code: '02', name: 'Makkah Province' },
    { code: '04', name: 'Eastern Province' },
  ],
  QA: [{ code: 'DA', name: 'Doha' }],
};

export function getStates(countryCode: string): GeoState[] {
  return STATES[countryCode] ?? [];
}

export function getCities(countryCode: string, stateCode: string): string[] {
  return CITIES[`${countryCode}-${stateCode}`] ?? [];
}

export function findCountryByName(name: string): GeoCountry | undefined {
  const n = name.trim().toLowerCase();
  return GEO_COUNTRIES.find((c) => c.name.toLowerCase() === n || c.code.toLowerCase() === n);
}

export function findStateByName(countryCode: string, name: string): GeoState | undefined {
  const n = name.trim().toLowerCase();
  return getStates(countryCode).find((s) => s.name.toLowerCase() === n || s.code.toLowerCase() === n);
}
