# Keep the serializable DTOs and Room entities intact.
-keepclassmembers class ** {
    @kotlinx.serialization.Serializable <fields>;
}
-keep,includedescriptorclasses class com.localsavedmessages.app.**$$serializer { *; }

# Room generates implementations reflectively referenced by name.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-dontwarn androidx.room.paging.**
