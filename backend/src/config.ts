import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '10000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['*'],
  appUrl: process.env.APP_URL || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  logLevel: process.env.LOG_LEVEL || 'info',
};

export const backendConfig = config;
