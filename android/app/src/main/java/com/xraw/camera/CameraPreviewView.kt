package com.xraw.camera

import android.content.Context
import android.graphics.SurfaceTexture
import android.util.AttributeSet
import android.view.Surface
import android.view.TextureView
import android.util.Log

/**
 * Native camera preview view using TextureView.
 * This provides a Surface that Camera2 can render to directly.
 * The React frontend overlays controls on top of this view.
 */
class CameraPreviewView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : TextureView(context, attrs, defStyleAttr), TextureView.SurfaceTextureListener {

    companion object {
        const val TAG = "CameraPreview"
    }

    private var surfaceTexture: SurfaceTexture? = null
    private var surface: Surface? = null
    private var isSurfaceAvailable = false
    private var onSurfaceReady: ((Surface) -> Unit)? = null
    private var onSurfaceDestroyed: (() -> Unit)? = null

    init {
        surfaceTextureListener = this
    }

    /**
     * Set callback for when the surface is ready for camera output.
     */
    fun setOnSurfaceReadyListener(listener: ((Surface) -> Unit)?) {
        onSurfaceReady = listener
        // If surface is already available, notify immediately
        if (isSurfaceAvailable && surface != null && listener != null) {
            listener(surface!!)
        }
    }

    /**
     * Set callback for when the surface is destroyed.
     */
    fun setOnSurfaceDestroyedListener(listener: () -> Unit) {
        onSurfaceDestroyed = listener
    }

    /**
     * Get the current surface for camera output.
     */
    fun getPreviewSurface(): Surface? = surface

    /**
     * Check if the surface is ready for camera output.
     */
    fun isSurfaceReady(): Boolean = isSurfaceAvailable && surface != null

    /**
     * Set the buffer size for the SurfaceTexture.
     * This should be called before the surface is used by the camera.
     */
    fun setBufferSize(width: Int, height: Int) {
        surfaceTexture?.setDefaultBufferSize(width, height)
    }

    override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        Log.i(TAG, "Surface texture available: ${width}x${height}")
        this.surfaceTexture = surfaceTexture
        this.surface = Surface(surfaceTexture)
        this.isSurfaceAvailable = true
        onSurfaceReady?.invoke(surface!!)
    }

    override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        Log.i(TAG, "Surface texture size changed: ${width}x${height}")
    }

    override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
        Log.i(TAG, "Surface texture destroyed")
        // Release the surface when the texture is destroyed
        surface?.release()
        surface = null
        this.surfaceTexture = null
        this.isSurfaceAvailable = false
        onSurfaceDestroyed?.invoke()
        return true // Return true to release the SurfaceTexture
    }

    override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) {
        // Called every time the SurfaceTexture is updated
    }

    /**
     * Release resources when the view is detached.
     */
    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        surface?.release()
        surface = null
        surfaceTexture = null
        isSurfaceAvailable = false
    }
}
