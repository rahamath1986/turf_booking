export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';
export const TENANT_OWNER_KEY = 'tenantOwner';

export const REDIS_KEYS = {
  SLOT_HOLD_PREFIX: 'slot_hold:',
  SLOT_LOCK_PREFIX: 'slot_lock:',
  USER_SESSION_PREFIX: 'user_session:',
};

export const API_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  HOLD_EXPIRATION_SECONDS: 600, // 10 minutes temporary slot hold
};
