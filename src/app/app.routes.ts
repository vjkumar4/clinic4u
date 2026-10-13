import { Routes } from '@angular/router';
import { authGuard } from '../app/core/auth.core';
import { LoginComponent } from './pages/login/login.component';
import { ShellComponent } from './layout/shell';
import { PageComponent } from './pages/page';
import { Dashboard } from '../app/pages/dashboard/dashboard/dashboard';
import { OpdComponent } from './pages/opdqueue/opdqueue';
import { VitalsTriageComponent } from './pages/vitaltriage/vitaltriage';
import { ReportsComponent } from './pages/reports/reports';
import { Consultation } from './pages/consultation/consultation';
import { Appointments } from './pages/appointments/appointments';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,           // header + side menu + footer for every child page
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('../app/pages/dashboard/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'appointmentss', component: PageComponent, data: { title: 'Appointments' } },
      { path: 'patients',     component: PageComponent, data: { title: 'Patients' } },
      { path: 'records',      component: PageComponent, data: { title: 'Records' } },
      { path: 'settings',     component: PageComponent, data: { title: 'Settings' } },
      { path: 'patients/new',loadComponent: () => import('./pages/patients/addpatients/addpatient').then(m => m.PatientFormComponent) },
       { path: 'patients/view',loadComponent: () => import('./pages/patients/viewpatients/viewpatients').then(m => m.PatientsviewComponent) },
       { path: 'opd',loadComponent: () => import('./pages/opdqueue/opdqueue').then(m => m.OpdComponent) },
        { path: 'triage',loadComponent: () => import('./pages/vitaltriage/vitaltriage').then(m => m.VitalsTriageComponent) },
        { path: 'record',loadComponent: () => import('./pages/reports/reports').then(m => m.ReportsComponent) },
         { path: 'consultation',loadComponent: () => import('./pages/consultation/consultation').then(m => m.Consultation) },
          { path: 'appointments',loadComponent: () => import('./pages/appointments/appointments').then(m => m.Appointments) },
    
    ],
  },
  { path: '**', redirectTo: '' },
];