export function nextSequentialReportNo(year: number, reportNumbers: string[]) {
  const prefix = `RVM-HS-${year}-`;
  const highestSequence = reportNumbers.reduce((highest, reportNumber) => {
    if (!reportNumber.startsWith(prefix)) return highest;
    const suffix = reportNumber.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) return highest;
    return Math.max(highest, Number(suffix));
  }, 0);

  return `${prefix}${String(highestSequence + 1).padStart(4, "0")}`;
}
