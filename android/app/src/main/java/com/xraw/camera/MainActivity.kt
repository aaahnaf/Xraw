package com.xraw.camera

import android.os.Bundle
import com.getcapacitor.BridgeActivity

/**
 * XRAW Camera - Main Activity
 * 
 * Extends Capacitor BridgeActivity to load the web frontend.
 * Uses a custom layout with native CameraPreviewView for camera imagery
 * and CapacitorWebView overlay for React UI controls.
 */
class MainActivity : BridgeActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        // Capacitor 5 auto-registers plugins annotated with @CapacitorPlugin
    }
    
    override fun onPause() {
        super.onPause()
        // Camera lifecycle is managed by the plugin
    }
    
    override fun onResume() {
        super.onResume()
    }
    
    override fun onDestroy() {
        super.onDestroy()
    }
}
