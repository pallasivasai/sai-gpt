import { useState, useRef } from "react";
import { Send, Mic, MicOff, Image, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatInputProps {
  onSend: (message: string, imageBase64?: string) => void;
  isLoading: boolean;
}

const ChatInput = ({ onSend, isLoading }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const handleSubmit = () => {
    if (message.trim() || imagePreview) {
      onSend(message.trim(), imagePreview || undefined);
      setMessage("");
      setImagePreview(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Voice input is not supported in your browser");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'te-IN'; // Telugu language

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("Listening... Speak now");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setMessage(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'no-speech') {
        toast.error("No speech detected. Please try again.");
      } else {
        toast.error("Voice input error. Please try again.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-4 border-t border-border/30 bg-card/80 backdrop-blur-md">
      {imagePreview && (
        <div className="mb-3 relative inline-block animate-fade-in">
          <img 
            src={imagePreview} 
            alt="Preview" 
            className="h-20 w-auto rounded-lg border border-border"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
            onClick={removeImage}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      
      <div className="flex items-end gap-3">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          className="text-muted-foreground hover:text-primary shrink-0"
          disabled={isLoading}
        >
          <Image className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleVoiceInput}
          className={cn(
            "shrink-0 transition-all",
            isListening 
              ? "text-destructive animate-pulse-glow" 
              : "text-muted-foreground hover:text-primary"
          )}
          disabled={isLoading}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        <div className="flex-1 relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message or use voice input..."
            className="min-h-[52px] max-h-32 resize-none bg-secondary border-border focus:ring-primary pr-12"
            disabled={isLoading}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isLoading || (!message.trim() && !imagePreview)}
          className="gradient-primary text-primary-foreground shadow-button hover:opacity-90 transition-opacity shrink-0 h-[52px] w-[52px]"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground text-center mt-3">
        SAI-GPT by Devoote • Supports Telugu voice input & output
      </p>
    </div>
  );
};

export default ChatInput;
