// ==============================================
// supabase-config.js v1
// ==============================================
// تهيئة اتصال Supabase
// ==============================================

(function () {
    'use strict';
    if (window.__supabaseConfigV1) return;
    window.__supabaseConfigV1 = true;

    var URL = 'https://nistuixdtmuqketweiig.supabase.co';
    var KEY = 'sb_publishable_YDl8a4PmVZxLOBsLMYlGOg_vRzUpYYA';

    if (!window.supabase || !window.supabase.createClient) {
        console.error('❌ Supabase SDK missing');
        return;
    }

    window.supabaseClient = window.supabase.createClient(URL, KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });
    console.log('✅ Supabase client created:', URL);
})();
