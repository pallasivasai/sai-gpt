import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sai-chat`;

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, imageBase64?: string) => {
    if (!content.trim() && !imageBase64) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content || "What's in this image?",
      imageUrl: imageBase64,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Prepare messages for API
    const apiMessages = [...messages, userMessage].map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: apiMessages,
          imageBase64: imageBase64,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Create assistant message
      const assistantMessageId = (Date.now() + 1).toString();
      let assistantContent = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: assistantContent }
                    : msg
                )
              );
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Auto-speak the Telugu part after response is complete
      if (assistantContent) {
        speakTelugu(assistantContent);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      console.error("Chat error:", error);
      toast.error((error as Error).message || "Failed to get response");
      
      // Remove empty assistant message on error
      setMessages((prev) => prev.filter((msg) => msg.content !== ""));
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const speakTelugu = (text: string) => {
    // Extract Telugu portion
    const teluguMarker = "తెలుగులో";
    const markerIndex = text.indexOf(teluguMarker);
    
    let teluguText = text;
    if (markerIndex !== -1) {
      teluguText = text.substring(markerIndex)
        .replace(/\*\*/g, '')
        .replace(/---/g, '')
        .replace(/─+/g, '')
        .replace(/\(In Telugu\):/g, '')
        .trim();
    }

    if ('speechSynthesis' in window && teluguText) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Wait for voices to load
      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(teluguText);
        utterance.lang = 'te-IN';
        utterance.rate = 0.85;
        utterance.pitch = 1.1;
        utterance.volume = 1;

        // Find Telugu voice if available
        const voices = window.speechSynthesis.getVoices();
        const teluguVoice = voices.find(voice => 
          voice.lang.includes('te') || voice.name.toLowerCase().includes('telugu')
        );
        
        if (teluguVoice) {
          utterance.voice = teluguVoice;
        }

        window.speechSynthesis.speak(utterance);
      };

      // Voices may not be loaded yet
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = speak;
      } else {
        speak();
      }
    }
  };

  const clearMessages = useCallback(() => {
    setMessages([]);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    window.speechSynthesis.cancel();
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    speakTelugu,
  };
};
