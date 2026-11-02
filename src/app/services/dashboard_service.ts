import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { DoctorOverview, TodayPatient, Kpi } from '../pages/dashboard/dashboard/model/doctor-dashboard.model';

/**
 * Mock API. Replace getOverview() with:
 *   return this.http.get<DoctorOverview>('/api/doctor/overview', { params: { date } });
 */
@Injectable({ providedIn: 'root' })
export class DoctorOverviewService {
  getOverview(date: string): Observable<DoctorOverview> {
    const isToday = date === this.iso(0);
    const patients = isToday ? this.patients() : this.patients().slice(0, 8).map(p => ({ ...p, status: 'Completed' as const }));

    const kpis: Kpi[] = [
      { id: 'total', label: 'Total Patients', value: 124, note: 'Registered patients', icon: 'user', tone: 'purple' },
      { id: 'appts', label: "Today's Appointments", value: patients.length, note: 'Scheduled visits', icon: 'calendar', tone: 'green' },
      { id: 'consult', label: 'In Consultation', value: patients.filter(p => p.status === 'In Consultation').length, note: 'Ongoing consultation', icon: 'users', tone: 'blue' },
      { id: 'wait', label: 'Waiting for Doctor', value: patients.filter(p => p.status === 'Ready for Doctor' || p.status === 'Waiting for Vitals').length, note: 'Ready for consultation', icon: 'clock', tone: 'orange' },
    ];

    const counts = [8, 12, 11, 15, 12, 19, 26];
    const end = new Date(date);
    const visits = counts.map((count, i) => {
      const d = new Date(end); d.setDate(end.getDate() - (counts.length - 1 - i));
      return { label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), count };
    });

    return of<DoctorOverview>({
      doctor: { name: 'Dr. Arun' },
      kpis,
      visits,
      visitTypes: [
        { label: 'New Consultation', count: 48, color: '#4f7cff' },
        { label: 'Follow-up', count: 42, color: '#22b783' },
        { label: 'Review', count: 18, color: '#f7a531' },
        { label: 'Others', count: 16, color: '#a56bf2' },
      ],
      genders: [
        { label: 'Male', count: 68, color: '#5b8def' },
        { label: 'Female', count: 56, color: '#f062c0' },
      ],
      patients,
    }).pipe(delay(300));
  }

  private iso(daysAgo: number) { return new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10); }

  private patients(): TodayPatient[] {
    const p = (n: number, name: string, age: number, gender: 'Male' | 'Female', phone: string, visitType: TodayPatient['visitType'],
      ago: number, status: TodayPatient['status'], bp: string | null, spo2: number, notes: string): TodayPatient => ({
      id: `p${n}`, mrn: `PT-${String(n).padStart(4, '0')}`, name, age, gender, phone, visitType, lastVisit: this.iso(ago), status,
      vitals: bp ? { bp, spo2 } : null, notes,
    });
    return [
      p(12, 'Ravi Kumar', 42, 'Male', '+91 98765 43210', 'Follow-up', 0, 'In Consultation', '120/80', 98, 'Fever, headache'),
      p(13, 'Sathya Priya', 38, 'Female', '+91 98765 12345', 'New Consultation', 1, 'Ready for Doctor', '118/76', 98, 'Cough, cold'),
      p(14, 'Meena Devi', 56, 'Female', '+91 91234 56789', 'Follow-up', 2, 'Waiting for Vitals', null, 0, 'Diabetes, BP'),
      p(15, 'Vikram Singh', 29, 'Male', '+91 99887 66554', 'New Consultation', 3, 'Completed', '122/78', 99, 'Back pain'),
      p(16, 'Pooja Sharma', 34, 'Female', '+91 88776 55443', 'Follow-up', 4, 'Completed', '110/70', 97, 'Allergy'),
      p(17, 'Arun Rai', 47, 'Male', '+91 99444 33221', 'New Consultation', 0, 'In Consultation', '140/90', 96, 'Thyroid'),
      p(18, 'Kavya Nair', 31, 'Female', '+91 97654 11223', 'Review', 5, 'Ready for Doctor', '116/74', 99, 'Lab report review'),
      p(19, 'Imran Khan', 52, 'Male', '+91 98450 77889', 'Follow-up', 6, 'Ready for Doctor', '134/86', 97, 'Hypertension'),
      p(20, 'Divya Murali', 26, 'Female', '+91 90030 44556', 'Others', 0, 'Waiting for Vitals', null, 0, 'Fitness certificate'),
      p(21, 'Naveen Raj', 61, 'Male', '+91 98840 99001', 'Review', 7, 'In Consultation', '138/88', 95, 'Knee pain'),
      p(22, 'Lakshmi Narayan', 67, 'Female', '+91 98410 22334', 'Follow-up', 8, 'Completed', '128/82', 96, 'Sugar review'),
      p(23, 'Prakash Selvam', 45, 'Male', '+91 94440 66778', 'New Consultation', 0, 'Completed', '124/80', 98, 'Acidity'),
    ];
  }
}