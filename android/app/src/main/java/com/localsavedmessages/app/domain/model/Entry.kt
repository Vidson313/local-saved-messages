package com.localsavedmessages.app.domain.model

/**
 * The category a saved item falls into. Stored on the row so the type filter
 * is an indexed comparison rather than a MIME prefix scan.
 */
enum class FileCategory {
    IMAGE,
    VIDEO,
    AUDIO,
    VOICE,
    DOCUMENT,
    TEXT,
    ;

    companion object {
        /**
         * Derives the category from a MIME type.
         *
         * A `voice/` marker distinguishes a voice note recorded inside the app
         * from a music file that happened to arrive over the share sheet.
         */
        fun fromMimeType(mimeType: String?, isVoiceRecording: Boolean = false): FileCategory = when {
            isVoiceRecording -> VOICE
            mimeType == null -> DOCUMENT
            mimeType.startsWith("image/") -> IMAGE
            mimeType.startsWith("video/") -> VIDEO
            mimeType.startsWith("audio/") -> AUDIO
            mimeType.startsWith("text/") -> DOCUMENT
            else -> DOCUMENT
        }
    }
}

/**
 * One saved item: a text note, a file, or a file that carries a note.
 */
data class Entry(
    val id: String,
    val folderId: String,
    val category: FileCategory,
    val note: String,
    val body: String?,
    val filePath: String?,
    val fileName: String?,
    val fileSize: Long?,
    val mimeType: String?,
    val durationMs: Long?,
    val width: Int?,
    val height: Int?,
    val thumbPath: String?,
    val pinned: Boolean,
    val hidden: Boolean,
    val tags: List<String>,
    val createdAt: Long,
    val updatedAt: Long,
) {
    val hasFile: Boolean get() = filePath != null
    val hasText: Boolean get() = note.isNotBlank() || !body.isNullOrBlank()

    /** The line shown under the title in a list. */
    val preview: String
        get() = when {
            fileName != null && note.isNotBlank() -> note
            fileName != null -> fileName
            !body.isNullOrBlank() -> body
            note.isNotBlank() -> note
            else -> ""
        }
}
