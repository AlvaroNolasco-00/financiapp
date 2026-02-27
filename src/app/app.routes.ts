import { Routes } from '@angular/router';
import { LoanCalculatorComponent } from './components/loan-calculator/loan-calculator';
import { InvestmentCalculatorComponent } from './components/investment-calculator/investment-calculator';
import { CompoundCalculatorComponent } from './components/compound-calculator/compound-calculator';

export const routes: Routes = [
  { path: '', component: LoanCalculatorComponent },
  { path: 'calculator', component: LoanCalculatorComponent },
  { path: 'investments', component: InvestmentCalculatorComponent },
  { path: 'compound', component: CompoundCalculatorComponent },
];
