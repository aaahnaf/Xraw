package com.xraw.camera

import android.os.Bundle
import com.getcapacitor.BridgeActivity

/**
 * XRAW Camera - Main Activity
 * 
 * Extends Capacitor BridgeActivity to load the web frontend
 * and register native plugins for camera access.
 */
class MainActivity : BridgeActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Register XRAW Camera plugin
        registerPlugin(XRawCameraPlugin::class.java)
    }
    
    override fun onPause() {
        super.onPause()
        // Camera lifecycle is managed by the plugin
    }
    
    override fun onResume() {
        super.onResume()
        // Resume camera if needed
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Ensure camera is released
    }
}
