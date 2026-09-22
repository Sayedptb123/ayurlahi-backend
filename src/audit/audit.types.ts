export type AuditAction =
  | 'create'
  | 'update'
  | 'soft_delete'
  | 'restore'
  | 'view'
  | 'login'
  | 'login_failed'
  | 'login_blocked'
  | 'logout'
  | 'otp_requested'
  | 'otp_request_failed'
  | 'otp_verified'
  | 'otp_verify_failed'
  | 'password_reset_completed'
  | 'token_refresh'
  | 'permission_change'
  | 'approve'
  | 'reject'
  | 'export'
  | (string & {}); // business verbs (e.g. 'admit', 'discharge') added by later phases

export type AuditSeverity = 'normal' | 'sensitive' | 'critical';

export type AuditSource = 'web' | 'mobile' | 'api' | 'system';

export type OrgType = 'CLINIC' | 'MANUFACTURER' | 'AYURLAHI_TEAM';
