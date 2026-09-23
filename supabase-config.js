// ==============================================
// supabase-config.js v2
// ==============================================
// تهيئة اتصال Supabase
// ==============================================

(function () {
    'use strict';
    if (window.__supabaseConfigV2) return;
    window.__supabaseConfigV2 = true;

    var URL = 'https://nistuixdtmuqketweiig.supabase.co';
    var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pc3R1aXhkdG11cWtldHdlaWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMzU1NzMsImV4cCI6MjEwNTcxMTU3M30.T9-YuNZ9IlxzPN07jpntC2Hq2BC_5lYvSD7X3QXIa4s';

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
    console.log('✅ Supabase client created (v2 with anon key)');
})();
