package com.localsavedmessages.app.domain.validation

import com.localsavedmessages.app.domain.model.FileCategory

/**
 * Maps a MIME type to a file extension and a display category.
 *
 * The stored name is always a UUID plus one of these extensions, so the
 * original file name never reaches the filesystem. The original name lives in
 * the database and is only used for display.
 */
object FileTypes {

    private val MIME_TO_EXTENSION = mapOf(
        "image/jpeg" to ".jpg",
        "image/png" to ".png",
        "image/gif" to ".gif",
        "image/webp" to ".webp",
        "image/heic" to ".heic",
        "image/svg+xml" to ".svg",
        "video/mp4" to ".mp4",
        "video/webm" to ".webm",
        "video/quicktime" to ".mov",
        "video/x-matroska" to ".mkv",
        "audio/mpeg" to ".mp3",
        "audio/mp4" to ".m4a",
        "audio/aac" to ".aac",
        "audio/ogg" to ".ogg",
        "audio/wav" to ".wav",
        "audio/x-wav" to ".wav",
        "application/pdf" to ".pdf",
        "application/zip" to ".zip",
        "application/msword" to ".doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" to ".docx",
        "application/vnd.ms-excel" to ".xls",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" to ".xlsx",
        "application/vnd.ms-powerpoint" to ".ppt",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" to ".pptx",
        "text/plain" to ".txt",
        "text/csv" to ".csv",
        "text/markdown" to ".md",
    )

    /**
     * The extension for a MIME type, falling back to the source file's own
     * extension when the MIME type is unknown or generic.
     */
    fun extensionFor(mimeType: String?, sourceName: String?): String {
        mimeType?.lowercase()?.let { MIME_TO_EXTENSION[it] }?.let { return it }

        val fromName = sourceName
            ?.substringAfterLast('.', "")
            ?.lowercase()
            ?.takeIf { it.isNotEmpty() && it.length <= 10 && it.all { ch -> ch.isLetterOrDigit() } }

        return if (fromName != null) ".$fromName" else ".bin"
    }

    fun categoryFor(mimeType: String?, isVoiceRecording: Boolean = false): FileCategory =
        FileCategory.fromMimeType(mimeType, isVoiceRecording)

    /** A short, human-readable label for a file type, shown under the name. */
    fun labelFor(category: FileCategory): String = when (category) {
        FileCategory.IMAGE -> "Image"
        FileCategory.VIDEO -> "Video"
        FileCategory.AUDIO -> "Audio"
        FileCategory.VOICE -> "Voice"
        FileCategory.DOCUMENT -> "Document"
        FileCategory.TEXT -> "Note"
    }
}
