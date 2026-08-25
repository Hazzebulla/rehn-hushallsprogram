export type PriceProduct = {
  id: string;
  rskNumber: string | null;
  name: string;
  manufacturerName: string;
  category: string;
  unit: string;
};

export type SupplierPriceInput = {
  id: string;
  supplierId: string;
  supplierName: string;
  listPriceOre: number;
  unit: string;
};

export type DiscountRuleInput = {
  id: string;
  supplierId: string | null;
  supplierName?: string | null;
  manufacturerName: string | null;
  category: string | null;
  productGroup: string | null;
  rskNumber: string | null;
  discountPercent: number;
};

export type MarkupRuleInput = {
  id: string;
  productModelId: string | null;
  category: string | null;
  markupPercent: number;
};

export type PricingSettingsInput = {
  preferredSupplierId: string | null;
  autoSelectLowestNetPrice: boolean;
  standardHourlyRateOre: number;
  materialMarkupPercent: number;
  serviceVehicleFeeOre: number;
  minimumBillingMinutes: number;
  vatPercent: number;
  rotEnabledByDefault: boolean;
  rotDeductionPercent: number;
  rotMaxDeductionOre: number;
  customerRoundingIncrementOre: number;
  estimateValidityDays: number;
};

export type MaterialLineInput = {
  product?: PriceProduct | null;
  supplierPrices?: SupplierPriceInput[];
  description: string;
  rskNumber?: string | null;
  quantity: number;
  manualListPriceOre?: number | null;
  supplierName?: string | null;
};

export type LaborLineInput = {
  workType: string;
  minutes: number;
  standardMinutes?: number | null;
  hourlyRateOre?: number | null;
  rotEligible: boolean;
};

export type OtherCostLineInput = {
  description: string;
  quantity: number;
  unitPriceOre: number;
  rotEligible?: boolean;
};

export type CalculateEstimateInput = {
  title: string;
  materialLines: MaterialLineInput[];
  laborLines: LaborLineInput[];
  otherCostLines: OtherCostLineInput[];
  rotSelected: "yes" | "no" | "unknown";
  requiresQuote?: boolean;
};

export type CalculatedMaterialLine = {
  description: string;
  rskNumber: string | null;
  quantity: number;
  unit: string;
  supplierName: string | null;
  listPriceOre: number | null;
  discountPercent: number;
  discountRuleId: string | null;
  netPriceOre: number | null;
  markupPercent: number;
  markupRuleId: string | null;
  customerUnitPriceOre: number;
  totalCustomerPriceOre: number;
};

export type CalculatedEstimate = {
  title: string;
  materialLines: CalculatedMaterialLine[];
  laborLines: Array<LaborLineInput & { hourlyRateOre: number; totalOre: number; minutesDiffersFromStandard: boolean }>;
  otherCostLines: Array<OtherCostLineInput & { totalOre: number }>;
  subtotalOre: number;
  vatOre: number;
  totalInclVatOre: number;
  rotBaseOre: number;
  rotDeductionOre: number;
  customerTotalOre: number;
  warnings: string[];
  snapshot: Record<string, unknown>;
};

export const defaultPricingSettings: PricingSettingsInput = {
  preferredSupplierId: null,
  autoSelectLowestNetPrice: false,
  standardHourlyRateOre: 69500,
  materialMarkupPercent: 35,
  serviceVehicleFeeOre: 49500,
  minimumBillingMinutes: 60,
  vatPercent: 25,
  rotEnabledByDefault: false,
  rotDeductionPercent: 30,
  rotMaxDeductionOre: 5000000,
  customerRoundingIncrementOre: 100,
  estimateValidityDays: 30,
};

function cleanPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function cleanOre(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return null;
  return Math.max(0, Math.round(Number(value)));
}

