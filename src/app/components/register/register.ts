import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  registerForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  isLoading = signal(false);
  errorMsg = signal('');

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  async onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading.set(true);
      this.errorMsg.set('');
      try {
        await this.authService.register(this.registerForm.value);
      } catch (error: any) {
        this.errorMsg.set(this.getFriendlyErrorMessage(error.code));
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  async loginWithGoogle() {
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      await this.authService.loginWithGoogle();
    } catch (error: any) {
      this.errorMsg.set('Error al registrarse con Google');
    } finally {
      this.isLoading.set(false);
    }
  }

  private getFriendlyErrorMessage(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta con este email.';
      case 'auth/weak-password':
        return 'La contraseña es muy débil (mínimo 6 caracteres).';
      default:
        return 'Ocurrió un error al crear la cuenta.';
    }
  }
}
