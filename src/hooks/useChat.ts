import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sai-chat`;

// Queue for line-by-line speech
class SpeechQueue {
  private queue: string[] = [];
  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  private getVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    // Prefer female Telugu voice
    const femaleTeluguVoice = voices.find(v => 
      (v.lang.includes('te') || v.name.toLowerCase().includes('telugu')) &&
      (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman'))
    );
    const teluguVoice = voices.find(v => 
      v.lang.includes('te') || v.name.toLowerCase().includes('telugu')
    );
    const hindiVoice = voices.find(v => 
      v.lang.includes('hi') && v.name.toLowerCase().includes('female')
    );
    return femaleTeluguVoice || teluguVoice || hindiVoice || null;
  }

  add(line: string) {
    const cleanLine = line
      .replace(/\*\*/g, '')
      .replace(/##/g, '')
      .replace(/---/g, '')
      .replace(/─+/g, '')
      .trim();
    
    if (cleanLine.length > 2) {
      this.queue.push(cleanLine);
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.isSpeaking || this.queue.length === 0) return;
    if (!('speechSynthesis' in window)) return;

    const line = this.queue.shift()!;
    this.isSpeaking = true;

    const utterance = new SpeechSynthesisUtterance(line);
    this.currentUtterance = utterance;
    
    const voice = this.getVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'te-IN';
    }

    utterance.rate = 0.85;
    utterance.pitch = 1.15;
    utterance.volume = 1;

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.processQueue();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.processQueue();
    };

    window.speechSynthesis.speak(utterance);
  }

  cancel() {
    this.queue = [];
    this.isSpeaking = false;
    window.speechSynthesis.cancel();
    this.currentUtterance = null;
  }
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const speechQueueRef = useRef<SpeechQueue>(new SpeechQueue());
  const spokenLinesRef = useRef<Set<string>>(new Set());

  const sendMessage = useCallback(async (content: string, imageBase64?: string) => {
    if (!content.trim() && !imageBase64) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content || "ఈ చిత్రంలో ఏముంది?",
      imageUrl: imageBase64,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Reset speech state
    speechQueueRef.current.cancel();
    spokenLinesRef.current.clear();

    // Load voices early
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }

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
      let pendingLine = "";
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
              pendingLine += delta;

              // Update the assistant message with new content
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: assistantContent }
                    : msg
                )
              );

              // Check for complete sentences to speak
              const sentenceEnders = /([.!?।॥\n])/;
              const match = pendingLine.match(sentenceEnders);
              if (match && match.index !== undefined) {
                const completeSentence = pendingLine.slice(0, match.index + 1);
                pendingLine = pendingLine.slice(match.index + 1);
                
                // Speak only if not already spoken
                if (!spokenLinesRef.current.has(completeSentence)) {
                  spokenLinesRef.current.add(completeSentence);
                  speechQueueRef.current.add(completeSentence);
                }
              }
            }
          } catch {
            // Incomplete JSON, put it back and wait for more data
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush - speak any remaining text
      if (pendingLine.trim()) {
        if (!spokenLinesRef.current.has(pendingLine)) {
          speechQueueRef.current.add(pendingLine);
        }
      }

      // Process any remaining buffer
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
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      console.error("Chat error:", error);
      toast.error((error as Error).message || "సమాధానం పొందడంలో విఫలమైంది");
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const speakResponse = (text: string) => {
    speechQueueRef.current.cancel();
    spokenLinesRef.current.clear();
    
    // Split into sentences and speak
    const sentences = text.split(/([.!?।॥\n])/);
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '');
      if (sentence.trim()) {
        speechQueueRef.current.add(sentence);
      }
    }
  };

  const clearMessages = useCallback(() => {
    setMessages([]);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    speechQueueRef.current.cancel();
    spokenLinesRef.current.clear();
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    speakResponse,
  };
};
