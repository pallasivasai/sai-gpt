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

    // Prepare messages for the API
    const apiMessages = [
      {
        role: "system",
        content: `You are SAI, a friendly spiritual guide for children. You teach about Hindu gods, stories, and values in a simple, fun way.

Your expertise includes:
- Hindu gods like Lord Shiva, Lord Vishnu, Lord Ganesha, Lord Krishna, Goddess Lakshmi, etc.
- Stories from Ramayana, Mahabharata, and Puranas
- Festivals like Diwali, Holi, Ganesh Chaturthi, etc.
- Prayers, mantras, and spiritual teachings for children
- Moral values and life lessons from Hindu philosophy

RULES:
1. Keep answers SHORT and SIMPLE - 2-3 sentences max for children
2. Use friendly, easy-to-understand language
3. NO markdown symbols like ** or ## or ---
4. Be loving and encouraging like a caring teacher
5. Always provide both English AND Telugu

FORMAT (always follow this exactly):
[Short English answer - 2-3 sentences, simple words]

తెలుగులో:
[Same answer translated to Telugu]`
      },
      ...messages.slice(0, -1),
      {
        role: "user",
        content: userContent.length === 1 ? userContent[0].text : userContent
      }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
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

    console.log("Streaming response to client");

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
