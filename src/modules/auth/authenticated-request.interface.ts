import type { Request } from 'express';

export type UserRole = 'issuer' | 'staff' | 'student' | 'super_admin';

/**
 * Shape of the user object attached to `req.user` by {@link JwtStrategy.validate}
 * once a request has passed the JWT guard.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization_id: string;
  staffRole: string | null;
}

/**
 * Express `Request` narrowed to guarantee `user` is populated, for use in
 * controllers/handlers guarded by `JwtAuthGuard`.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
