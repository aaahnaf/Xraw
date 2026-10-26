# XRAW Camera ProGuard Rules

# Keep Capacitor plugin classes
-keep class com.xraw.camera.XRawCameraPlugin { *; }
-keep class com.xraw.camera.MainActivity { *; }

# Keep Camera2 API classes
-keep class android.hardware.camera2.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep serialization
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep XRAW format classes
-keep class com.xraw.camera.format.** { *; }

# Keep recording service
-keep class com.xraw.camera.service.RecordingService { *; }
