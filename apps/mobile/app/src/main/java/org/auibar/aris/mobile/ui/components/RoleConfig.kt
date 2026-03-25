package org.auibar.aris.mobile.ui.components

import androidx.compose.ui.graphics.Color

/**
 * Role configuration matching the web app's Sidebar.tsx ROLE_STATIC_ACCESS
 * and Header.tsx ROLE_COLORS.
 */
object RoleConfig {

    // ── Role badge colors (background, text) — matches Header.tsx ────
    data class RoleBadgeStyle(
        val background: Color,
        val text: Color,
    )

    val roleBadgeStyles: Map<String, RoleBadgeStyle> = mapOf(
        "SUPER_ADMIN" to RoleBadgeStyle(
            background = Color(0xFFFFCDD2), text = Color(0xFFC62828),
        ),
        "CONTINENTAL_ADMIN" to RoleBadgeStyle(
            background = Color(0xFFA5D6A7), text = Color(0xFF1B5E20),
        ),
        "REC_ADMIN" to RoleBadgeStyle(
            background = Color(0xFFBBDEFB), text = Color(0xFF1565C0),
        ),
        "NATIONAL_ADMIN" to RoleBadgeStyle(
            background = Color(0xFFB3E5FC), text = Color(0xFF0277BD),
        ),
        "DATA_STEWARD" to RoleBadgeStyle(
            background = Color(0xFFE1BEE7), text = Color(0xFF6A1B9A),
        ),
        "WAHIS_FOCAL_POINT" to RoleBadgeStyle(
            background = Color(0xFFB2DFDB), text = Color(0xFF00695C),
        ),
        "ANALYST" to RoleBadgeStyle(
            background = Color(0xFFE0E0E0), text = Color(0xFF424242),
        ),
        "FIELD_AGENT" to RoleBadgeStyle(
            background = Color(0xFFFFECB3), text = Color(0xFFE65100),
        ),
    )

    private val defaultBadgeStyle = RoleBadgeStyle(
        background = Color(0xFFE0E0E0), text = Color(0xFF424242),
    )

    fun badgeStyleFor(role: String?): RoleBadgeStyle =
        roleBadgeStyles[role] ?: defaultBadgeStyle

    // ── Human-readable role labels ──────────────────────────────────
    val roleLabels: Map<String, String> = mapOf(
        "SUPER_ADMIN" to "Super Admin",
        "CONTINENTAL_ADMIN" to "Continental Admin",
        "REC_ADMIN" to "REC Admin",
        "NATIONAL_ADMIN" to "National Admin",
        "DATA_STEWARD" to "Data Steward",
        "WAHIS_FOCAL_POINT" to "WAHIS Focal Point",
        "ANALYST" to "Analyst",
        "FIELD_AGENT" to "Field Agent",
    )

    fun labelFor(role: String?): String =
        roleLabels[role] ?: role?.replace("_", " ")?.lowercase()
            ?.replaceFirstChar { it.uppercase() } ?: "Unknown"

    // ── Tenant level labels ─────────────────────────────────────────
    val tenantLevelLabels: Map<String, String> = mapOf(
        "CONTINENTAL" to "Continental (AU-IBAR)",
        "REC" to "Regional Economic Community",
        "MEMBER_STATE" to "Member State",
    )

    fun tenantLevelLabel(level: String?): String =
        tenantLevelLabels[level] ?: level ?: ""

    // ── Domain access per role — matches Sidebar.tsx ─────────────────
    // Domains visible on the dashboard grid per role.
    // null = all domains visible (SUPER_ADMIN / CONTINENTAL_ADMIN)
    val roleDomainAccess: Map<String, Set<String>?> = mapOf(
        "SUPER_ADMIN" to null,
        "CONTINENTAL_ADMIN" to null,
        "REC_ADMIN" to null,
        "NATIONAL_ADMIN" to null,
        "DATA_STEWARD" to null,
        "WAHIS_FOCAL_POINT" to setOf("health", "livestock", "fisheries", "wildlife", "trade"),
        "ANALYST" to null,
        "FIELD_AGENT" to setOf("health"),
    )

    fun visibleDomains(role: String?): List<DomainInfo> {
        val allowed = roleDomainAccess[role]
        return if (allowed == null) {
            arisDomains
        } else {
            arisDomains.filter { it.key in allowed }
        }
    }

    /**
     * Combine role-based access with user's assigned domains from the backend.
     * If [userDomainCodes] is non-empty, intersect with role-based access.
     * SUPER_ADMIN with empty domains sees everything (backwards-compatible).
     */
    fun visibleDomains(role: String?, userDomainCodes: List<String>): List<DomainInfo> {
        val roleAllowed = roleDomainAccess[role]
        // If user has no assigned domains (legacy or SUPER_ADMIN), fall back to role-only
        if (userDomainCodes.isEmpty()) {
            return visibleDomains(role)
        }
        // Map backend codes to mobile keys (e.g. "animal-health" → "health")
        val mappedCodes = userDomainCodes.map { backendToMobileKey(it) }.toSet()
        return if (roleAllowed == null) {
            // Role sees all → restrict to assigned domains
            arisDomains.filter { it.key in mappedCodes }
        } else {
            // Role has restrictions → intersect with assigned domains
            arisDomains.filter { it.key in roleAllowed && it.key in mappedCodes }
        }
    }

    /** Map backend domain codes to mobile DomainConfig keys */
    fun backendToMobileKey(code: String): String = when (code) {
        "animal-health" -> "health"
        "livestock-prod" -> "livestock"
        "trade-sps" -> "trade"
        "climate-env" -> "climate"
        "knowledge-hub" -> "knowledge"
        else -> code // fisheries, wildlife, apiculture, governance — same
    }

    // ── Quick actions per role ───────────────────────────────────────
    data class QuickAction(
        val key: String,
        val labelRes: Int? = null,
    )

    // Roles that can create submissions
    val canCreateSubmission = setOf(
        "SUPER_ADMIN", "CONTINENTAL_ADMIN", "REC_ADMIN",
        "NATIONAL_ADMIN", "DATA_STEWARD", "WAHIS_FOCAL_POINT", "FIELD_AGENT",
    )

    // Roles that can see reports
    val canSeeReports = setOf(
        "SUPER_ADMIN", "CONTINENTAL_ADMIN", "REC_ADMIN",
        "NATIONAL_ADMIN", "DATA_STEWARD", "WAHIS_FOCAL_POINT", "ANALYST",
    )

    fun canCreate(role: String?): Boolean = role in canCreateSubmission
    fun canReport(role: String?): Boolean = role in canSeeReports
}
