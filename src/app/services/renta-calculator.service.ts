import { Injectable } from '@angular/core';

export interface RentaBracket {
  from: number;
  to: number | null;
  rate: number;
  fixedFee: number;
  excessOver: number;
  label: string;
}

export interface RentaBreakdown {
  income: number;
  isMonthly: boolean;
  contractType: 'employee' | 'professional';
  taxableBase: number;
  grossTax: number;
  medicalDeduction: number;
  educationDeduction: number;
  donationsDeduction: number;
  operatingExpenses: number; // Only for professionals
  totalDeductions: number;
  netTax: number;
  effectiveRate: number;
  activeTramo: number;
  netIncome: number;
  // Professional specific fields
  ivaAmount?: number;
  pagoCuenta?: number;
  annualWithholdingAccumulated?: number;
  taxDifference?: number; // annual tax minus accumulated withholding
}

@Injectable({
  providedIn: 'root'
})
export class RentaCalculatorService {
  // Monthly Brackets (Table of retention ISR 2026 - Employees only)
  private readonly MONTHLY_BRACKETS: RentaBracket[] = [
    { label: 'I', from: 0.01, to: 550.00, rate: 0, fixedFee: 0, excessOver: 0 },
    { label: 'II', from: 550.01, to: 895.24, rate: 0.10, fixedFee: 17.67, excessOver: 550.00 },
    { label: 'III', from: 895.25, to: 2038.10, rate: 0.20, fixedFee: 60.00, excessOver: 895.24 },
    { label: 'IV', from: 2038.11, to: null, rate: 0.30, fixedFee: 288.57, excessOver: 2038.10 }
  ];

  // Annual Brackets (Annual ISR Declaration 2026 - Both)
  private readonly ANNUAL_BRACKETS: RentaBracket[] = [
    { label: 'I', from: 0.00, to: 6600.00, rate: 0, fixedFee: 0, excessOver: 0 },
    { label: 'II', from: 6600.01, to: 9142.86, rate: 0.10, fixedFee: 212.12, excessOver: 6600.00 },
    { label: 'III', from: 9142.87, to: 22857.14, rate: 0.20, fixedFee: 720.00, excessOver: 9142.86 },
    { label: 'IV', from: 22857.15, to: null, rate: 0.30, fixedFee: 3462.86, excessOver: 22857.14 }
  ];

  // Constants for deductions (Annual)
  private readonly MEDICAL_CAP = 800.00;
  private readonly EDUCATION_CAP = 800.00;
  private readonly DONATIONS_MAX_PERCENT = 0.10; // 10% of net income
  private readonly RETENCION_PROFESIONAL_RATE = 0.10;
  private readonly IVA_RATE = 0.13;
  private readonly PAGO_CUENTA_RATE = 0.015;

  calculateMonthly(income: number, contractType: 'employee' | 'professional'): RentaBreakdown {
    if (contractType === 'professional') {
      const netTax = income * this.RETENCION_PROFESIONAL_RATE;
      const ivaAmount = income * this.IVA_RATE;
      const pagoCuenta = income * this.PAGO_CUENTA_RATE;

      return {
        income,
        isMonthly: true,
        contractType: 'professional',
        taxableBase: income,
        grossTax: netTax,
        medicalDeduction: 0,
        educationDeduction: 0,
        donationsDeduction: 0,
        operatingExpenses: 0,
        totalDeductions: 0,
        netTax,
        effectiveRate: 10,
        activeTramo: 0, // Doesn't apply in monthly flat rate
        netIncome: income - netTax,
        ivaAmount,
        pagoCuenta
      };
    } else {
      const taxableBase = Math.max(0, income);
      const bracket = this.findBracket(taxableBase, this.MONTHLY_BRACKETS);

      const grossTax = (taxableBase - bracket.excessOver) * bracket.rate + bracket.fixedFee;
      const netTax = Math.max(0, grossTax);
      const effectiveRate = income > 0 ? (netTax / income) * 100 : 0;

      return {
        income,
        isMonthly: true,
        contractType: 'employee',
        taxableBase,
        grossTax: netTax,
        medicalDeduction: 0,
        educationDeduction: 0,
        donationsDeduction: 0,
        operatingExpenses: 0,
        totalDeductions: 0,
        netTax,
        effectiveRate,
        activeTramo: this.MONTHLY_BRACKETS.indexOf(bracket) + 1,
        netIncome: income - netTax
      };
    }
  }

  calculateAnnual(
    income: number,
    contractType: 'employee' | 'professional',
    medical: number = 0,
    education: number = 0,
    donations: number = 0,
    operatingExpenses: number = 0
  ): RentaBreakdown {
    // 1. Cap deductions (only if income > $9,100)
    let appliedMedical = 0;
    let appliedEducation = 0;
    let appliedDonations = 0;

    if (income > 9100) {
      appliedMedical = Math.min(Math.max(0, medical), this.MEDICAL_CAP);
      appliedEducation = Math.min(Math.max(0, education), this.EDUCATION_CAP);
      appliedDonations = Math.min(Math.max(0, donations), income * this.DONATIONS_MAX_PERCENT);
    }

    // 2. Base calculation
    const totalPersonalDeductions = appliedMedical + appliedEducation + appliedDonations;
    const finalOperatingExpenses = contractType === 'professional' ? Math.max(0, operatingExpenses) : 0;

    // Taxable base is income minus operating expenses (for pros) minus personal deductions
    const taxableBase = Math.max(0, income - finalOperatingExpenses - totalPersonalDeductions);

    const bracket = this.findBracket(taxableBase, this.ANNUAL_BRACKETS);
    const grossTax = (taxableBase - bracket.excessOver) * bracket.rate + bracket.fixedFee;
    const netTax = Math.max(0, grossTax);
    const effectiveRate = income > 0 ? (netTax / income) * 100 : 0;

    const breakdown: RentaBreakdown = {
      income,
      isMonthly: false,
      contractType,
      taxableBase,
      grossTax: netTax,
      medicalDeduction: appliedMedical,
      educationDeduction: appliedEducation,
      donationsDeduction: appliedDonations,
      operatingExpenses: finalOperatingExpenses,
      totalDeductions: totalPersonalDeductions + finalOperatingExpenses,
      netTax,
      effectiveRate,
      activeTramo: this.ANNUAL_BRACKETS.indexOf(bracket) + 1,
      netIncome: income - netTax
    };

    if (contractType === 'professional') {
      // Annual withholding accumulated (assuming 10% was withheld monthly)
      const accumulated = income * this.RETENCION_PROFESIONAL_RATE;
      breakdown.annualWithholdingAccumulated = accumulated;
      breakdown.taxDifference = netTax - accumulated;
    }

    return breakdown;
  }

  private findBracket(value: number, brackets: RentaBracket[]): RentaBracket {
    for (const bracket of brackets) {
      if (bracket.to === null || value <= bracket.to) {
        return bracket;
      }
    }
    return brackets[brackets.length - 1];
  }

  getMonthlyBrackets() { return this.MONTHLY_BRACKETS; }
  getAnnualBrackets() { return this.ANNUAL_BRACKETS; }
}
