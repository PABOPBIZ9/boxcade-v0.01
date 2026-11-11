export const DYNAMIC_ENV_ID = (process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? "").trim();
export const hasDynamicEnv = Boolean(DYNAMIC_ENV_ID);
