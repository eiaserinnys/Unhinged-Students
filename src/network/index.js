// Network Module - Entry Point
// This file is loaded last in index.html to ensure all dependencies are available

// All classes are already exported to window by their respective files:
// - window.ReconnectUI (from ReconnectUI.js)
// - window.RemotePlayer (from RemotePlayer.js)
// - window.NetworkManager (from NetworkManager.js)
// - window.LaserEffectMixin (from effects/laser.js)
// - window.TeleportEffectMixin (from effects/teleport.js)
// - window.TelepathyEffectMixin (from effects/teleport.js)

// Verify all components are loaded
(function() {
    const requiredComponents = [
        'ReconnectUI',
        'RemotePlayer',
        'NetworkManager',
        'LaserEffectMixin',
        'TeleportEffectMixin',
        'TelepathyEffectMixin'
    ];

    const missing = requiredComponents.filter(name => !window[name]);

    if (missing.length > 0) {
        console.error('[Network] Missing components:', missing.join(', '));
    } else {
        console.log('[Network] All components loaded successfully');
    }
})();
