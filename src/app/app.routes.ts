import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./components/login/login').then(m => m.LoginComponent), canActivate: [guestGuard] },
  { path: 'register', loadComponent: () => import('./components/register/register').then(m => m.RegisterComponent), canActivate: [guestGuard] },

  { path: '', loadComponent: () => import('./components/loan-calculator/loan-calculator').then(m => m.LoanCalculatorComponent), canActivate: [authGuard] },
  { path: 'calculator', loadComponent: () => import('./components/loan-calculator/loan-calculator').then(m => m.LoanCalculatorComponent), canActivate: [authGuard] },
  { path: 'investments', loadComponent: () => import('./components/investment-calculator/investment-calculator').then(m => m.InvestmentCalculatorComponent), canActivate: [authGuard] },
  { path: 'compound', loadComponent: () => import('./components/compound-calculator/compound-calculator').then(m => m.CompoundCalculatorComponent), canActivate: [authGuard] },
  { path: 'ahorro-programado', loadComponent: () => import('./components/scheduled-savings/scheduled-savings').then(m => m.ScheduledSavingsComponent), canActivate: [authGuard] },
  { path: 'salario', loadComponent: () => import('./components/salary-calculator/salary-calculator').then(m => m.SalaryCalculatorComponent), canActivate: [authGuard] },
  { path: 'renta', loadComponent: () => import('./components/renta-calculator/renta-calculator').then(m => m.RentaCalculatorComponent), canActivate: [authGuard] },
  { path: 'profile', loadComponent: () => import('./components/profile/profile').then(m => m.ProfileComponent), canActivate: [authGuard] },
];

