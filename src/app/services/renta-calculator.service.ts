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
  operatingExpenses: number;
  totalDeductions: number;
  netTax: number;
  effectiveRate: number;
  activeTramo: number;
  netIncome: number;
  // Employee deductions (ISSS/AFP)
  isssDeduction?: number;
  afpDeduction?: number;
  // Professional specific fields
  ivaAmount?: number;
  pagoCuenta?: number;
  annualWithholdingAccumulated?: number;
  taxDifference?: number;
  belowWithholdingThreshold?: boolean;
  // Annual enrichment
  deductionsNotApplied?: boolean;
  operatingExpensesCapExceeded?: boolean;
  operatingExpensesCap?: number;
  additionalIncome?: number;
  totalGrossIncome?: number;
  aguinaldoTaxable?: number;
}

export interface AguinaldoBreakdown {
  totalAguinaldo: number;
  exemptAmount: number;
  taxableAmount: number;
  isr: number;
  netAguinaldo: number;
}

@Injectable({
  providedIn: 'root'
})
export class RentaCalculatorService {
  // Monthly Brackets (Tabla de retención ISR 2026 - Empleados)
  private readonly MONTHLY_BRACKETS: RentaBracket[] = [
    { label: 'I',   from: 0.01,    to: 550.00,   rate: 0,    fixedFee: 0,      excessOver: 0       },
    { label: 'II',  from: 550.01,  to: 895.24,   rate: 0.10, fixedFee: 17.67,  excessOver: 550.00  },
    { label: 'III', from: 895.25,  to: 2038.10,  rate: 0.20, fixedFee: 60.00,  excessOver: 895.24  },
    { label: 'IV',  from: 2038.11, to: null,      rate: 0.30, fixedFee: 288.57, excessOver: 2038.10 }
  ];

  // Annual Brackets (Declaración Anual ISR 2026)
  private readonly ANNUAL_BRACKETS: RentaBracket[] = [
    { label: 'I',   from: 0.00,      to: 6600.00,    rate: 0,    fixedFee: 0,       excessOver: 0        },
    { label: 'II',  from: 6600.01,   to: 9142.86,    rate: 0.10, fixedFee: 212.12,  excessOver: 6600.00  },
    { label: 'III', from: 9142.87,   to: 22857.14,   rate: 0.20, fixedFee: 720.00,  excessOver: 9142.86  },
    { label: 'IV',  from: 22857.15,  to: null,        rate: 0.30, fixedFee: 3462.86, excessOver: 22857.14 }
  ];

  // Tasas ISSS y AFP (empleados)
  private readonly ISSS_RATE = 0.03;
  private readonly AFP_RATE = 0.0725;
  private readonly ISSS_SALARY_CAP = 1000.00;

  // Topes de deducciones personales (anuales)
  private readonly MEDICAL_CAP = 800.00;
  private readonly EDUCATION_CAP = 800.00;
  private readonly DONATIONS_MAX_PERCENT = 0.10;

  // Tasas profesionales
  private readonly RETENCION_PROFESIONAL_RATE = 0.10;
  private readonly IVA_RATE = 0.13;
  private readonly PAGO_CUENTA_RATE = 0.0175;
  private readonly WITHHOLDING_THRESHOLD = 113.64;
  private readonly OPERATING_EXPENSES_MAX_RATE = 0.50; // Art. 29 LISR: máx 50% de ingresos brutos

  // Aguinaldo
  readonly MINIMUM_WAGE = 365.00; // Sector comercio 2025
  private readonly AGUINALDO_EXEMPT_WAGES = 2;

