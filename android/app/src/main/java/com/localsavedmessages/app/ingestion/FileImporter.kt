package com.localsavedmessages.app.ingestion

import android.content.Context
import android.net.Uri
import android.os.StatFs
import com.localsavedmessages.app.core.AppResult
import com.localsavedmessages.app.core.Reason
import com.localsavedmessages.app.data.files.FileStore
import com.localsavedmessages.app.domain.validation.FileLimits
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

/**
 * Copies a shared file into the app's own storage.
 *
 * The copy is not optional and cannot be deferred. A `content://` URI handed
 * to the app by a share intent carries a **temporary, per-URI grant** that
 * lasts only for the receiving activity's lifetime. Storing the URI and
 * opening it later fails with a `SecurityException` — and Telegram evicts its
 * own media cache aggressively on top of that.
 *
 * So the bytes are captured now, while the grant is still valid.
 */
class FileImporter(
    private val context: Context,
    private val fileStore: FileStore,
    private val dispatcher: CoroutineDispatcher,
) {

    /**
     * A file that has been copied into the staging area, ready to be promoted
     * into the permanent store once the user confirms.
     */
    data class Staged(
        val stagedFile: File,
        val displayName: String,
        val mimeType: String?,
        val sizeBytes: Long,
        val extension: String,
    )

    /**
     * Copies one shared file into `cache/inbox/<sessionId>/`.
     *
     * @param onProgress receives the bytes written so far and the expected
     *        total, which is null when the provider does not report a size.
     */
    suspend fun stage(
        item: InboxItem.FileItem,
        sessionId: String,
        onProgress: (written: Long, total: Long?) -> Unit,
    ): AppResult<Staged> = withContext(dispatcher) {
        val extension = com.localsavedmessages.app.domain.validation.FileTypes.extensionFor(
            mimeType = item.mimeType,
            sourceName = item.displayName,
        )

        val target = fileStore.stagedFile(sessionId, "staged$extension")

        try {
            val expected = item.sizeBytes
            if (expected != null && expected > FileLimits.MAX_FILE_BYTES) {
                return@withContext AppResult.Failure(
                    Reason.FileTooLarge(FileLimits.MAX_FILE_BYTES),
                )
            }

            ensureFreeSpace(expected ?: 0L)

            val written = copyStream(item.uri, target, expected, onProgress)

            if (written == 0L) {
                target.delete()
                return@withContext AppResult.Failure(Reason.SourceUnavailable)
            }

            AppResult.Success(
                Staged(
                    stagedFile = target,
                    displayName = item.displayName,
                    mimeType = item.mimeType,
                    sizeBytes = written,
                    extension = extension,
                ),
            )
        } catch (e: FileTooLargeException) {
            target.delete()
            AppResult.Failure(Reason.FileTooLarge(FileLimits.MAX_FILE_BYTES))
        } catch (e: StorageFullException) {
            target.delete()
            AppResult.Failure(Reason.StorageFull)
        } catch (e: SecurityException) {
            target.delete()
            AppResult.Failure(Reason.SourceUnavailable)
        } catch (e: IOException) {
            target.delete()
            AppResult.Failure(Reason.SourceUnavailable)
        }
    }

    /**
     * Streams the content provider into the target file.
     *
     * The 64 KB buffer keeps memory flat regardless of file size, and the
     * size ceiling is enforced *during* the copy — a content provider can
     * report a size that does not match the stream, so the pre-check alone
     * is not enough.
     */
    private fun copyStream(
        uri: Uri,
        target: File,
        expected: Long?,
        onProgress: (Long, Long?) -> Unit,
    ): Long {
        val resolver = context.contentResolver
        val input = resolver.openInputStream(uri) ?: throw IOException("cannot open $uri")

        var total = 0L
        input.use { source ->
            FileOutputStream(target).use { output ->
                val buffer = ByteArray(BUFFER_SIZE)
                while (true) {
                    val read = source.read(buffer)
                    if (read == -1) break
                    output.write(buffer, 0, read)
                    total += read
                    if (total > FileLimits.MAX_FILE_BYTES) throw FileTooLargeException()
                    onProgress(total, expected)
                }
                output.fd.sync()
            }
        }
        return total
    }

    private fun ensureFreeSpace(expected: Long) {
        val stat = StatFs(context.filesDir.absolutePath)
        val free = stat.availableBlocksLong * stat.blockSizeLong
        if (free - expected < FileLimits.MIN_FREE_BYTES) {
            throw StorageFullException()
        }
    }

    private class FileTooLargeException : IOException("file exceeds the size ceiling")

    private class StorageFullException : IOException("not enough free space")

    companion object {
        private const val BUFFER_SIZE = 64 * 1024
    }
}
