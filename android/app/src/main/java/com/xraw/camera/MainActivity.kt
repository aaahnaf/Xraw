package com.xraw.camera

import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.widget.FrameLayout
import com.getcapacitor.BridgeActivity
import com.getcapacitor.Plugin

/**
 * XRAW Camera - Main Activity
 * 
 * Extends Capacitor BridgeActivity to load the web frontend.
 * The CameraPreviewView is added programmatically behind the WebView.
 * The WebView background is made transparent so the camera preview shows through.
 */
class MainActivity : BridgeActivity() {
    
    private var cameraPreviewView: CameraPreviewView? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // BridgeActivity creates its own WebView internally
        // We add the camera preview behind it programmatically
        setupCameraPreview()
    }
    
    override fun registerPlugins() {
        // Explicitly register the XRawCamera plugin
        // This ensures the plugin is available to the web frontend
        bridge?.addPlugin(XRawCameraPlugin::class.java)
    }
    
    private fun setupCameraPreview() {
        // Get the root view (BridgeActivity uses a FrameLayout as root)
        val rootView = findViewById<ViewGroup>(android.R.id.content)
        
        // Create camera preview view
        cameraPreviewView = CameraPreviewView(this).apply {
            id = R.id.camera_preview
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        
        // Add preview at the bottom of the view hierarchy (behind WebView)
        rootView.addView(cameraPreviewView, 0)
        
        // Make WebView transparent so preview shows through
        // BridgeActivity's WebView is added after onCreate, so we need to find it later
        rootView.post {
            // Find the WebView (it's the last child added by BridgeActivity)
            for (i in 0 until rootView.childCount) {
                val child = rootView.getChildAt(i)
                if (child is com.getcapacitor.CapacitorWebView) {
                    child.setBackgroundColor(Color.TRANSPARENT)
                    break
                }
            }
        }
    }
    
    /**
     * Get the camera preview view for the plugin to use
     */
    fun getCameraPreviewView(): CameraPreviewView? = cameraPreviewView
    
    override fun onPause() {
        super.onPause()
        // Camera lifecycle is managed by the plugin
    }
    
    override fun onResume() {
        super.onResume()
    }
    
    override fun onDestroy() {
        cameraPreviewView = null
        super.onDestroy()
    }
}