function cleanQuantity(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function roundOre(value: number, incrementOre: number) {
  const increment = Math.max(1, Math.round(incrementOre || 1));
  return Math.round(value / increment) * increment;
}

function discountPriority(rule: DiscountRuleInput, line: MaterialLineInput, supplierPrice: SupplierPriceInput | null) {
  const product = line.product;
  const rsk = line.rskNumber ?? product?.rskNumber ?? null;
  if (rule.rskNumber && rsk && rule.rskNumber === rsk) return 400;
  if (rule.productGroup && product?.category && rule.productGroup === product.category) return 300;
  if (rule.category && product?.category && rule.category === product.category) return 250;
  if (rule.manufacturerName && product?.manufacturerName && rule.manufacturerName === product.manufacturerName) return 200;
  if (rule.supplierId && supplierPrice?.supplierId === rule.supplierId) return 100;
  return 0;
}

function pickSupplierPrice(
  line: MaterialLineInput,
  settings: PricingSettingsInput,
  discounts: DiscountRuleInput[],
) {
  const supplierPrices = line.supplierPrices ?? [];
  if (!supplierPrices.length) return null;

  const decorated = supplierPrices.map((supplierPrice) => {
    const rule = pickDiscount(line, supplierPrice, discounts);
    const discountPercent = cleanPercent(rule?.discountPercent ?? 0);
    const netPriceOre = Math.round(supplierPrice.listPriceOre * (1 - discountPercent / 100));
    return { supplierPrice, netPriceOre };
  });

  if (settings.autoSelectLowestNetPrice) {
    return decorated.sort((a, b) => a.netPriceOre - b.netPriceOre)[0]?.supplierPrice ?? supplierPrices[0];
  }

  return supplierPrices.find((supplierPrice) => supplierPrice.supplierId === settings.preferredSupplierId) ?? supplierPrices[0];
}

function pickDiscount(
  line: MaterialLineInput,
  supplierPrice: SupplierPriceInput | null,
  discounts: DiscountRuleInput[],
) {
  return discounts
    .filter((rule) => {
      if (rule.supplierId && supplierPrice?.supplierId !== rule.supplierId) return false;
      return discountPriority(rule, line, supplierPrice) > 0;
    })
    .sort((a, b) => discountPriority(b, line, supplierPrice) - discountPriority(a, line, supplierPrice))[0] ?? null;
}

function pickMarkup(line: MaterialLineInput, markups: MarkupRuleInput[], settings: PricingSettingsInput) {
  const productId = line.product?.id ?? null;
  const category = line.product?.category ?? null;
  const productRule = productId ? markups.find((rule) => rule.productModelId === productId) : null;
  const categoryRule = category ? markups.find((rule) => !rule.productModelId && rule.category === category) : null;
  const rule = productRule ?? categoryRule ?? null;
  return {
    percent: cleanPercent(rule?.markupPercent ?? settings.materialMarkupPercent),
    ruleId: rule?.id ?? null,
  };
}

export function calculateEstimate(
  input: CalculateEstimateInput,
  settingsInput: Partial<PricingSettingsInput>,
  discounts: DiscountRuleInput[] = [],
  markups: MarkupRuleInput[] = [],
): CalculatedEstimate {
  const settings = { ...defaultPricingSettings, ...settingsInput };
  const warnings: string[] = [];
  const materialLines = input.materialLines.map((line) => {
    const quantity = cleanQuantity(line.quantity);
    if (quantity === 0) warnings.push(`Antal saknas eller är 0 för ${line.description}.`);

    const supplierPrice = pickSupplierPrice(line, settings, discounts);
    const listPriceOre = cleanOre(supplierPrice?.listPriceOre ?? line.manualListPriceOre);
    if (listPriceOre === null) warnings.push(`Listpris saknas för ${line.description}.`);

    const discount = pickDiscount(line, supplierPrice, discounts);
    if (!discount) warnings.push(`Ingen rabattregel hittades för ${line.description}.`);

    const discountPercent = cleanPercent(discount?.discountPercent ?? 0);
    const netPriceOre = listPriceOre === null ? null : Math.round(listPriceOre * (1 - discountPercent / 100));
    const markup = pickMarkup(line, markups, settings);
    const customerUnitPriceOre = roundOre((netPriceOre ?? listPriceOre ?? 0) * (1 + markup.percent / 100), settings.customerRoundingIncrementOre);
    const totalCustomerPriceOre = roundOre(customerUnitPriceOre * quantity, settings.customerRoundingIncrementOre);

    return {
      description: line.description,
      rskNumber: line.rskNumber ?? line.product?.rskNumber ?? null,
      quantity,
      unit: supplierPrice?.unit ?? line.product?.unit ?? "st",
      supplierName: supplierPrice?.supplierName ?? line.supplierName ?? null,
      listPriceOre,
      discountPercent,
      discountRuleId: discount?.id ?? null,
      netPriceOre,
      markupPercent: markup.percent,
      markupRuleId: markup.ruleId,
      customerUnitPriceOre,
      totalCustomerPriceOre,
    };
  });

  const laborLines = input.laborLines.map((line) => {
    const minutes = Math.max(0, Math.round(line.minutes));
    const hourlyRateOre = cleanOre(line.hourlyRateOre) ?? settings.standardHourlyRateOre;
    if (minutes === 0) warnings.push(`Arbetstid saknas för ${line.workType}.`);
    if (!hourlyRateOre) warnings.push(`Timpris saknas för ${line.workType}.`);

    return {
      ...line,
      minutes,
      hourlyRateOre,
      totalOre: roundOre((minutes / 60) * hourlyRateOre, settings.customerRoundingIncrementOre),
      minutesDiffersFromStandard: line.standardMinutes != null && line.standardMinutes !== minutes,
    };
  });

  const otherCostLines = input.otherCostLines.map((line) => ({
    ...line,
    quantity: cleanQuantity(line.quantity),
    unitPriceOre: cleanOre(line.unitPriceOre) ?? 0,
    totalOre: roundOre(cleanQuantity(line.quantity) * (cleanOre(line.unitPriceOre) ?? 0), settings.customerRoundingIncrementOre),
  }));

  if (input.rotSelected === "unknown") warnings.push("ROT-status är inte bekräftad.");

  const materialTotalOre = materialLines.reduce((sum, line) => sum + line.totalCustomerPriceOre, 0);
  const laborTotalOre = laborLines.reduce((sum, line) => sum + line.totalOre, 0);
  const otherTotalOre = otherCostLines.reduce((sum, line) => sum + line.totalOre, 0);
  const subtotalOre = materialTotalOre + laborTotalOre + otherTotalOre;
  const vatOre = roundOre(subtotalOre * (cleanPercent(settings.vatPercent) / 100), 1);
  const totalInclVatOre = subtotalOre + vatOre;
  const rotBaseOre = input.rotSelected === "yes"
    ? laborLines.filter((line) => line.rotEligible).reduce((sum, line) => sum + line.totalOre, 0)
    : 0;
  const rotDeductionOre = input.rotSelected === "yes"
    ? Math.min(roundOre(rotBaseOre * (cleanPercent(settings.rotDeductionPercent) / 100), 1), settings.rotMaxDeductionOre)
    : 0;
  const customerTotalOre = Math.max(0, totalInclVatOre - rotDeductionOre);

  return {
    title: input.title,
    materialLines,
    laborLines,
    otherCostLines,
    subtotalOre,
    vatOre,
    totalInclVatOre,
    rotBaseOre,
    rotDeductionOre,
    customerTotalOre,
    warnings,
    snapshot: {
      calculatedAt: new Date().toISOString(),
      settings,
      warnings,
      input,
      result: {
        subtotalOre,
        vatOre,
        totalInclVatOre,
        rotBaseOre,
        rotDeductionOre,
        customerTotalOre,
      },
    },
  };
}

export function formatSekFromOre(ore: number | null | undefined) {
  const value = (ore ?? 0) / 100;
  return value.toLocaleString("sv-SE", { maximumFractionDigits: 0 }) + " kr";
}
