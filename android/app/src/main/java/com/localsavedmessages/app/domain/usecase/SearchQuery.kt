package com.localsavedmessages.app.domain.usecase

/**
 * Builds the SQL `LIKE` pattern for a search.
 *
 * SQLite's default tokenizer splits words on non-alphanumeric characters,
 * which breaks Persian words joined by a ZWNJ — «برنامه‌نویسی» would never
 * match a search for «برنامه» in an FTS index. A `LIKE` scan avoids the
 * problem entirely and needs no extra tables.
 *
 * The wildcards are escaped so a user's `%` or `_` is matched literally.
 */
object SearchQuery {

    fun pattern(raw: String): String? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return null

        val escaped = trimmed
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")

        return "%$escaped%"
    }
}
