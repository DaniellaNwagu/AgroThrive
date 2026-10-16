function getKeys(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? getKeys(value, path) : [path];
  });
}

function getMissingKeys(source, target) {
  const targetKeys = new Set(getKeys(target));
  return getKeys(source).filter((key) => !targetKeys.has(key));
}

module.exports = { getKeys, getMissingKeys };
