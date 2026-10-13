import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-page',
  standalone: true,
  template: `
    <div class="empty">
      <span>+</span>
      <h2>{{ title }}</h2>
      <p>This section is empty. Add your {{ title.toLowerCase() }} component to this route in app.routes.ts.</p>
    </div>`,
  styles: [`
    .empty { max-width: 460px; margin: 8vh auto 0; padding: 48px 32px; text-align: center; border-radius: 24px; background: #fff; box-shadow: 0 20px 50px #0b3f3318; }
    span { display: grid; place-items: center; width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 16px; background: linear-gradient(135deg, #1fc690, #0d8a62); color: #fff; font-size: 32px; font-weight: 300; animation: float 4s ease-in-out infinite; }
    @keyframes float { 50% { transform: translateY(-6px); } }
    h2 { margin: 0 0 8px; color: #163b34; }
    p { margin: 0; color: #71847e; line-height: 1.6; }`],
})
export class PageComponent {
  title: string = inject(ActivatedRoute).snapshot.data['title'] ?? 'Page';
}