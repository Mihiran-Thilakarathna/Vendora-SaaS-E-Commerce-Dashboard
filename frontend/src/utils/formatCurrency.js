export const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString("en-LK", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
};

/** Full LKR amount (no K / M abbreviations). */
export const formatCurrencyCompact = (value) => formatCurrency(value);
