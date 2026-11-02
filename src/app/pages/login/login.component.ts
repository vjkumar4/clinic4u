import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../../commanapiservice/Api_service';
import { AuthService } from '../../services/Auth_service';

import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { configFor } from '../../roles/role_config';
import { RoleLoader } from '../../roles/role_loader';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,InputTextModule, IconFieldModule,
    InputIconModule, CheckboxModule, ButtonModule, MessageModule,],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private loader = inject(RoleLoader);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  submit() {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  this.loading.set(true);
  this.errorMessage.set(null);

  const { email, password } = this.form.getRawValue();

  this.auth
    .login(email, password)
    .pipe(finalize(() => this.loading.set(false)))
    .subscribe({
      next: () => {
        const cfg = configFor(this.auth.role());      // 1. check the role file
        if (!cfg) {
          this.auth.logout();                         // unknown role: don't leave them signed in
          this.errorMessage.set('Your account role is not recognised.');
          return;
        }
        this.loader.loadForCurrentRole();             // 2. load data for that role
        this.router.navigateByUrl(cfg.home);          // 3. open that role's home page
      },
      error: (err: Error) => this.errorMessage.set(err.message),
    });
}

   
}