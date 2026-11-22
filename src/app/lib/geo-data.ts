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

/** Cities keyed by `${countryCode}-${stateCode}` — includes common aliases (e.g. Bangalore). */
const CITIES: Record<string, string[]> = {
  // India — every state/UT covered
  'IN-AN': ['Port Blair', 'Diglipur', 'Havelock Island', 'Neil Island'],
  'IN-AP': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Rajahmundry', 'Kakinada',
    'Kadapa', 'Anantapur', 'Eluru', 'Ongole', 'Vizianagaram', 'Machilipatnam', 'Srikakulam', 'Chittoor',
    'Proddatur', 'Hindupur', 'Bhimavaram', 'Madanapalle', 'Gudivada', 'Tenali', 'Tadepalligudem',
  ],
  'IN-AR': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro', 'Bomdila', 'Tezu', 'Along'],
  'IN-AS': [
    'Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon',
    'Dhubri', 'Sivasagar', 'Goalpara', 'Barpeta', 'Karimganj', 'Diphu', 'North Lakhimpur',
  ],
  'IN-BR': [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Arrah', 'Begusarai',
    'Katihar', 'Munger', 'Chhapra', 'Sasaram', 'Hajipur', 'Bihar Sharif', 'Samastipur', 'Motihari',
    'Bettiah', 'Siwan', 'Aurangabad', 'Dehri',
  ],
  'IN-CH': ['Chandigarh'],
  'IN-CT': [
    'Raipur', 'Bhilai', 'Bilaspur', 'Durg', 'Korba', 'Rajnandgaon', 'Raigarh', 'Jagdalpur',
    'Ambikapur', 'Dhamtari', 'Chirmiri', 'Mahasamund',
  ],
  'IN-DL': [
    'New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Saket', 'Connaught Place', 'Karol Bagh',
    'Laxmi Nagar', 'Mayur Vihar', 'Vasant Kunj', 'Janakpuri', 'Pitampura', 'Shahdara',
    'Okhla', 'Nehru Place', 'Hauz Khas', 'Greater Kailash', 'Noida Extension',
  ],
  'IN-GA': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Calangute', 'Candolim', 'Mormugao'],
  'IN-GJ': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh',
    'Gandhidham', 'Anand', 'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch', 'Mehsana',
    'Bhuj', 'Porbandar', 'Palanpur', 'Valsad', 'Vapi', 'Godhra', 'Patan', 'Veraval',
  ],
  'IN-HR': [
    'Gurugram', 'Gurgaon', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar',
    'Karnal', 'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Jind', 'Thanesar',
    'Kaithal', 'Rewari', 'Palwal', 'Narnaul', 'Manesar',
  ],
  'IN-HP': [
    'Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Manali', 'Hamirpur', 'Una',
    'Bilaspur', 'Chamba', 'Kangra', 'Palampur', 'Nahan', 'Baddi',
  ],
  'IN-JK': [
    'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Sopore', 'Kathua', 'Udhampur', 'Rajouri',
    'Poonch', 'Kupwara', 'Pulwama', 'Budgam',
  ],
  'IN-JH': [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar', 'Giridih', 'Phusro',
    'Adityapur', 'Ramgarh', 'Medininagar', 'Chaibasa',
  ],
  'IN-KA': [
    'Bengaluru', 'Bangalore', 'Mysuru', 'Mysore', 'Mangaluru', 'Mangalore', 'Hubballi', 'Hubli',
    'Belagavi', 'Belgaum', 'Kalaburagi', 'Gulbarga', 'Ballari', 'Bellary', 'Vijayapura', 'Bijapur',
    'Davangere', 'Shivamogga', 'Shimoga', 'Tumakuru', 'Tumkur', 'Udupi', 'Raichur', 'Bidar',
    'Hosapete', 'Hassan', 'Chikkamagaluru', 'Chikmagalur', 'Kolar', 'Mandya', 'Chitradurga',
    'Gadag', 'Bagalkot', 'Yadgir', 'Karwar', 'Ranebennur', 'Bhadravati', 'Robertsonpet',
    'Channapatna', 'Ramanagara', 'Whitefield', 'Electronic City', 'Yelahanka', 'Peenya',
  ],
  'IN-KL': [
    'Thiruvananthapuram', 'Trivandrum', 'Kochi', 'Cochin', 'Kozhikode', 'Calicut', 'Thrissur',
    'Kollam', 'Kannur', 'Alappuzha', 'Alleppey', 'Kottayam', 'Palakkad', 'Malappuram', 'Manjeri',
    'Pathanamthitta', 'Kasaragod', 'Idukki', 'Ernakulam', 'Guruvayur', 'Perinthalmanna',
  ],
  'IN-LA': ['Leh', 'Kargil', 'Nubra', 'Diskit'],
  'IN-LD': ['Kavaratti', 'Agatti', 'Minicoy', 'Amini'],
  'IN-MP': [
    'Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam',
    'Rewa', 'Murwara', 'Singrauli', 'Burhanpur', 'Khandwa', 'Bhind', 'Chhindwara', 'Guna',
    'Shivpuri', 'Vidisha', 'Damoh', 'Mandsaur', 'Neemuch', 'Hoshangabad', 'Itarsi', 'Sehore',
  ],
  'IN-MH': [
    'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Chhatrapati Sambhajinagar',
    'Navi Mumbai', 'Solapur', 'Kolhapur', 'Amravati', 'Nanded', 'Sangli', 'Jalgaon', 'Akola',
    'Latur', 'Dhule', 'Ahmednagar', 'Chandrapur', 'Parbhani', 'Ichalkaranji', 'Jalna', 'Bhusawal',
    'Panvel', 'Satara', 'Beed', 'Yavatmal', 'Kamptee', 'Gondia', 'Barshi', 'Achalpur',
    'Osmanabad', 'Nandurbar', 'Wardha', 'Udgir', 'Hinganghat', 'Kalyan', 'Dombivli', 'Vasai',
    'Virar', 'Bhiwandi', 'Ulhasnagar', 'Mira-Bhayandar', 'Pimpri-Chinchwad',
  ],
  'IN-MN': ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Ukhrul', 'Kakching'],
  'IN-ML': ['Shillong', 'Tura', 'Jowai', 'Nongpoh', 'Williamnagar', 'Baghmara'],
  'IN-MZ': ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib', 'Lawngtlai'],
  'IN-NL': ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto'],
  'IN-OD': [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore',
    'Bhadrak', 'Baripada', 'Jharsuguda', 'Jeypore', 'Angul', 'Bargarh', 'Kendujhar', 'Paradeep',
  ],
  'IN-PY': ['Puducherry', 'Pondicherry', 'Karaikal', 'Mahe', 'Yanam', 'Oulgaret'],
  'IN-PB': [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'SAS Nagar',
    'Hoshiarpur', 'Pathankot', 'Moga', 'Firozpur', 'Phagwara', 'Kapurthala', 'Muktsar',
    'Barnala', 'Rajpura', 'Khanna', 'Malerkotla', 'Abohar', 'Chandigarh',
  ],
  'IN-RJ': [
    'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar',
    'Bharatpur', 'Sikar', 'Pali', 'Sri Ganganagar', 'Kishangarh', 'Beawar', 'Tonk',
    'Churu', 'Jhunjhunu', 'Sawai Madhopur', 'Hanumangarh', 'Dausa', 'Chittorgarh', 'Bundi',
  ],
  'IN-SK': ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo', 'Jorethang'],
  'IN-TN': [
    'Chennai', 'Madras', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Trichy', 'Salem',
    'Tirunelveli', 'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi', 'Tuticorin', 'Dindigul',
    'Thanjavur', 'Ranipet', 'Nagercoil', 'Kanchipuram', 'Karaikudi', 'Karur', 'Cuddalore',
    'Hosur', 'Neyveli', 'Pollachi', 'Rajapalayam', 'Sivakasi', 'Pudukkottai', 'Kumbakonam',
    'Ooty', 'Udhagamandalam', 'Ambattur', 'Avadi', 'Tambaram', 'Pallavaram',
  ],
  'IN-TS': [
    'Hyderabad', 'Secunderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar', 'Ramagundam',
    'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Suryapet', 'Siddipet', 'Miryalaguda', 'Jagtial',
    'Mancherial', 'Nirmal', 'Kothagudem', 'Bodhan', 'Sangareddy', 'Gachibowli', 'Hitech City',
    'Madhapur', 'Kondapur', 'Uppal',
  ],
  'IN-TR': ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailasahar', 'Belonia', 'Ambassa'],
  'IN-UP': [
    'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Allahabad',
    'Noida', 'Greater Noida', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur',
    'Firozabad', 'Jhansi', 'Muzaffarnagar', 'Mathura', 'Ayodhya', 'Faizabad', 'Rampur',
    'Shahjahanpur', 'Farrukhabad', 'Hapur', 'Etawah', 'Mirzapur', 'Bulandshahr', 'Sambhal',
    'Amroha', 'Hardoi', 'Fatehpur', 'Raebareli', 'Orai', 'Sitapur', 'Bahraich', 'Modinagar',
    'Unnao', 'Jaunpur', 'Lakhimpur', 'Hathras', 'Banda', 'Pilibhit', 'Loni', 'Ballia',
  ],
  'IN-UK': [
    'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Rishikesh',
    'Nainital', 'Mussoorie', 'Almora', 'Pithoragarh', 'Kotdwar', 'Ramnagar', 'Sitarganj',
  ],
  'IN-WB': [
    'Kolkata', 'Calcutta', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda',
    'Baharampur', 'Habra', 'Kharagpur', 'Shantipur', 'Dankuni', 'Dhulian', 'Ranaghat',
    'Haldia', 'Raiganj', 'Krishnanagar', 'Nabadwip', 'Medinipur', 'Jalpaiguri', 'Balurghat',
    'Bankura', 'Purulia', 'Cooch Behar', 'Alipurduar', 'Darjeeling', 'English Bazar',
  ],

  // United States — broader metro coverage
  'US-AL': ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa'],
  'US-AK': ['Anchorage', 'Fairbanks', 'Juneau'],
  'US-AZ': ['Phoenix', 'Tucson', 'Mesa', 'Scottsdale', 'Chandler', 'Tempe', 'Flagstaff'],
  'US-AR': ['Little Rock', 'Fayetteville', 'Fort Smith', 'Springdale'],
  'US-CA': [
    'San Francisco', 'Los Angeles', 'San Jose', 'San Diego', 'Sacramento', 'Oakland', 'Irvine',
    'Palo Alto', 'Mountain View', 'Sunnyvale', 'Santa Clara', 'Fremont', 'Berkeley', 'Pasadena',
    'Long Beach', 'Anaheim', 'Santa Monica', 'Menlo Park', 'Cupertino', 'Redwood City',
  ],
  'US-CO': ['Denver', 'Boulder', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood'],
  'US-CT': ['Hartford', 'New Haven', 'Stamford', 'Bridgeport', 'Norwalk'],
  'US-DE': ['Wilmington', 'Dover', 'Newark'],
  'US-DC': ['Washington'],
  'US-FL': ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'St. Petersburg', 'Tallahassee', 'West Palm Beach'],
  'US-GA': ['Atlanta', 'Savannah', 'Athens', 'Augusta', 'Columbus', 'Alpharetta'],
  'US-HI': ['Honolulu', 'Hilo', 'Kailua'],
  'US-ID': ['Boise', 'Meridian', 'Nampa', 'Idaho Falls'],
  'US-IL': ['Chicago', 'Naperville', 'Evanston', 'Springfield', 'Aurora', 'Rockford', 'Schaumburg'],
  'US-IN': ['Indianapolis', 'Fort Wayne', 'Bloomington', 'South Bend', 'Carmel'],
  'US-IA': ['Des Moines', 'Cedar Rapids', 'Iowa City', 'Davenport'],
  'US-KS': ['Wichita', 'Overland Park', 'Kansas City', 'Topeka'],
  'US-KY': ['Louisville', 'Lexington', 'Bowling Green', 'Frankfort'],
  'US-LA': ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette'],
  'US-ME': ['Portland', 'Augusta', 'Bangor'],
  'US-MD': ['Baltimore', 'Rockville', 'Bethesda', 'Annapolis', 'Frederick', 'Columbia'],
  'US-MA': ['Boston', 'Cambridge', 'Worcester', 'Somerville', 'Springfield', 'Waltham', 'Newton'],
  'US-MI': ['Detroit', 'Ann Arbor', 'Grand Rapids', 'Lansing', 'Troy'],
  'US-MN': ['Minneapolis', 'Saint Paul', 'Rochester', 'Bloomington', 'Duluth'],
  'US-MS': ['Jackson', 'Gulfport', 'Hattiesburg'],
  'US-MO': ['Kansas City', 'St. Louis', 'Springfield', 'Columbia'],
  'US-MT': ['Billings', 'Missoula', 'Bozeman', 'Helena'],
  'US-NE': ['Omaha', 'Lincoln', 'Bellevue'],
  'US-NV': ['Las Vegas', 'Reno', 'Henderson', 'Carson City'],
  'US-NH': ['Manchester', 'Nashua', 'Concord', 'Portsmouth'],
  'US-NJ': ['Jersey City', 'Newark', 'Princeton', 'Hoboken', 'Trenton', 'Paterson', 'Edison', 'Morristown'],
  'US-NM': ['Albuquerque', 'Santa Fe', 'Las Cruces'],
  'US-NY': ['New York', 'Buffalo', 'Rochester', 'Albany', 'Syracuse', 'Yonkers', 'White Plains', 'Brooklyn', 'Queens', 'Manhattan'],
  'US-NC': ['Charlotte', 'Raleigh', 'Durham', 'Greensboro', 'Winston-Salem', 'Cary', 'Asheville'],
  'US-ND': ['Fargo', 'Bismarck', 'Grand Forks'],
  'US-OH': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  'US-OK': ['Oklahoma City', 'Tulsa', 'Norman'],
  'US-OR': ['Portland', 'Eugene', 'Salem', 'Beaverton', 'Bend'],
  'US-PA': ['Philadelphia', 'Pittsburgh', 'Harrisburg', 'Allentown', 'Erie', 'Scranton'],
  'US-RI': ['Providence', 'Warwick', 'Newport'],
  'US-SC': ['Charleston', 'Columbia', 'Greenville', 'Myrtle Beach'],
  'US-SD': ['Sioux Falls', 'Rapid City', 'Pierre'],
  'US-TN': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Franklin'],
  'US-TX': [
    'Austin', 'Dallas', 'Houston', 'San Antonio', 'Fort Worth', 'Plano', 'Irving', 'Frisco',
    'Arlington', 'El Paso', 'Round Rock', 'Sugar Land',
  ],
  'US-UT': ['Salt Lake City', 'Provo', 'Ogden', 'Park City'],
  'US-VT': ['Burlington', 'Montpelier', 'South Burlington'],
  'US-VA': ['Arlington', 'Richmond', 'Virginia Beach', 'McLean', 'Alexandria', 'Norfolk', 'Reston', 'Fairfax'],
  'US-WA': ['Seattle', 'Bellevue', 'Redmond', 'Tacoma', 'Spokane', 'Kirkland', 'Olympia', 'Everett'],
  'US-WV': ['Charleston', 'Morgantown', 'Huntington'],
  'US-WI': ['Milwaukee', 'Madison', 'Green Bay', 'Appleton'],
  'US-WY': ['Cheyenne', 'Casper', 'Jackson'],

  'AE-DU': ['Dubai', 'Jebel Ali', 'Deira', 'Business Bay', 'Downtown Dubai'],
  'AE-AZ': ['Abu Dhabi', 'Al Ain', 'Yas Island'],
  'AE-SH': ['Sharjah', 'Kalba'],
  'GB-ENG': [
    'London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Cambridge', 'Oxford', 'Reading',
    'Liverpool', 'Sheffield', 'Newcastle', 'Nottingham', 'Leicester', 'Brighton', 'Coventry',
  ],
  'GB-SCT': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness'],
  'GB-WLS': ['Cardiff', 'Swansea', 'Newport'],
  'GB-NIR': ['Belfast', 'Derry', 'Lisburn'],
  'SG-SG': ['Singapore', 'Jurong', 'Tampines', 'Woodlands', 'Marina Bay'],
  'CA-ON': ['Toronto', 'Ottawa', 'Mississauga', 'Waterloo', 'Hamilton', 'London', 'Kitchener', 'Markham', 'Brampton'],
  'CA-BC': ['Vancouver', 'Victoria', 'Burnaby', 'Surrey', 'Richmond', 'Kelowna'],
  'CA-QC': ['Montreal', 'Quebec City', 'Laval', 'Gatineau'],
  'CA-AB': ['Calgary', 'Edmonton', 'Red Deer'],
  'AU-NSW': ['Sydney', 'Newcastle', 'Wollongong', 'Parramatta', 'Canberra'],
  'AU-VIC': ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo'],
  'AU-QLD': ['Brisbane', 'Gold Coast', 'Cairns', 'Townsville', 'Sunshine Coast'],
  'AU-WA': ['Perth', 'Fremantle', 'Joondalup'],
  'AU-SA': ['Adelaide'],
  'AU-ACT': ['Canberra'],
  'DE-BE': ['Berlin'],
  'DE-BY': ['Munich', 'Nuremberg', 'Augsburg'],
  'DE-HH': ['Hamburg'],
  'DE-HE': ['Frankfurt', 'Wiesbaden', 'Darmstadt'],
  'NL-NH': ['Amsterdam', 'Haarlem', 'Zaandam'],
  'NL-ZH': ['Rotterdam', 'The Hague', 'Leiden', 'Delft'],
  'IE-L': ['Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford'],
  'PH-00': ['Manila', 'Quezon City', 'Cebu City', 'Davao City', 'Makati', 'Taguig', 'Pasig', 'Bonifacio Global City'],
  'MY-14': ['Kuala Lumpur', 'Petaling Jaya', 'Shah Alam'],
  'MY-10': ['Penang', 'George Town', 'Butterworth'],
  'MY-01': ['Johor Bahru', 'Iskandar Puteri'],
  'ID-JK': ['Jakarta', 'South Jakarta', 'Central Jakarta'],
  'ID-BA': ['Denpasar', 'Bali', 'Ubud', 'Kuta'],
  'SA-01': ['Riyadh'],
  'SA-02': ['Jeddah', 'Mecca', 'Makkah', 'Taif'],
  'SA-04': ['Dammam', 'Khobar', 'Dhahran', 'Al Khobar'],
  'QA-DA': ['Doha', 'Lusail', 'Al Wakrah'],
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
  const list = CITIES[`${countryCode}-${stateCode}`] ?? [];
  // De-dupe while preserving order
  return Array.from(new Set(list));
}

export function findCountryByName(name: string): GeoCountry | undefined {
  const n = name.trim().toLowerCase();
  return GEO_COUNTRIES.find((c) => c.name.toLowerCase() === n || c.code.toLowerCase() === n);
}

export function findStateByName(countryCode: string, name: string): GeoState | undefined {
  const n = name.trim().toLowerCase();
  return getStates(countryCode).find((s) => s.name.toLowerCase() === n || s.code.toLowerCase() === n);
}
