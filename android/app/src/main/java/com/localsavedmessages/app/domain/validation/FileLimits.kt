package com.localsavedmessages.app.domain.validation

/**
 * Size ceilings. The per-file limit matches what Telegram itself allows; the
 * archive ceiling keeps the app from filling a device without the user
 * noticing.
 */
object FileLimits {

    /** Maximum size of a single file: 2 GB. */
    const val MAX_FILE_BYTES = 2L * 1024 * 1024 * 1024

    /** Maximum total size of the archive: 8 GB. */
    const val MAX_ARCHIVE_BYTES = 8L * 1024 * 1024 * 1024

    /** Free space below which a save is refused. */
    const val MIN_FREE_BYTES = 250L * 1024 * 1024

    /** Free space below which the user is warned. */
    const val WARN_FREE_BYTES = 1024L * 1024 * 1024

    /** The maximum length of a note. */
    const val MAX_NOTE_LENGTH = 5_000
}
