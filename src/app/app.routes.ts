import { Routes } from '@angular/router';
import { LoanCalculatorComponent } from './components/loan-calculator/loan-calculator';
import { InvestmentCalculatorComponent } from './components/investment-calculator/investment-calculator';
import { CompoundCalculatorComponent } from './components/compound-calculator/compound-calculator';
import { ScheduledSavingsComponent } from './components/scheduled-savings/scheduled-savings';
import { SalaryCalculatorComponent } from './components/salary-calculator/salary-calculator';
import { LoginComponent } from './components/login/login';
import { RegisterComponent } from './components/register/register';
import { ProfileComponent } from './components/profile/profile';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },

  { path: '', component: LoanCalculatorComponent, canActivate: [authGuard] },
  { path: 'calculator', component: LoanCalculatorComponent, canActivate: [authGuard] },
  { path: 'investments', component: InvestmentCalculatorComponent, canActivate: [authGuard] },
  { path: 'compound', component: CompoundCalculatorComponent, canActivate: [authGuard] },
  { path: 'ahorro-programado', component: ScheduledSavingsComponent, canActivate: [authGuard] },
  { path: 'salario', component: SalaryCalculatorComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
];

