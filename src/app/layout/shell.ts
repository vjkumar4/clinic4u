import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { AuthService } from '../services/Auth_service';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { canOpen, configFor } from '../roles/role_config';
type NavItem = { label: string; path: string; icon: string; children?: { label: string; path: string }[] };

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive,DatePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { '(document:click)': 'menuOpen.set(false)' },
})
export class ShellComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  collapsed = signal(false);   // desktop: icon-only sidebar
  open = signal(false);        // mobile: slide-in drawer
  menuOpen = signal(false);    // avatar dropdown
  year = new Date().getFullYear();
  now = new Date();
  initial = computed(() => (this.auth.user()?.email[0] ?? 'U').toUpperCase());
  name = computed(() => (this.auth.user()?.email.split('@')[0] ?? 'there'));
  greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; })();

 

// inside the class, after `private router = inject(Router);`
nav: NavItem[] = [
  { label: 'Dashboard',    path: '/dashboard',    icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { label: 'Appointments', path: '/appointments', icon: 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18' },
  { label: 'Patients',     path: '/patients',     icon: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    children: [
      { label: 'All patients', path: '/patients/view' },
      { label: 'Add patient',  path: '/patients/new' },
    ] },
     { label: 'OPD Queue',      path: '/opd',      icon: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4' },
    
{
  label: 'Vitals & Triage', path: '/triage', icon: 'M3 12h4l3-8 4 16 3-8h4', //roles: ['ClinicAdmin', 'Nurse', 'Doctor']
},

// {
//   label: 'Consultation', path: '/consultation', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', //roles: ['ClinicAdmin', 'Nurse', 'Doctor']
// },

{
  label: 'Dashboard', path: '/reception', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z', //roles: ['ClinicAdmin', 'Nurse', 'Doctor']
},
{
  label: 'Dashboard', path: '/dashboards', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z', //roles: ['ClinicAdmin', 'Nurse', 'Doctor']
},

{ label: 'Billing', path: '/billing', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
{ label: 'Patient History', path: '/patient-history', icon: 'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7M3 4v5h5' },
{ label: 'Nursing Tasks',   path: '/nursing-tasks',   icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
{ label: 'Reports',         path: '/reports',         icon: 'M18 20V10M12 20V4M6 20v-6' },
  { label: 'Records',      path: '/record',      icon: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6' },
  { label: 'Settings',     path: '/settings',     icon: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4' },
  { label: 'Patients', path: '/patient', icon: 'M5 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M19 8v6M16 11h6' },
];

 // 👇 add these two lines here, right after nav
visibleNav = computed(() => {
  const menu = configFor(this.auth.role())?.menu ?? [];
  return menu.map(m => this.nav.find(n => n.path === m.path)).filter((n): n is NavItem => !!n);
});
  roleLabel  = computed(() => configFor(this.auth.role())?.label ?? '');

  
url = signal(this.router.url);
openGroup = signal<string | null>(null);          // only one submenu open at a time

isOpen   = (n: NavItem) => this.openGroup() === n.label;
isActive = (n: NavItem) => this.url().startsWith(n.path);

toggle(n: NavItem) {
  // icon-only desktop sidebar has no room for a submenu, so go straight to the page
  if (this.collapsed() && window.innerWidth > 900) { this.router.navigateByUrl(n.path); return; }
  this.openGroup.update(o => (o === n.label ? null : n.label));   // click = open, click again = close
}
constructor() {
  this.router.events.subscribe(e => {
    if (e instanceof NavigationEnd) { this.url.set(e.urlAfterRedirects); this.open.set(false); }
  });
}
}