import { Injectable } from '@angular/core';

export interface SalaryBreakdown {
  grossSalary: number;
  isss: number;
  afp: number;
  taxableBase: number;
  renta: number;
  netSalary: number;
  totalDeductions: number;
  rentaTramo: number;
  patronalIsss: number;
  patronalAfp: number;
  netSalaryPercentage: number;
  deductionsPercentage: number;
  totalEmployerCost: number;
}

@Injectable({
  providedIn: 'root'
})
export class SalaryCalculatorService {
  // Constant values for 2025/2026 (El Salvador)
  private readonly ISSS_RATE = 0.03;
  private readonly ISSS_CEILING = 1000.00;
  private readonly AFP_RATE = 0.0725;
  private readonly AFP_CEILING = 7045.06; // Updated for 2026

  private readonly PATRONAL_ISSS_RATE = 0.075;
  private readonly PATRONAL_AFP_RATE = 0.0875;

  calculateBreakdown(grossSalary: number): SalaryBreakdown {
    if (!grossSalary || grossSalary < 0) {
      grossSalary = 0;
    }

    // 1. Calculate ISSS (Ceiling is $1,000)
    const isss = Math.min(grossSalary, this.ISSS_CEILING) * this.ISSS_RATE;

    // 2. Calculate AFP (Ceiling is $7,045.06)
    const afp = Math.min(grossSalary, this.AFP_CEILING) * this.AFP_RATE;

    // 3. Calculate Taxable Base for Renta (ISR)
    const taxableBase = grossSalary - isss - afp;

    // 4. Calculate Renta based on 2025 brackets
    let renta = 0;
    let tramo = 1;

    if (taxableBase <= 550.00) {
      renta = 0;
      tramo = 1;
    } else if (taxableBase <= 895.24) {
      renta = (taxableBase - 550.00) * 0.10 + 17.67;
      tramo = 2;
    } else if (taxableBase <= 2038.10) {
      renta = (taxableBase - 895.24) * 0.20 + 60.00;
      tramo = 3;
    } else {
      renta = (taxableBase - 2038.10) * 0.30 + 288.57;
      tramo = 4;
    }

    const totalDeductions = isss + afp + renta;
    const netSalary = grossSalary - totalDeductions;

    // Percentages
    const netSalaryPercentage = grossSalary > 0 ? (netSalary / grossSalary) * 100 : 0;
    const deductionsPercentage = grossSalary > 0 ? (totalDeductions / grossSalary) * 100 : 0;

    // Patronal costs
    const patronalIsss = Math.min(grossSalary, this.ISSS_CEILING) * this.PATRONAL_ISSS_RATE;
    const patronalAfp = Math.min(grossSalary, this.AFP_CEILING) * this.PATRONAL_AFP_RATE;
    const totalEmployerCost = grossSalary + patronalIsss + patronalAfp;

    return {
      grossSalary,
      isss,
      afp,
      taxableBase,
      renta,
      netSalary,
      totalDeductions,
      rentaTramo: tramo,
      patronalIsss,
      patronalAfp,
      netSalaryPercentage,
      deductionsPercentage,
      totalEmployerCost
    };
  }
}
