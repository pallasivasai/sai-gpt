import { useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";
import WelcomeScreen from "@/components/WelcomeScreen";
import { useChat } from "@/hooks/useChat";
import { useSpeech } from "@/hooks/useSpeech";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import divineBackground from "@/assets/divine-background.jpg";

const Index = () => {
  const { messages, isLoading, sendMessage, clearMessages } = useChat();
  const { speak, isSpeaking } = useSpeech();
  const { playSound } = useSoundEffects();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    // Play receive sound when new assistant message arrives
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'assistant' && lastMessage.content) {
        playSound('receive');
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, playSound]);

  // Play pop when loading finishes
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      playSound('pop');
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, playSound]);

  const handleSend = (content: string, imageBase64?: string) => {
    playSound('send');
    sendMessage(content, imageBase64);
  };

  return (
    <div 
      className="flex flex-col h-screen max-h-screen overflow-hidden"
      style={{
        backgroundImage: `url(${divineBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/30 bg-card/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-button">
            <span className="text-xl font-bold text-primary-foreground">S</span>
          </div>
          <div>
            <h1 className="font-bold text-lg">SAI-GPT</h1>
            <p className="text-xs text-muted-foreground">by Devoote</p>
          </div>
        </div>
        
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Chat
          </Button>
        )}
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <WelcomeScreen />
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  imageUrl={message.imageUrl}
                  onSpeak={speak}
                  isSpeaking={isSpeaking}
                />
              ))}
              {isLoading && <TypingIndicator />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
};

export default Index;
