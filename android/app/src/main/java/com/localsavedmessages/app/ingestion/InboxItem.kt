package com.localsavedmessages.app.ingestion

import android.net.Uri

/**
 * One thing the user shared, before it has been stored.
 *
 * A share carries either a file, a body of text, or both. When both are
 * present the text is the note attached to the file, not a separate entry —
 * Telegram sends a photo's caption in the text slot, and splitting it would
 * separate the caption from its photo.
 */
sealed interface InboxItem {
    val displayName: String

    data class FileItem(
        override val displayName: String,
        val uri: Uri,
        val mimeType: String?,
        /** Null when the content provider does not report a size. */
        val sizeBytes: Long?,
    ) : InboxItem

    data class TextItem(
        override val displayName: String,
        val text: String,
    ) : InboxItem
}
