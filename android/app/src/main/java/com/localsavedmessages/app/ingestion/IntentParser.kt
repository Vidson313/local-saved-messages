package com.localsavedmessages.app.ingestion

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.content.ContentResolver

/**
 * Turns a share intent into the list of items the user is saving.
 *
 * Android allows several shapes for the same action, and each app sends a
 * slightly different one:
 *
 * - `EXTRA_STREAM` holding a single `Uri`
 * - `EXTRA_STREAM` holding a `ClipData` (the multi-select case)
 * - `ACTION_SEND_MULTIPLE` with `EXTRA_STREAM` holding a `ClipData`
 * - `EXTRA_STREAM` holding an array of `Uri` (some legacy apps)
 * - `EXTRA_TEXT` alone, or alongside a stream
 */
object IntentParser {

    sealed interface Result {
        data class Parsed(
            val items: List<InboxItem>,
            /** Text sent alongside a file; it becomes the note, not its own entry. */
            val prefilledNote: String?,
        ) : Result

        data object Empty : Result
    }

    fun parse(intent: Intent?, resolver: ContentResolver): Result {
        if (intent == null) return Result.Empty

        val uris = collectUris(intent)
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.takeIf { it.isNotBlank() }
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.takeIf { it.isNotBlank() }
        val mimeType = intent.type

        if (uris.isEmpty()) {
            if (text == null) return Result.Empty
            return Result.Parsed(
                items = listOf(InboxItem.TextItem(displayName = subject ?: "text", text = text)),
                prefilledNote = null,
            )
        }

        val items = uris.map { uri ->
            InboxItem.FileItem(
                displayName = displayNameOf(resolver, uri),
                uri = uri,
                mimeType = resolveMimeType(resolver, uri, mimeType),
                sizeBytes = sizeOf(resolver, uri),
            )
        }

        // Text that arrived with a file is the note for that file.
        return Result.Parsed(items = items, prefilledNote = text ?: subject)
    }

    private fun collectUris(intent: Intent): List<Uri> {
        val uris = LinkedHashSet<Uri>()

        intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris += it }

        @Suppress("DEPRECATION")
        intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris += it }

        intent.clipData?.let { clip ->
            for (index in 0 until clip.itemCount) {
                uris += clip.getItemAt(index).uri
            }
        }

        return uris.toList()
    }

    private fun displayNameOf(resolver: ContentResolver, uri: Uri): String {
        runCatching {
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        if (index >= 0) {
                            cursor.getString(index)?.takeIf { it.isNotBlank() }?.let { return it }
                        }
                    }
                }
        }
        return uri.lastPathSegment?.substringAfterLast('/') ?: "file"
    }

    private fun resolveMimeType(resolver: ContentResolver, uri: Uri, fallback: String?): String? =
        runCatching { resolver.getType(uri) }.getOrNull() ?: fallback

    private fun sizeOf(resolver: ContentResolver, uri: Uri): Long? = runCatching {
        resolver.openFileDescriptor(uri, "r")?.use { it.statSize }?.takeIf { size -> size >= 0 }
    }.getOrNull()
}
