declare module '*.css' {
  const content: string
  export default content
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_SUPABASE_URL: string;
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
      NODE_ENV: 'development' | 'production';
      SUPABASE_PROJECT_REF: string;
      RESEND_API_KEY: string;
      TWILIO_ACCOUNT_SID: string;
      TWILIO_AUTH_TOKEN: string;
      TWILIO_FROM_NUMBER: string;
      WHATSAPP_API_TOKEN: string;
      WHATSAPP_PHONE_NUMBER_ID: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      CRON_SECRET: string;
      CONTACT_INBOX_EMAIL?: string;
    }
  }
}

// eslint-disable-next-line prettier/prettier
export { };

