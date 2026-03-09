import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  isLoading = signal(false);
  errorMsg = signal('');

  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      this.errorMsg.set('');
      try {
        await this.authService.loginWithEmail(this.loginForm.value);
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
      this.errorMsg.set('Error al iniciar sesión con Google');
    } finally {
      this.isLoading.set(false);
    }
  }

  private getFriendlyErrorMessage(code: string): string {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Email o contraseña incorrectos.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Inténtalo más tarde.';
      default:
        return 'Ocurrió un error al iniciar sesión.';
    }
  }
}
