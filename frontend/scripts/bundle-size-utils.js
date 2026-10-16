export function parseBudget(name, value, fallback) {
  const budget = Number(value ?? fallback);
  if (!Number.isFinite(budget) || budget <= 0) throw new Error(`${name} must be a positive number`);
  return budget;
}

export function classifyChunks(files) {
  const initial = files.filter(({ name }) => /^(vendor|index|main)/.test(name));
  if (!initial.length) throw new Error('No initial JavaScript chunks were found');
  return { initial, initialBytes: initial.reduce((sum, file) => sum + file.size, 0), totalBytes: files.reduce((sum, file) => sum + file.size, 0) };
}

export function exceedsBudget(bytes, budgetKb) { return bytes / 1024 > budgetKb; }
