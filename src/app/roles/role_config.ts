export type Role = 'receptionist' | 'nurse' | 'doctor' | 'admin';

export type LoadKey =
  | 'opd' | 'patients' | 'appointments' | 'billing'
  | 'followUps' | 'prescriptions' | 'inventory' | 'users';

export interface MenuItem {
  label: string;
  path: string;
  /** true = page is view-only for this role (use it to hide Save/Edit buttons). */
  readOnly?: boolean;
}

export interface RoleConfig {
  label: string;
  home: string;       // page to open right after login (must be in the menu)
  menu: MenuItem[];   // sidebar items for this role
  load: LoadKey[];    // which data to load after login
}

// ---------- pages ----------
const DASH  = { label: 'Dashboard',       path: '/dashboard' };
const NDASH = { label: 'Dashboard',       path: '/dashboards' };      // nurse dashboard (existing route)
const RECP  = { label: 'Dashboard',       path: '/reception' };
const APPT  = { label: 'Appointments',    path: '/appointments' };
const PATS  = { label: 'Patients',        path: '/patients' };
const OPD   = { label: 'OPD Queue',       path: '/opd' };
const BILL  = { label: 'Billing',         path: '/billing' };
const TRI   = { label: 'Vitals & Triage', path: '/triage' };
const HIST  = { label: 'Patient History', path: '/patient-history' };
const TASK  = { label: 'Nursing Tasks',   path: '/nursing-tasks' };
const CONS  = { label: 'Consultation',    path: '/consultation' };
const REC   = { label: 'Records',         path: '/record' };
const REP   = { label: 'Reports',         path: '/reports' };
const DPAT  = { label: 'My Patients',     path: '/patient' };         // doctor's own patients (existing route)
const SET   = { label: 'Settings',        path: '/settings' };

// ---------- new pages ----------
const FUP   = { label: 'Follow-ups',      path: '/follow-ups' };
const RX    = { label: 'Prescriptions',   path: '/prescriptions' };
const LAB   = { label: 'Lab Results',     path: '/lab-results' };
const STOCK = { label: 'Stock',           path: '/stock' };
const USERS = { label: 'Users & Roles',   path: '/users' };
const AUDIT = { label: 'Audit Log',       path: '/audit-log' };

// ---------- shown to every signed-in role ----------
const COMMON: MenuItem[] = [
  { label: 'Notifications', path: '/notifications' },
  { label: 'Profile',       path: '/profile' },
];

export const ROLES: Record<Role, RoleConfig> = {
  receptionist: {
    label: 'Receptionist', home: RECP.path,
    menu: [RECP, APPT, PATS, OPD, FUP, BILL],
    load: ['opd', 'patients', 'appointments', 'billing', 'followUps'],
  },
nurse: {
  label: 'Nurse', home: NDASH.path,
  menu: [NDASH, OPD, TRI, { ...HIST, readOnly: true }, TASK],
  load: ['opd', 'patients'],
},
  doctor: {
    label: 'Doctor', home: DASH.path,
    menu: [DASH, OPD, APPT, CONS, RX, LAB, FUP, REC, REP, DPAT],
    load: ['opd', 'patients', 'appointments', 'prescriptions', 'followUps'],
  },
  admin: {
    label: 'Admin', home: DASH.path,
    menu: [
      DASH, APPT, PATS, OPD, BILL,
      { ...HIST, readOnly: true }, { ...REC, readOnly: true },
      REP, STOCK, USERS, AUDIT, SET,
    ],
    load: ['opd', 'patients', 'appointments', 'billing', 'inventory', 'users'],
  },
};

// ---------- helpers ----------
export const roleOf = (raw: string | null | undefined): Role | null => {
  const r = (raw ?? '').trim().toLowerCase();
  return Object.hasOwn(ROLES, r) ? (r as Role) : null;   // blocks 'constructor', 'toString', etc.
};

export const configFor = (raw: string | null | undefined): RoleConfig | null => {
  const r = roleOf(raw);
  return r ? ROLES[r] : null;
};

/** Role menu plus the pages every role gets. */
export const menuFor = (raw: string | null | undefined): MenuItem[] => {
  const cfg = configFor(raw);
  return cfg ? [...cfg.menu, ...COMMON] : [];
};

/** Strip query, hash and trailing slash: '/patients/12?x=1' -> '/patients/12'. */
const cleanPath = (url: string): string =>
  url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

const matches = (path: string, base: string): boolean =>
  path === base || path.startsWith(base + '/');   // '/patient' no longer matches '/patients'

const findItem = (raw: string | null | undefined, url: string): MenuItem | undefined => {
  const path = cleanPath(url);
  return menuFor(raw).find(m => matches(path, m.path));
};

export const canOpen = (raw: string | null | undefined, url: string): boolean =>
  !!findItem(raw, url);

/** false when the page is open for this role but view-only. */
export const canEdit = (raw: string | null | undefined, url: string): boolean => {
  const item = findItem(raw, url);
  return !!item && !item.readOnly;
};

/** Where to send someone who opens a page they are not allowed to see. */
export const homeFor = (raw: string | null | undefined): string =>
  configFor(raw)?.home ?? '/login'; 