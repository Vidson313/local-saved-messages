package com.localsavedmessages.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * The palette, ported from the Stitch design system.
 *
 * The primary is Telegram's blue `#2481CC`. The design system's prose calls for
 * it while the generated Material palette used a darker `#005F9E`; the two
 * disagreed, and the Telegram blue is the one that matches the product. This
 * file is the single source of truth — nothing else may hard-code a colour.
 */

// ── Light ────────────────────────────────────────────────────────────────
val PrimaryLight = Color(0xFF2481CC)
val OnPrimaryLight = Color(0xFFFFFFFF)
val PrimaryContainerLight = Color(0xFFD1E4FF)
val OnPrimaryContainerLight = Color(0xFF001D35)

val SecondaryLight = Color(0xFF2AABEE)
val OnSecondaryLight = Color(0xFFFFFFFF)
val SecondaryContainerLight = Color(0xFFC9E6FF)
val OnSecondaryContainerLight = Color(0xFF004869)

val TertiaryLight = Color(0xFF4FAE52)
val OnTertiaryLight = Color(0xFFFFFFFF)
val TertiaryContainerLight = Color(0xFF23862F)
val OnTertiaryContainerLight = Color(0xFFF7FFF1)
val TertiaryFixedLight = Color(0xFF97F993)
val OnTertiaryFixedLight = Color(0xFF002204)

val BackgroundLight = Color(0xFFF4F6F8)
val OnBackgroundLight = Color(0xFF171C1F)
val SurfaceLight = Color(0xFFFFFFFF)
val OnSurfaceLight = Color(0xFF171C1F)
val OnSurfaceVariantLight = Color(0xFF404751)
val SurfaceContainerLowLight = Color(0xFFF0F4F7)
val SurfaceContainerLight = Color(0xFFEAEEF1)
val SurfaceContainerHighLight = Color(0xFFE5E9EC)
val SurfaceContainerHighestLight = Color(0xFFDFE3E6)
val OutlineLight = Color(0xFF707882)
val OutlineVariantLight = Color(0xFFC0C7D3)

val ErrorLight = Color(0xFFBA1A1A)
val OnErrorLight = Color(0xFFFFFFFF)
val ErrorContainerLight = Color(0xFFFFDAD6)
val OnErrorContainerLight = Color(0xFF93000A)

val InverseSurfaceLight = Color(0xFF2C3134)
val InverseOnSurfaceLight = Color(0xFFEDF1F4)

// ── Dark ─────────────────────────────────────────────────────────────────
val PrimaryDark = Color(0xFF6AB2F0)
val OnPrimaryDark = Color(0xFF00344F)
val PrimaryContainerDark = Color(0xFF005F9E)
val OnPrimaryContainerDark = Color(0xFFD1E4FF)

val SecondaryDark = Color(0xFF6AB2F0)
val OnSecondaryDark = Color(0xFF00344F)
val SecondaryContainerDark = Color(0xFF006591)
val OnSecondaryContainerDark = Color(0xFFC9E6FF)

val TertiaryDark = Color(0xFF7BD87E)
val OnTertiaryDark = Color(0xFF00390A)
val TertiaryContainerDark = Color(0xFF005313)
val OnTertiaryContainerDark = Color(0xFF97F993)
val TertiaryFixedDark = Color(0xFF006D13)
val OnTertiaryFixedDark = Color(0xFF97F993)

val BackgroundDark = Color(0xFF14181C)
val OnBackgroundDark = Color(0xFFE3E6E9)
val SurfaceDark = Color(0xFF1C2126)
val OnSurfaceDark = Color(0xFFE3E6E9)
val OnSurfaceVariantDark = Color(0xFFC0C7D3)
val SurfaceContainerLowDark = Color(0xFF1C2126)
val SurfaceContainerDark = Color(0xFF20262B)
val SurfaceContainerHighDark = Color(0xFF2A3136)
val SurfaceContainerHighestDark = Color(0xFF353C41)
val OutlineDark = Color(0xFF8A9199)
val OutlineVariantDark = Color(0xFF404751)

val ErrorDark = Color(0xFFFFB4AB)
val OnErrorDark = Color(0xFF690005)
val ErrorContainerDark = Color(0xFF93000A)
val OnErrorContainerDark = Color(0xFFFFDAD6)

val InverseSurfaceDark = Color(0xFFE3E6E9)
val InverseOnSurfaceDark = Color(0xFF2C3134)

/**
 * The eight folder accents. Each is paired with a container tone so a folder
 * icon keeps its contrast in both themes.
 */
val FolderAccents = listOf(
    Color(0xFF2481CC),
    Color(0xFF4FAE52),
    Color(0xFF2AABEE),
    Color(0xFFE08A3C),
    Color(0xFF8B5CF6),
    Color(0xFFDB5C6B),
    Color(0xFF1FA8A0),
    Color(0xFF6B7280),
)
