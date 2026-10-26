package com.xraw.camera

import android.os.Bundle
import com.getcapacitor.BridgeActivity

/**
 * XRAW Camera - Main Activity
 * 
 * Extends Capacitor BridgeActivity to load the web frontend.
 * The XRawCamera plugin is auto-registered by Capacitor 5
 * via the @CapacitorPlugin annotation.
 */
class MainActivity : BridgeActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
