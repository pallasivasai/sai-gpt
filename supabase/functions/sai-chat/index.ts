import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateImage(prompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log("Generating image for:", prompt);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Create a beautiful, colorful, child-friendly illustration of ${prompt}. Make it vibrant, divine, and suitable for children learning about Hindu mythology. Style: animated, warm colors, glowing divine aura.`
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      console.error("Image generation failed:", response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    console.log("Image generated successfully");
    return imageUrl || null;
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
}

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

    // Enhanced system prompt for detailed ChatGPT-like responses
    const systemPrompt = `You are SAI, a wise and loving spiritual teacher who explains Hindu mythology to children in an engaging, detailed way.

RESPONSE STYLE:
- Give DETAILED, RICH explanations like ChatGPT (5-8 paragraphs minimum)
- Include interesting facts, stories, symbols, and meanings
- Use simple words but cover the topic thoroughly
- Make it educational and magical for children
- Include related deities, stories, festivals connected to the topic

STRUCTURE YOUR RESPONSE:
1. Start with a warm greeting and introduction
2. Main explanation with details about appearance, symbols, powers
3. Famous stories or legends
4. Why this deity/concept is important
5. How children can connect (prayers, festivals)
6. Fun facts that children will love

FORMAT RULES:
- NO markdown symbols (no **, ##, ---)
- Use simple paragraphs with line breaks
- After the English explanation, add a separator line "─────────────────"
- Then write "తెలుగులో:" and provide the Telugu translation
- Keep Telugu translation equally detailed

Remember: Children love details, stories, and magical descriptions. Make Lord Shiva's third eye sound fascinating, describe Krishna's flute music beautifully, make Hanuman's strength exciting!`;

    // Prepare messages for the API
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(0, -1),
      {
        role: "user",
        content: userContent.length === 1 ? userContent[0].text : userContent
      }
    ];

    // Start image generation in parallel (don't await here)
    const userQuery = lastUserMessage.content?.toLowerCase() || "";
    let imagePromise: Promise<string | null> | null = null;
    
    // Generate image for deity/mythology questions
    const deityKeywords = ['shiva', 'vishnu', 'brahma', 'krishna', 'rama', 'hanuman', 'ganesha', 'ganesh', 'durga', 'lakshmi', 'saraswati', 'parvati', 'kali', 'murugan', 'kartikeya', 'god', 'goddess', 'lord', 'devi', 'temple', 'festival', 'diwali', 'holi', 'navratri', 'dasara'];
    
    const shouldGenerateImage = deityKeywords.some(keyword => userQuery.includes(keyword));
    
    if (shouldGenerateImage) {
      imagePromise = generateImage(lastUserMessage.content, LOVABLE_API_KEY);
    }

    // Get text response with faster model
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: apiMessages,
        stream: false, // Non-streaming for complete response
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

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    
    // Wait for image if we started generating one
    let imageUrl: string | null = null;
    if (imagePromise) {
      imageUrl = await imagePromise;
    }

    console.log("Response generated, image:", imageUrl ? "yes" : "no");

    // Return complete response with optional image
    return new Response(JSON.stringify({ 
      content: textContent,
      imageUrl: imageUrl
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
