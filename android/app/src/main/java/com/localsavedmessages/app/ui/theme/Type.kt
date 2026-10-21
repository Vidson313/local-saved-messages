package com.localsavedmessages.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.sp
import com.localsavedmessages.app.R

/**
 * Vazirmatn, bundled.
 *
 * The app is offline and Persian is its primary language, so the font cannot
 * come from a download. Bundling also means Persian renders identically on
 * every device, instead of depending on whatever Persian font the system
 * happens to ship.
 */
val Vazirmatn = FontFamily(
    Font(R.font.vazirmatn_regular, FontWeight.Normal),
    Font(R.font.vazirmatn_medium, FontWeight.Medium),
    Font(R.font.vazirmatn_semibold, FontWeight.SemiBold),
    Font(R.font.vazirmatn_bold, FontWeight.Bold),
)

/**
 * Persian glyphs sit taller and have deeper descenders than Latin ones, so the
 * line heights are generous and the alignment trims the extra space that
 * would otherwise push Persian text off its baseline.
 */
private val persianLineHeight = LineHeightStyle(
    alignment = LineHeightStyle.Alignment.Center,
    trim = LineHeightStyle.Trim.None,
)

private fun vazir(
    size: Int,
    lineHeight: Int,
    weight: FontWeight,
    letterSpacing: Double = 0.0,
) = TextStyle(
    fontFamily = Vazirmatn,
    fontSize = size.sp,
    lineHeight = lineHeight.sp,
    fontWeight = weight,
    letterSpacing = letterSpacing.sp,
    lineHeightStyle = persianLineHeight,
)

/**
 * The type scale, matching the Stitch design system's tokens one to one.
 */
val AppTypography = Typography(
    headlineLarge = vazir(22, 32, FontWeight.Bold),
    headlineMedium = vazir(17, 24, FontWeight.Bold),
    headlineSmall = vazir(15, 22, FontWeight.SemiBold),
    titleLarge = vazir(20, 28, FontWeight.Bold),
    titleMedium = vazir(15, 22, FontWeight.SemiBold),
    titleSmall = vazir(14, 20, FontWeight.SemiBold),
    bodyLarge = vazir(15, 24, FontWeight.Normal),
    bodyMedium = vazir(14, 22, FontWeight.Normal),
    bodySmall = vazir(12, 18, FontWeight.Normal),
    labelLarge = vazir(14, 20, FontWeight.SemiBold),
    labelMedium = vazir(12, 16, FontWeight.SemiBold),
    labelSmall = vazir(11, 14, FontWeight.Medium),
)
