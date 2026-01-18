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

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      const assistantId = (Date.now() + 1).toString();

      // Add empty assistant message that we'll update
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process line-by-line as data arrives
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
              // Update the assistant message with new content
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: assistantContent }
                    : msg
                )
              );
            }
          } catch {
            // Incomplete JSON, put it back and wait for more data
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: assistantContent }
                    : msg
                )
              );
            }
          } catch { /* ignore */ }
        }
      }

      // Auto-speak the response after streaming completes
      if (assistantContent) {
        setTimeout(() => {
          speakResponse(assistantContent);
        }, 300);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      console.error("Chat error:", error);
      toast.error((error as Error).message || "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const speakResponse = (text: string) => {
    if (!('speechSynthesis' in window) || !text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean the text for reading
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/##/g, '')
      .replace(/---/g, '')
      .replace(/─+/g, '')
      .trim();

    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Try to find a good voice - prefer Telugu, fallback to any available
      const voices = window.speechSynthesis.getVoices();
      const teluguVoice = voices.find(voice => 
        voice.lang.includes('te') || voice.name.toLowerCase().includes('telugu')
      );
      const hindiVoice = voices.find(voice => voice.lang.includes('hi'));
      const defaultVoice = voices.find(voice => voice.lang.includes('en'));
      
      if (teluguVoice) {
        utterance.voice = teluguVoice;
        utterance.lang = 'te-IN';
      } else if (hindiVoice) {
        utterance.voice = hindiVoice;
        utterance.lang = 'hi-IN';
      } else if (defaultVoice) {
        utterance.voice = defaultVoice;
        utterance.lang = 'en-US';
      }

      utterance.rate = 0.8;
      utterance.pitch = 1.1;
      utterance.volume = 1;

      window.speechSynthesis.speak(utterance);
    };

    // Load voices first if needed
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      speak();
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
    speakResponse,
  };
};