  /**
   * Cálculo mensual.
   * @param ivaIncluded Si true, el income del profesional incluye IVA (13%). Se descuenta para calcular la base.
   */
  calculateMonthly(
    income: number,
    contractType: 'employee' | 'professional',
    ivaIncluded: boolean = false
  ): RentaBreakdown {
    if (contractType === 'professional') {
      const baseAmount = ivaIncluded ? income / (1 + this.IVA_RATE) : income;
      const ivaAmount = baseAmount * this.IVA_RATE;
      const belowThreshold = baseAmount <= this.WITHHOLDING_THRESHOLD;
      const netTax = belowThreshold ? 0 : baseAmount * this.RETENCION_PROFESIONAL_RATE;
      const pagoCuenta = baseAmount * this.PAGO_CUENTA_RATE;

      return {
        income,
        isMonthly: true,
        contractType: 'professional',
        taxableBase: baseAmount,
        grossTax: netTax,
        medicalDeduction: 0,
        educationDeduction: 0,
        donationsDeduction: 0,
        operatingExpenses: 0,
        totalDeductions: 0,
        netTax,
        effectiveRate: belowThreshold ? 0 : 10,
        activeTramo: 0,
        netIncome: baseAmount - netTax,
        ivaAmount,
        pagoCuenta,
        belowWithholdingThreshold: belowThreshold
      };
    } else {
      // Empleado: se descuentan ISSS y AFP antes de aplicar los tramos de ISR
      const isssSalary = Math.min(income, this.ISSS_SALARY_CAP);
      const isssDeduction = isssSalary * this.ISSS_RATE;
      const afpDeduction = income * this.AFP_RATE;

      const taxableBase = Math.max(0, income - isssDeduction - afpDeduction);
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
        totalDeductions: isssDeduction + afpDeduction,
        netTax,
        effectiveRate,
        activeTramo: this.MONTHLY_BRACKETS.indexOf(bracket) + 1,
        netIncome: income - isssDeduction - afpDeduction - netTax,
        isssDeduction,
        afpDeduction
      };
    }
  }

  /**
   * Cálculo anual.
   * @param additionalIncome Ingresos adicionales (freelance) para empleados.
   * @param aguinaldoTaxable Porción gravable del aguinaldo a incluir en la declaración (empleados).
   */
  calculateAnnual(
    income: number,
    contractType: 'employee' | 'professional',
    medical: number = 0,
    education: number = 0,
    donations: number = 0,
    operatingExpenses: number = 0,
    accumulatedWithholding: number = 0,
    additionalIncome: number = 0,
    aguinaldoTaxable: number = 0
  ): RentaBreakdown {
    const totalGrossIncome = income + additionalIncome + (contractType === 'employee' ? aguinaldoTaxable : 0);

    // 50% cap en gastos operativos (Art. 29 LISR)
    const operatingExpensesCap = income * this.OPERATING_EXPENSES_MAX_RATE;
    const capExceeded = contractType === 'professional' && operatingExpenses > operatingExpensesCap;
    const finalOperatingExpenses = contractType === 'professional'
      ? Math.min(Math.max(0, operatingExpenses), operatingExpensesCap)
      : 0;

    // Deducciones personales solo aplican si ingreso total > $9,100
    const deductionsNotApplied = totalGrossIncome <= 9100;
    let appliedMedical = 0;
    let appliedEducation = 0;
    let appliedDonations = 0;

    if (!deductionsNotApplied) {
      appliedMedical = Math.min(Math.max(0, medical), this.MEDICAL_CAP);
      appliedEducation = Math.min(Math.max(0, education), this.EDUCATION_CAP);
      appliedDonations = Math.min(Math.max(0, donations), totalGrossIncome * this.DONATIONS_MAX_PERCENT);
    }

    const totalPersonalDeductions = appliedMedical + appliedEducation + appliedDonations;
    const adjustedOperatingExpenses = contractType === 'professional' ? finalOperatingExpenses : 0;

    // Para empleados: estimar ISSS y AFP anuales (salario mensual = ingreso principal / 12)
    let isssDeduction = 0;
    let afpDeduction = 0;
    if (contractType === 'employee') {
      const estimatedMonthly = income / 12;
      const isssSalary = Math.min(estimatedMonthly, this.ISSS_SALARY_CAP);
      isssDeduction = isssSalary * this.ISSS_RATE * 12;
      afpDeduction = estimatedMonthly * this.AFP_RATE * 12;
    }

    const taxableBase = Math.max(
      0,
      totalGrossIncome - adjustedOperatingExpenses - totalPersonalDeductions - isssDeduction - afpDeduction
    );

    const bracket = this.findBracket(taxableBase, this.ANNUAL_BRACKETS);
    const grossTax = (taxableBase - bracket.excessOver) * bracket.rate + bracket.fixedFee;
    const netTax = Math.max(0, grossTax);
    const effectiveRate = totalGrossIncome > 0 ? (netTax / totalGrossIncome) * 100 : 0;

    const breakdown: RentaBreakdown = {
      income,
      isMonthly: false,
      contractType,
      taxableBase,
      grossTax: netTax,
      medicalDeduction: appliedMedical,
      educationDeduction: appliedEducation,
      donationsDeduction: appliedDonations,
      operatingExpenses: adjustedOperatingExpenses,
      totalDeductions: totalPersonalDeductions + adjustedOperatingExpenses + isssDeduction + afpDeduction,
      netTax,
      effectiveRate,
      activeTramo: this.ANNUAL_BRACKETS.indexOf(bracket) + 1,
      netIncome: totalGrossIncome - isssDeduction - afpDeduction - netTax,
      isssDeduction: isssDeduction > 0 ? isssDeduction : undefined,
      afpDeduction: afpDeduction > 0 ? afpDeduction : undefined,
      deductionsNotApplied,
      operatingExpensesCapExceeded: capExceeded || undefined,
      operatingExpensesCap: contractType === 'professional' ? operatingExpensesCap : undefined,
      additionalIncome: additionalIncome > 0 ? additionalIncome : undefined,
      totalGrossIncome: (additionalIncome > 0 || aguinaldoTaxable > 0) ? totalGrossIncome : undefined,
      aguinaldoTaxable: aguinaldoTaxable > 0 ? aguinaldoTaxable : undefined
    };

    if (contractType === 'professional') {
      breakdown.annualWithholdingAccumulated = accumulatedWithholding;
      breakdown.taxDifference = netTax - accumulatedWithholding;
    }

    return breakdown;
  }

  calculateAguinaldo(aguinaldoAmount: number): AguinaldoBreakdown {
    const totalExempt = this.MINIMUM_WAGE * this.AGUINALDO_EXEMPT_WAGES;
    const exemptAmount = Math.min(aguinaldoAmount, totalExempt);
    const taxableAmount = Math.max(0, aguinaldoAmount - totalExempt);

    let isr = 0;
    if (taxableAmount > 0) {
      const bracket = this.findBracket(taxableAmount, this.ANNUAL_BRACKETS);
      isr = Math.max(0, (taxableAmount - bracket.excessOver) * bracket.rate + bracket.fixedFee);
    }

    return {
      totalAguinaldo: aguinaldoAmount,
      exemptAmount,
      taxableAmount,
      isr,
      netAguinaldo: aguinaldoAmount - isr
    };
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
  getAguinaldoExempt() { return this.MINIMUM_WAGE * this.AGUINALDO_EXEMPT_WAGES; }
  getWithholdingThreshold() { return this.WITHHOLDING_THRESHOLD; }
}
