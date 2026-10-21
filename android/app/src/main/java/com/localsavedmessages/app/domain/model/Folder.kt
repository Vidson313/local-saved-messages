package com.localsavedmessages.app.domain.model

/**
 * A destination for entries — the equivalent of a "chat" in the web app.
 *
 * [isVault] marks the single folder whose contents are gated behind the
 * device lock. It is a privacy gate, not encryption: the files live in the
 * same app-private storage as everything else.
 */
data class Folder(
    val id: String,
    val name: String,
    val icon: String,
    val colorIndex: Int,
    val isVault: Boolean,
    val isProtected: Boolean,
    val createdAt: Long,
    val updatedAt: Long,
    val entryCount: Int = 0,
    val lastEntryAt: Long? = null,
    val lastEntryPreview: String? = null,
) {
    companion object {
        /** The folder created on first launch. It cannot be deleted. */
        const val DEFAULT_ID = "default"
        const val DEFAULT_NAME = "Saved Messages"
        const val DEFAULT_ICON = "💾"
    }
}
