export const timePresets = [
  { id: '15m', label: '15m', ms: 15 * 60 * 1_000 },
  { id: '1h', label: '1h', ms: 60 * 60 * 1_000 },
  { id: '6h', label: '6h', ms: 6 * 60 * 60 * 1_000 },
] as const;

export const AWS_REGIONS = [
  { value: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
  { value: 'us-east-2', label: 'us-east-2 (Ohio)' },
  { value: 'us-west-1', label: 'us-west-1 (N. California)' },
  { value: 'us-west-2', label: 'us-west-2 (Oregon)' },
  { value: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
  { value: 'eu-central-1', label: 'eu-central-1 (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 (Singapore)' },
  { value: 'ap-northeast-1', label: 'ap-northeast-1 (Tokyo)' },
  { value: 'ap-south-1', label: 'ap-south-1 (Mumbai)' },
  { value: 'sa-east-1', label: 'sa-east-1 (São Paulo)' },
  { value: 'ca-central-1', label: 'ca-central-1 (Canada)' },
  { value: 'ap-southeast-2', label: 'ap-southeast-2 (Sydney)' },
  { value: 'ap-northeast-2', label: 'ap-northeast-2 (Seoul)' },
  { value: 'ap-northeast-3', label: 'ap-northeast-3 (Osaka)' },
  { value: 'ap-northeast-4', label: 'ap-northeast-4 (Tokyo)' },
  {
    value: 'ap-northeast-5',
    label: 'us-west-3 (Los Angeles)',
  },
  { value: 'us-west-4', label: 'us-west-4 (Las Vegas)' },
  { value: 'us-east-3', label: 'us-east-3 (Ohio)' },
  { value: 'us-east-4', label: 'us-east-4 (N. Virginia)' },
  { value: 'us-east-5', label: 'us-east-5 (N. Virginia)' },
  { value: 'us-east-6', label: 'us-east-6 (N. Virginia)' },
  { value: 'us-east-7', label: 'us-east-7 (N. Virginia)' },
  { value: 'us-east-8', label: 'us-east-8 (N. Virginia)' },
  { value: 'us-east-9', label: 'us-east-9 (N. Virginia)' },
  { value: 'us-east-10', label: 'us-east-10 (N. Virginia)' },
] as const;

export function getDashboardTimeLabel(timePreset: string): string {
  return timePreset === '15m'
    ? '15 minutes'
    : timePreset === '1h'
      ? 'hour'
      : '6 hours';
}
