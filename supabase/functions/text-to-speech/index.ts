import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, language } = await req.json();
    
    if (!text) {
      throw new Error("Text is required");
    }

    console.log("TTS request for language:", language, "text length:", text.length);

    // Extract Telugu portion if present
    let teluguText = text;
    const teluguMarker = "తెలుగులో";
    const markerIndex = text.indexOf(teluguMarker);
    
    if (markerIndex !== -1) {
      // Get text after the Telugu marker
      teluguText = text.substring(markerIndex).replace(/\*\*/g, '').trim();
    }

    // Use Google Cloud TTS API for Telugu
    // For now, we'll use the Web Speech API on client side
    // This endpoint validates and prepares text for TTS
    
    return new Response(JSON.stringify({ 
      success: true,
      text: teluguText,
      language: "te-IN"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("TTS error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
