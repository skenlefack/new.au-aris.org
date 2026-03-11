# ADR-004: Custom JWT RS256 Authentication over External Identity Providers

## Status

Accepted

## Date

2024-06-01

## Context

ARIS 4.0 must authenticate and authorize users across a complex multi-tenant hierarchy: AU-IBAR (continental), 8 Regional Economic Communities, and 55 Member States. The authentication system must satisfy the following requirements:

1. **No external dependency:** AU-IBAR operates critical continental infrastructure for animal resource management. A dependency on an external identity provider (commercial SaaS or third-party open source) introduces a single point of failure outside AU-IBAR's operational control. Internet connectivity across African Member States is variable; authentication must work even when external services are unreachable.

2. **Offline mobile support:** Field agents (FIELD_AGENT role) collect data in remote areas with intermittent or no connectivity using the Kotlin Android app. The mobile app must authenticate users locally and queue data for sync when connectivity returns. This requires tokens that are verifiable offline without contacting an authentication server.

3. **Multi-tenant RBAC:** The system defines 8 roles (SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN, NATIONAL_ADMIN, DATA_STEWARD, WAHIS_FOCAL_POINT, ANALYST, FIELD_AGENT) that are scoped to tenant hierarchy levels. A NATIONAL_ADMIN for Kenya must not access Ethiopian data. A REC_ADMIN for IGAD must see all IGAD Member States but not ECOWAS data. These role-tenant bindings must be embedded in the authentication token for efficient per-request authorization without additional database lookups.

4. **Data classification enforcement:** Every API request must carry sufficient context to enforce data classification rules (PUBLIC, PARTNER, RESTRICTED, CONFIDENTIAL). The authentication token must include the user's clearance level and tenant scope.

5. **Audit compliance:** Every action must be traceable to a specific user, role, and tenant. The authentication system must provide unforgeable identity claims that are logged in the audit trail.

6. **MFA requirement:** Users with roles above FIELD_AGENT must use multi-factor authentication (MFA) for login, as mandated by the AU-IBAR security policy. The MFA implementation must work offline (TOTP-based, not SMS-based) to accommodate connectivity constraints.

## Decision

We implement a **custom credential service** (`services/credential/` on port 3002) that handles authentication, token issuance, and MFA verification. The authentication mechanism is **JWT with RS256 asymmetric signing**.

Key design decisions:

**Token architecture:**
- Access tokens are signed with RS256 (RSA 2048-bit private key). The private key is held exclusively by the credential service. All other services validate tokens using the corresponding public key distributed via a JWKS endpoint.
- Access token payload includes: `sub` (userId), `tenantId`, `tenantLevel` (CONTINENTAL | REC | MEMBER_STATE), `role` (UserRole enum), `dataClassification` (maximum clearance), `iat`, `exp`.
- Access token TTL: 15 minutes. Refresh token TTL: 7 days (stored as httpOnly secure cookie and in Redis for revocation).
- Token refresh is silent on the web app; the mobile app stores refresh tokens in Android Keystore.

**Password management:**
- Passwords are hashed with **bcrypt** (cost factor 12). No plaintext or reversible encryption.
- Password policy: minimum 12 characters, complexity requirements enforced at the credential service.
- Password reset flows use time-limited tokens delivered via the message service (email/SMS).

**Multi-factor authentication:**
- TOTP-based MFA (RFC 6238) using a shared secret stored encrypted in PostgreSQL.
- QR code provisioning via standard authenticator apps (Google Authenticator, Authy, etc.).
- MFA is mandatory for SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN, and NATIONAL_ADMIN roles.
- MFA is optional but encouraged for DATA_STEWARD, WAHIS_FOCAL_POINT, and ANALYST roles.
- FIELD_AGENT accounts use device-based authentication (device certificate) instead of TOTP, given the mobile-only access pattern.

**Rate limiting:**
- Login attempts are rate-limited: 5 attempts per 15-minute window per account, enforced via Redis counters.
- After lockout, accounts require administrator intervention or a time-based unlock after 30 minutes.

**Shared middleware:**
- The `@aris/auth-middleware` package provides NestJS guards (`AuthGuard`, `RolesGuard`, `TenantGuard`) and decorators (`@CurrentUser()`) that all 22 services use to validate tokens and enforce RBAC.
- Token validation is stateless: services verify the RS256 signature and check `exp` without contacting the credential service. This enables offline token validation on the mobile app using the embedded public key.

