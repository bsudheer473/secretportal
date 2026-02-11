/**
 * Environment configuration for API endpoints and AWS services
 */

export interface EnvironmentConfig {
  apiBaseUrl: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  awsRegion: string;
}

const config: EnvironmentConfig = {
  apiBaseUrl: import.meta.env.VITE_API_ENDPOINT || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  cognitoUserPoolId: import.meta.env.VITE_USER_POOL_ID || import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  cognitoClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || import.meta.env.VITE_COGNITO_CLIENT_ID || '',
  awsRegion: import.meta.env.VITE_AWS_REGION || 'us-east-1',
};

export default config;
