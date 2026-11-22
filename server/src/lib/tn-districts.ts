/** All 38 Tamil Nadu districts with major cities/towns (HQ first). */
export type DistrictSeed = { name: string; code: string; cities: string[] };

export const TN_DISTRICTS: DistrictSeed[] = [
  { name: 'Ariyalur', code: 'ARI', cities: ['Ariyalur', 'Jayankondam', 'Udayarpalayam', 'Sendurai'] },
  {
    name: 'Chengalpattu',
    code: 'CGL',
    cities: ['Chengalpattu', 'Madurantakam', 'Tambaram', 'Pallavaram', 'Chromepet', 'Guduvancheri', 'Maraimalai Nagar', 'Thirukazhukundram'],
  },
  {
    name: 'Chennai',
    code: 'CHN',
    cities: ['Chennai', 'Madras', 'T. Nagar', 'Anna Nagar', 'Adyar', 'Velachery', 'Mylapore', 'Guindy', 'Kodambakkam', 'Perambur', 'Ambattur', 'Avadi'],
  },
  {
    name: 'Coimbatore',
    code: 'CBE',
    cities: ['Coimbatore', 'Pollachi', 'Mettupalayam', 'Sulur', 'Kinathukadavu', 'Annur', 'Valparai', 'Singanallur', 'Peelamedu', 'Ganapathy'],
  },
  {
    name: 'Cuddalore',
    code: 'CUD',
    cities: ['Cuddalore', 'Chidambaram', 'Panruti', 'Neyveli', 'Virudhachalam', 'Kurinjipadi', 'Bhuvanagiri'],
  },
  {
    name: 'Dharmapuri',
    code: 'DHA',
    cities: ['Dharmapuri', 'Harur', 'Palacode', 'Pennagaram', 'Pappireddipatti', 'Kadathur'],
  },
  {
    name: 'Dindigul',
    code: 'DGL',
    cities: ['Dindigul', 'Palani', 'Kodaikanal', 'Oddanchatram', 'Batlagundu', 'Natham', 'Vedasandur', 'Nilakottai', 'Chinnalapatti', 'Gujiliamparai'],
  },
  {
    name: 'Erode',
    code: 'ERD',
    cities: ['Erode', 'Gobichettipalayam', 'Bhavani', 'Sathyamangalam', 'Perundurai', 'Anthiyur', 'Kodumudi', 'Chennimalai'],
  },
  {
    name: 'Kallakurichi',
    code: 'KAL',
    cities: ['Kallakurichi', 'Chinnasalem', 'Ulundurpet', 'Sankarapuram', 'Tirukoilur', 'Kalvarayan Hills'],
  },
  {
    name: 'Kanchipuram',
    code: 'KAN',
    cities: ['Kanchipuram', 'Sriperumbudur', 'Walajabad', 'Uthiramerur', 'Kundrathur', 'Mangadu'],
  },
  {
    name: 'Kanniyakumari',
    code: 'KKM',
    cities: ['Nagercoil', 'Kanniyakumari', 'Kanyakumari', 'Marthandam', 'Thuckalay', 'Colachel', 'Kuzhithurai', 'Padmanabhapuram'],
  },
  {
    name: 'Karur',
    code: 'KAR',
    cities: ['Karur', 'Kulithalai', 'Pugalur', 'Krishnarayapuram', 'Aravakurichi', 'Thanthonimalai'],
  },
  {
    name: 'Krishnagiri',
    code: 'KRI',
    cities: ['Krishnagiri', 'Hosur', 'Denkanikottai', 'Pochampalli', 'Uthangarai', 'Bargur', 'Shoolagiri'],
  },
  {
    name: 'Madurai',
    code: 'MDU',
    cities: ['Madurai', 'Melur', 'Thirumangalam', 'Usilampatti', 'Vadipatti', 'Thiruparankundram', 'Avaniyapuram', 'Anaiyur'],
  },
  {
    name: 'Mayiladuthurai',
    code: 'MYD',
    cities: ['Mayiladuthurai', 'Sirkazhi', 'Kuthalam', 'Tharangambadi', 'Poompuhar', 'Kollidam'],
  },
  {
    name: 'Nagapattinam',
    code: 'NAG',
    cities: ['Nagapattinam', 'Vedaranyam', 'Kilvelur', 'Thirukuvalai', 'Velankanni', 'Thirumullaivasal'],
  },
  {
    name: 'Namakkal',
    code: 'NAM',
    cities: ['Namakkal', 'Tiruchengode', 'Rasipuram', 'Komarapalayam', 'Paramathi Velur', 'Sendamangalam'],
  },
  {
    name: 'Nilgiris',
    code: 'NIL',
    cities: ['Udhagamandalam', 'Ooty', 'Coonoor', 'Gudalur', 'Kotagiri', 'Wellington', 'Lovedale'],
  },
  {
    name: 'Perambalur',
    code: 'PER',
    cities: ['Perambalur', 'Kunnam', 'Veppanthattai', 'Alathur', 'Labbaikudikadu'],
  },
  {
    name: 'Pudukkottai',
    code: 'PDK',
    cities: ['Pudukkottai', 'Aranthangi', 'Illuppur', 'Keeranur', 'Alangudi', 'Thirumayam', 'Karambakudi'],
  },
  {
    name: 'Ramanathapuram',
    code: 'RAM',
    cities: ['Ramanathapuram', 'Rameswaram', 'Paramakudi', 'Kamuthi', 'Mudukulathur', 'Keelakarai', 'Mandapam'],
  },
  {
    name: 'Ranipet',
    code: 'RPT',
    cities: ['Ranipet', 'Arcot', 'Walajah', 'Arakkonam', 'Sholinghur', 'Kalavai', 'Nemili'],
  },
  {
    name: 'Salem',
    code: 'SLM',
    cities: ['Salem', 'Attur', 'Mettur', 'Edappadi', 'Omalur', 'Sankagiri', 'Yercaud', 'Idappadi', 'Jalakandapuram'],
  },
  {
    name: 'Sivaganga',
    code: 'SVG',
    cities: ['Sivaganga', 'Karaikudi', 'Devakottai', 'Manamadurai', 'Thirupathur', 'Ilayangudi', 'Singampunari'],
  },
  {
    name: 'Tenkasi',
    code: 'TNK',
    cities: ['Tenkasi', 'Sankarankovil', 'Kadayanallur', 'Shenkottai', 'Alangulam', 'Veerakeralamputhur', 'Courtallam'],
  },
  {
    name: 'Thanjavur',
    code: 'TNJ',
    cities: ['Thanjavur', 'Kumbakonam', 'Pattukkottai', 'Orathanadu', 'Thiruvaiyaru', 'Peravurani', 'Papanasam'],
  },
  {
    name: 'Theni',
    code: 'THN',
    cities: ['Theni', 'Periyakulam', 'Bodinayakanur', 'Cumbum', 'Uthamapalayam', 'Andipatti', 'Chinnamanur'],
  },
  {
    name: 'Thoothukudi',
    code: 'TUT',
    cities: ['Thoothukudi', 'Tuticorin', 'Kovilpatti', 'Tiruchendur', 'Ottapidaram', 'Kayathar', 'Srivaikuntam', 'Ettaiyapuram'],
  },
  {
    name: 'Tiruchirappalli',
    code: 'TPJ',
    cities: ['Tiruchirappalli', 'Trichy', 'Srirangam', 'Thuraiyur', 'Lalgudi', 'Musiri', 'Manapparai', 'Thottiyam'],
  },
  {
    name: 'Tirunelveli',
    code: 'TNV',
    cities: ['Tirunelveli', 'Palayamkottai', 'Ambasamudram', 'Nanguneri', 'Radhapuram', 'Vallioor', 'Thisayanvilai'],
  },
  {
    name: 'Tirupathur',
    code: 'TPR',
    cities: ['Tirupathur', 'Vaniyambadi', 'Ambur', 'Natrampalli', 'Jolarpet', 'Alangayam'],
  },
  {
    name: 'Tiruppur',
    code: 'TIR',
    cities: ['Tiruppur', 'Avinashi', 'Palladam', 'Dharapuram', 'Udumalaipettai', 'Kangeyam', 'Madathukulam'],
  },
  {
    name: 'Tiruvallur',
    code: 'TVL',
    cities: ['Tiruvallur', 'Poonamallee', 'Avadi', 'Pattabiram', 'Tiruttani', 'Ponneri', 'Gummidipoondi', 'Red Hills'],
  },
  {
    name: 'Tiruvannamalai',
    code: 'TVM',
    cities: ['Tiruvannamalai', 'Arni', 'Cheyyar', 'Polur', 'Chengam', 'Vandavasi', 'Kalasapakkam'],
  },
  {
    name: 'Tiruvarur',
    code: 'TVR',
    cities: ['Tiruvarur', 'Mannargudi', 'Thiruthuraipoondi', 'Nannilam', 'Needamangalam', 'Koothanallur'],
  },
  {
    name: 'Vellore',
    code: 'VEL',
    cities: ['Vellore', 'Gudiyatham', 'Katpadi', 'Anaicut', 'Pernambut', 'Kaniyambadi'],
  },
  {
    name: 'Viluppuram',
    code: 'VIL',
    cities: ['Viluppuram', 'Tindivanam', 'Gingee', 'Vanur', 'Kandachipuram', 'Marakkanam'],
  },
  {
    name: 'Virudhunagar',
    code: 'VRM',
    cities: ['Virudhunagar', 'Sivakasi', 'Rajapalayam', 'Sattur', 'Aruppukkottai', 'Sriviliputhur', 'Watrap'],
  },
];

export const TN_DISTRICT_COUNT = TN_DISTRICTS.length;
