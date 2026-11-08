/** Patient as the app and forms use it */
export interface Patient {
  id: string; createdAt: string;
  firstName: string; lastName: string; dob: string; gender: string; bloodGroup: string; marital: string; occupation: string;
  phone: string; altPhone: string; email: string; address: string; city: string; state: string; zip: string;
  height: number | null; weight: number | null; medications: string; history: string;
  allergies: string[]; conditions: string[];
  ecName: string; ecRelation: string; ecPhone: string; insurer: string; policy: string; validTill: string;
}

export type NewPatient = Omit<Patient, 'id' | 'createdAt'>;

/** Patient as the API sends and receives it */
export interface ApiAllergy { name: string; reaction?: string; }
export interface ApiCondition { name: string; notes?: string; }

export interface ApiPatient {
  id?: number | string;
  full_name: string;
  gender: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  blood_group: string;
  height_cm: number | null;
  weight_kg: number | null;
  allergies: ApiAllergy[];
  conditions: ApiCondition[];
  emergency_name: string;
  emergency_relation: string;
  emergency_phone: string;
  consent: boolean;
  created_by?: number;
  created_at?: string;
}

/** Converts between the app model and the API model */
export class PatientMapper {
  /** App model -> API body */
  static toApi(p: NewPatient, createdBy?: number): ApiPatient {
    return {
      full_name: `${p.firstName} ${p.lastName}`.trim(),
      gender: p.gender,
      dob: p.dob,
      phone: p.phone,
      email: p.email,
      address: [p.address, p.city, p.state, p.zip].filter(Boolean).join(', '),
      blood_group: p.bloodGroup,
      height_cm: p.height,
      weight_kg: p.weight,
      allergies: p.allergies.map((name) => ({ name, reaction: '' })),
      conditions: p.conditions.map((name) => ({ name, notes: '' })),
      emergency_name: p.ecName,
      emergency_relation: p.ecRelation,
      emergency_phone: p.ecPhone,
      consent: true,
      created_by: createdBy,
    };
  }

  /** API response -> app model */
  static fromApi(a: ApiPatient): Patient {
    const [first, ...rest] = (a.full_name ?? '').trim().split(/\s+/);
    return {
      id: String(a.id ?? ''),
      createdAt: a.created_at ?? new Date().toISOString(),
      firstName: first ?? '',
      lastName: rest.join(' '),
      dob: a.dob ?? '',
      gender: a.gender ?? '',
      bloodGroup: a.blood_group ?? '',
      marital: '', occupation: '',
      phone: a.phone ?? '', altPhone: '',
      email: a.email ?? '',
      address: a.address ?? '', city: '', state: '', zip: '',
      height: a.height_cm ?? null,
      weight: a.weight_kg ?? null,
      medications: '', history: '',
      allergies: (a.allergies ?? []).map((x) => x.name),
      conditions: (a.conditions ?? []).map((x) => x.name),
      ecName: a.emergency_name ?? '',
      ecRelation: a.emergency_relation ?? '',
      ecPhone: a.emergency_phone ?? '',
      insurer: '', policy: '', validTill: '',
    };
  }

  static fromApiList(list: ApiPatient[]): Patient[] {
    return (list ?? []).map((a) => PatientMapper.fromApi(a));
  }
}