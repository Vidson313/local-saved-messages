package com.localsavedmessages.app.ui.components

import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * Formatting helpers.
 *
 * The web app's `formatBytes` (`components/ChatApp.tsx:183`) uses a 1024
 * base; this keeps the same base so the two apps agree, but adds the locale's
 * digit shapes and separator.
 */
object Formatters {

    private val BYTE_UNITS = listOf("B", "KB", "MB", "GB", "TB")

    fun formatBytes(value: Long?, locale: Locale = Locale.getDefault()): String {
        if (value == null || value < 0) return ""
        if (value == 0L) return "0 ${BYTE_UNITS[0]}"

        var size = value.toDouble()
        var unit = 0
        while (size >= 1024 && unit < BYTE_UNITS.lastIndex) {
            size /= 1024
            unit++
        }

        val pattern = if (size >= 10) "%.0f" else "%.1f"
        val number = String.format(Locale.ROOT, pattern, size)
        val localised = NumberFormat.getInstance(locale).format(number.toDouble())
        return "$localised ${BYTE_UNITS[unit]}"
    }

    /** The clock time, e.g. «۱۲:۴۰». */
    fun formatTime(epochMillis: Long, locale: Locale = Locale.getDefault()): String {
        val formatter = DateTimeFormatter.ofPattern("HH:mm", locale)
        return formatter.format(Instant.ofEpochMilli(epochMillis).atZone(ZoneId.systemDefault()))
    }

    /** A relative day label, e.g. «امروز» or «۳ روز پیش». */
    fun formatDay(epochMillis: Long, locale: Locale = Locale.getDefault()): String {
        val zone = ZoneId.systemDefault()
        val date = Instant.ofEpochMilli(epochMillis).atZone(zone)
        val today = Instant.now().atZone(zone).toLocalDate()
        val days = ChronoUnit.DAYS.between(date.toLocalDate(), today)

        return when {
            days == 0L -> DateTimeFormatter.ofPattern("d MMMM", locale).format(date)
            days == 1L -> DateTimeFormatter.ofPattern("d MMMM", locale).format(date)
            days in 2..6 -> DateTimeFormatter.ofPattern("EEEE", locale).format(date)
            else -> DateTimeFormatter.ofPattern("d MMMM yyyy", locale).format(date)
        }
    }

    /**
     * Formats a duration in milliseconds as `m:ss`, or `h:mm:ss` past an hour.
     */
    fun formatDuration(durationMs: Long?): String {
        if (durationMs == null || durationMs < 0) return "0:00"
        val totalSeconds = durationMs / 1000
        val hours = totalSeconds / 3600
        val minutes = (totalSeconds % 3600) / 60
        val seconds = totalSeconds % 60
        return if (hours > 0) {
            "%d:%02d:%02d".format(hours, minutes, seconds)
        } else {
            "%d:%02d".format(minutes, seconds)
        }
    }
}
