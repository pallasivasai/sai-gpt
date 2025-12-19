import { Bot, User, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  onSpeak?: (text: string) => void;
  isSpeaking?: boolean;
}

const ChatMessage = ({ role, content, imageUrl, onSpeak, isSpeaking }: ChatMessageProps) => {
  const isUser = role === "user";

  const extractTeluguText = (text: string): string => {
    const teluguMarker = "తెలుగులో";
    const markerIndex = text.indexOf(teluguMarker);
    
    if (markerIndex !== -1) {
      return text.substring(markerIndex).replace(/\*\*/g, '').replace(/---/g, '').trim();
    }
    return text;
  };

  const handleSpeak = () => {
    if (onSpeak && !isUser) {
      const teluguText = extractTeluguText(content);
      onSpeak(teluguText);
    }
  };

  return (
    <div className={cn(
      "flex gap-4 animate-fade-in",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
        isUser 
          ? "gradient-primary shadow-button" 
          : "bg-secondary border border-border"
      )}>
        {isUser ? (
          <User className="w-5 h-5 text-primary-foreground" />
        ) : (
          <Bot className="w-5 h-5 text-primary" />
        )}
      </div>
      
      <div className={cn(
        "flex-1 max-w-[80%] rounded-2xl px-5 py-4 shadow-card",
        isUser 
          ? "gradient-message-user text-foreground" 
          : "gradient-message-ai border border-border"
      )}>
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt="Uploaded" 
            className="max-w-full h-auto rounded-lg mb-3 max-h-48 object-cover"
          />
        )}
        <div className="max-w-none">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed m-0 text-foreground">
            {content.replace(/\*\*/g, '').replace(/##/g, '').replace(/---/g, '─────────────────')}
          </p>
        </div>
        
        {!isUser && content && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSpeak}
              className={cn(
                "text-muted-foreground hover:text-primary transition-colors",
                isSpeaking && "text-primary animate-pulse-glow"
              )}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="w-4 h-4 mr-2" />
                  Stop Speaking
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-2" />
                  Read in Telugu
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
