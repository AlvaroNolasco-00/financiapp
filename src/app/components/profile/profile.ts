import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, UserProfile } from '../../services/auth.service';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  profileForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required]],
    phone: [''],
    birthDate: [''],
  });

  profile: UserProfile | null = null;
  isLoading = signal(true);
  isSaving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  ngOnInit() {
    this.authService.userProfile$.pipe(
      filter(profile => !!profile),
      take(1)
    ).subscribe(profile => {
      this.profile = profile as UserProfile;
      this.profileForm.patchValue({
        fullName: this.profile.fullName,
        phone: this.profile.phone || '',
        birthDate: this.profile.birthDate || ''
      });
      this.isLoading.set(false);
    });
  }


  async onSave() {
    if (this.profileForm.valid && this.profile) {
      this.isSaving.set(true);
      this.successMsg.set('');
      this.errorMsg.set('');
      try {
        await this.authService.updateProfileData(this.profile.uid, this.profileForm.value);
        this.successMsg.set('Perfil actualizado correctamente.');
        setTimeout(() => this.successMsg.set(''), 3000);
      } catch (error) {
        this.errorMsg.set('Error al actualizar el perfil.');
      } finally {
        this.isSaving.set(false);
      }
    }
  }

  logout() {
    this.authService.logout();
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  }
}
