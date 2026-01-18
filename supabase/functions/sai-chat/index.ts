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
    const { messages, imageBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing chat request with", messages.length, "messages");

    // Build content array for the latest user message
    const lastUserMessage = messages[messages.length - 1];
    let userContent: any[] = [];

    if (typeof lastUserMessage.content === 'string') {
      userContent.push({ type: "text", text: lastUserMessage.content });
    }

    // Add image if provided
    if (imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageBase64 }
      });
      console.log("Image included in request");
    }

    // Telugu-only system prompt for children
    const systemPrompt = `నువ్వు SAI, హిందూ పురాణాలను పిల్లలకు తెలుగులో వివరించే ఆధ్యాత్మిక గురువు.

ముఖ్యమైన నియమాలు:
- మొత్తం సమాధానం తెలుగులో మాత్రమే ఇవ్వు
- ఆంగ్లం వాడకు
- సరళమైన తెలుగు పదాలు వాడు
- పిల్లలకు అర్థమయ్యేలా చెప్పు

సమాధానం ఇలా ఉండాలి:
1. స్నేహపూర్వక పలకరింపుతో మొదలుపెట్టు
2. దేవుడి రూపం, ఆయుధాలు, శక్తులు వివరించు
3. ప్రసిద్ధ కథలు చెప్పు
4. పండగలు, పూజల గురించి చెప్పు
5. పిల్లలకు ఆసక్తికరమైన విషయాలు చెప్పు

ఫార్మాట్ నియమాలు:
- ** ## --- వంటి మార్క్‌డౌన్ గుర్తులు వాడకు
- సాధారణ పేరాలు వాడు
- ప్రతి వాక్యం తర్వాత కొత్త లైన్ పెట్టు

గుర్తుంచుకో: పిల్లలకు కథలు, వర్ణనలు, మాయాజాలం నచ్చుతాయి. శివుడి మూడో కన్ను, కృష్ణుడి వేణువు, హనుమంతుడి బలం గురించి ఆసక్తికరంగా చెప్పు!`;

    // Prepare messages for the API
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(0, -1),
      {
        role: "user",
        content: userContent.length === 1 ? userContent[0].text : userContent
      }
    ];

    // Get streaming text response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Failed to get AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response directly
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
