import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { RangeKey,ReportData } from '../pages/reports/model/report.model';

/**
 * Static data for now. When the backend is ready:
 *   1) inject HttpClient (provideHttpClient() in app.config.ts)
 *   2) replace the body of getReport() with the http call shown below.
 * The component does not change - it only depends on the ReportData shape.
 */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  // private http = inject(HttpClient);

  getReport(range: RangeKey): Observable<ReportData> {
    // return this.http.get<ReportData>(`${environment.apiUrl}/reports/overview`, { params: { range } });
    return of(this.mock(range)).pipe(delay(600));
  }

  private mock(range: RangeKey): ReportData {
    const week = range === '7d';
    return {
      rangeLabel: week ? '04 Oct – 10 Oct 2026' : '11 Sep – 10 Oct 2026',
      kpis: [
        { key: 'patients', label: 'Total patients', value: week ? '248' : '1,036', change: 12, tone: 'green', spark: [10, 21, 26, 37, 32, 40, 53, 41, 54, 63] },
        { key: 'appointments', label: 'Appointments', value: week ? '210' : '884', change: 8, tone: 'blue', spark: [20, 18, 25, 30, 28, 35, 33, 40, 38, 45] },
        { key: 'revenue', label: 'Revenue', value: week ? '₹ 1,28,450' : '₹ 5,42,900', change: 15, tone: 'purple', spark: [12, 15, 14, 22, 25, 24, 30, 33, 38, 42] },
        { key: 'wait', label: 'Avg. wait time', value: '18 mins', change: -32, tone: 'orange', lowerIsBetter: true, spark: [40, 38, 35, 33, 30, 28, 26, 22, 20, 18] }
      ],
      trend: {
        labels: ['01 Oct', '02 Oct', '03 Oct', '04 Oct', '05 Oct', '06 Oct', '07 Oct', '08 Oct', '09 Oct', '10 Oct'],
        values: week ? [10, 21, 26, 37, 32, 40, 53, 41, 54, 63] : [22, 31, 28, 45, 39, 52, 61, 48, 66, 72]
      },
      doctors: [
        { name: 'Dr. Arun', specialty: 'General Physician', visits: 68, color: '#10b981' },
        { name: 'Dr. Priya', specialty: 'General Physician', visits: 56, color: '#3b82f6' },
        { name: 'Dr. Ravi', specialty: 'Cardiologist', visits: 48, color: '#8b5cf6' },
        { name: 'Dr. Meena', specialty: 'Pediatrician', visits: 42, color: '#f59e0b' },
        { name: 'Dr. Karthik', specialty: 'Orthopedic', visits: 34, color: '#f43f5e' }
      ],
      gender: [
        { label: 'Male', count: 138, color: '#3b82f6' },
        { label: 'Female', count: 110, color: '#a855f7' }
      ],
      ageGroups: [
        { label: '0–18', count: 18 }, { label: '19–30', count: 52 }, { label: '31–50', count: 94 },
        { label: '51–70', count: 62 }, { label: '71+', count: 22 }
      ],
      reasons: [
        { label: 'Fever', count: 42, color: '#10b981' }, { label: 'Cough & cold', count: 36, color: '#3b82f6' },
        { label: 'Hypertension', count: 28, color: '#8b5cf6' }, { label: 'Diabetes follow-up', count: 24, color: '#f59e0b' },
        { label: 'Back pain', count: 20, color: '#f43f5e' }, { label: 'Others', count: 98, color: '#94a3b8' }
      ],
      recent: [
        { at: '10 Oct, 09:45 AM', patient: 'Ramesh Kumar', mrn: 'PT-0005', doctor: 'Dr. Priya', reason: 'Fever & cold', status: 'In Consultation' },
        { at: '10 Oct, 09:20 AM', patient: 'Lakshmi Devi', mrn: 'PT-0006', doctor: 'Dr. Arun', reason: 'Checkup', status: 'Completed' },
        { at: '10 Oct, 09:05 AM', patient: 'Karthik S', mrn: 'PT-0007', doctor: 'Dr. Meena', reason: 'Body pain', status: 'Ready for Doctor' },
        { at: '10 Oct, 08:40 AM', patient: 'Divya S', mrn: 'PT-0010', doctor: 'Dr. Ravi', reason: 'Cough', status: 'Waiting for Vitals' }
      ]
    };
  }
}