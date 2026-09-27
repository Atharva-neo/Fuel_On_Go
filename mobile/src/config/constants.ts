// constants.ts — Centralized constants to avoid circular dependencies
function requiredPublicEnv(name: string, value: string | undefined): string {
	if (!value) throw new Error(`${name} must be configured for this build`);
	return value;
}

export const API_URL = requiredPublicEnv('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL).replace(/\/+$/, '');
export const SUPABASE_URL = requiredPublicEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = requiredPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
