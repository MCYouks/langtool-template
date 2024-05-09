export const findMissingParams = (
  requiredParams: string[],
  extractedParams: string[]
) => {
  const missing = requiredParams.filter(
    (required) => !extractedParams.some((extracted) => extracted === required)
  );
  return missing;
};