**Key rotation:**
- RS256 key pairs are rotated quarterly. The JWKS endpoint serves both current and previous keys during a transition period. Services cache the JWKS and refresh periodically.

## Consequences

### Positive

- **Zero external dependency:** The credential service runs entirely within the ARIS infrastructure. Authentication continues to function during internet outages, cloud provider incidents, or third-party service disruptions.
- **Offline verification:** RS256 asymmetric tokens can be verified by any service (or the mobile app) using only the public key, without network calls to the credential service. This is essential for field agents operating offline.
- **Embedded authorization context:** The JWT payload carries tenantId, role, and clearance level, enabling per-request authorization without database lookups. This reduces latency and database load across all 22 services.
- **Full control over security policy:** AU-IBAR retains complete control over password policies, MFA requirements, session management, and rate limiting without being constrained by an external provider's feature set or pricing tier.
- **Audit trail integrity:** Every token is signed with AU-IBAR's private key, providing cryptographic proof of identity for audit entries. No external party can forge identity claims.
- **Cost predictability:** No per-user licensing fees from commercial identity providers. The cost is fixed infrastructure (the credential service) regardless of the number of users across 55 Member States.

### Negative

- **Security responsibility:** Building custom authentication means AU-IBAR bears full responsibility for security best practices: secure key storage, protection against timing attacks in token validation, proper bcrypt implementation, CSRF protection, and XSS mitigation. A security audit is planned before production launch.
- **Feature development burden:** Features that come standard with Keycloak or Auth0 (social login, adaptive MFA, user self-service portal, LDAP federation) must be built from scratch if needed. The current scope intentionally excludes social login and LDAP federation as they are not required.
- **Maintenance overhead:** Security patches, vulnerability fixes, and protocol updates (e.g., migrating to Ed25519 in the future) are the team's responsibility rather than an upstream vendor's.
- **No standards-based federation:** The custom implementation does not support SAML or OIDC federation out of the box. If Member States later require federation with their national identity systems, an OIDC adapter layer must be built.

### Neutral

- **Token size:** RS256 JWT tokens with embedded claims are larger (~800 bytes) than opaque session tokens. This is acceptable for HTTP headers but noted for mobile bandwidth-constrained scenarios. Payload is kept minimal to limit token size.
- **Key management:** RSA key pair management (generation, rotation, secure storage) adds operational procedure requirements. Keys are stored in environment variables in production, with a planned migration to HashiCorp Vault for hardware-backed key storage.

## Alternatives Considered

### Keycloak

An open-source identity and access management solution with OIDC, SAML, and comprehensive user management. Rejected because: (1) Keycloak is a large Java application requiring its own PostgreSQL database, JVM tuning, and significant memory (minimum 2 GB), adding operational complexity, (2) offline token verification requires Keycloak-specific adapter libraries not available for all platforms, (3) customizing Keycloak's multi-tenant model to match the AU-IBAR > REC > Member State hierarchy requires extensive SPI development that negates the "out of the box" advantage, (4) Keycloak's authentication flows cannot be verified offline on the mobile app without a custom extension, and (5) upgrading Keycloak across major versions has historically been disruptive.

### Auth0

A commercial identity-as-a-service platform. Rejected because: (1) it introduces a dependency on a US-based commercial SaaS provider, conflicting with AU digital sovereignty requirements, (2) Auth0 pricing at scale (potentially thousands of users across 55 Member States) is unpredictable and subject to vendor pricing changes, (3) offline authentication for mobile field agents is not natively supported, (4) the multi-tenant hierarchy would require multiple Auth0 tenants or complex Organizations configuration, and (5) data residency -- user credentials would be stored outside AU-IBAR's infrastructure.

### Firebase Authentication

Google's authentication service. Rejected because: (1) it creates a dependency on Google Cloud Platform, conflicting with infrastructure sovereignty, (2) Firebase Auth has limited RBAC capabilities -- role management would need a separate system, (3) offline authentication is limited to Firebase's built-in patterns that do not support custom multi-tenant claims, and (4) custom claims are limited to 1000 bytes, which may be insufficient for the tenant hierarchy and role metadata.

### AWS Cognito

Amazon's managed identity service. Rejected for similar reasons as Auth0 and Firebase: (1) vendor lock-in to AWS, (2) limited offline support, (3) Cognito's group/role model does not map cleanly to the 8-role, 3-level tenant hierarchy, and (4) AU-IBAR's planned hybrid cloud/on-premise deployment model requires authentication infrastructure that can run anywhere.
