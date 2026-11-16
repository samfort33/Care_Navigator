/**
 * Regional Coverage Configuration for CareNavigator Doctor Directory.
 * Supports environment-driven deployment configuration.
 */

export const DEFAULT_DIRECTORY_REGIONS = [
  'Dhaka',
  'Chattogram',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh',
] as const;

export type DirectoryRegion = (typeof DEFAULT_DIRECTORY_REGIONS)[number] | string;

/**
 * Returns the list of configured active regions for the current deployment.
 */
export function getConfiguredRegions(): string[] {
  const envRegions = process.env.DIRECTORY_COVERAGE_REGIONS;
  if (envRegions) {
    const parsed = envRegions
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  }
  return [...DEFAULT_DIRECTORY_REGIONS];
}

/**
 * Returns the default deployment region.
 */
export function getDefaultDeploymentRegion(): string {
  return process.env.DIRECTORY_DEFAULT_REGION || 'Dhaka';
}

/**
 * Validates whether a region is covered by the current deployment.
 */
export function isRegionCovered(region: string): boolean {
  if (!region) return false;
  const configured = getConfiguredRegions();
  return configured.some((r) => r.toLowerCase() === region.trim().toLowerCase());
}
