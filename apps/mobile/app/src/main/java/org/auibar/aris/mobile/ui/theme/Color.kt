package org.auibar.aris.mobile.ui.theme

import androidx.compose.ui.graphics.Color

// ARIS brand colors (AU-IBAR)
val ArisPrimary = Color(0xFF1B5E20)         // AU green (dark)
val ArisPrimaryLight = Color(0xFF4C8C4A)
val ArisPrimaryDark = Color(0xFF003300)
val ArisSecondary = Color(0xFFFF8F00)        // AU gold/amber
val ArisSecondaryLight = Color(0xFFFFC046)
val ArisSecondaryDark = Color(0xFFC56000)
val ArisError = Color(0xFFD32F2F)
val ArisSurface = Color(0xFFFFFBFE)
val ArisBackground = Color(0xFFF5F5F5)
val ArisOnPrimary = Color(0xFFFFFFFF)
val ArisOnSecondary = Color(0xFF000000)
val ArisOnSurface = Color(0xFF1C1B1F)

// Sync status colors
val SyncPending = Color(0xFFFFA726)
val SyncSuccess = Color(0xFF66BB6A)
val SyncFailed = Color(0xFFEF5350)
val SyncConflict = Color(0xFFAB47BC)

// Workflow level colors
val WorkflowLevel1 = Color(0xFF42A5F5)   // National Data Steward — blue
val WorkflowLevel2 = Color(0xFF26A69A)   // Data Owner / CVO — teal
val WorkflowLevel3 = Color(0xFFFF8F00)   // REC Data Steward — amber
val WorkflowLevel4 = Color(0xFF1B5E20)   // AU-IBAR — AU green

// Quality gate colors
val QualityPass = Color(0xFF4CAF50)
val QualityFail = Color(0xFFE53935)
val QualityWarn = Color(0xFFFFC107)

// ── 9 Domain Colors (matching web app) ──────────────────────────────
val DomainAnimalHealth = Color(0xFFC62828)  // Red 800
val DomainLivestock    = Color(0xFFE65100)  // Orange 900
val DomainFisheries    = Color(0xFF00838F)  // Cyan 800
val DomainTrade        = Color(0xFF1565C0)  // Blue 800
val DomainWildlife     = Color(0xFF2E7D32)  // Green 800
val DomainApiculture   = Color(0xFFF9A825)  // Yellow 800
val DomainGovernance   = Color(0xFF37474F)  // Blue Grey 800
val DomainClimate      = Color(0xFF00695C)  // Teal 800
val DomainKnowledge    = Color(0xFF4527A0)  // Deep Purple 800
val DomainPaid         = Color(0xFF6A1B9A)  // Purple 800

// ── Gradient colors ─────────────────────────────────────────────────
val GradientDarkGreen  = Color(0xFF0A2E14)
val GradientMidGreen   = Color(0xFF1B5E20)
val GradientTeal       = Color(0xFF004D40)
val GradientDeepGreen  = Color(0xFF062B0E)

// ── Glass / morphism colors ─────────────────────────────────────────
val GlassWhite         = Color(0x1AFFFFFF)  // 10% white
val GlassBorder        = Color(0x33FFFFFF)  // 20% white
val GlassOverlay       = Color(0x0DFFFFFF)  // 5% white

// ── Error on dark surface (used on glassmorphic cards) ────────────────
val ErrorLight = Color(0xFFFF8A80)           // Red A100 — readable on dark BG

// ── GPS track color ───────────────────────────────────────────────────
val TrackGreen = Color(0xFF1B5E20)           // Matches ArisPrimary

// ── Gold accent ─────────────────────────────────────────────────────
val GoldAccent         = Color(0xFFD4A843)
val GoldAccentLight    = Color(0xFFE8C96A)
val GoldAccentDark     = Color(0xFFB08930)
