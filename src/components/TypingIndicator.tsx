import { Bot } from "lucide-react";

const TypingIndicator = () => {
  return (
    <div className="flex gap-4 animate-fade-in">
      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-secondary border border-border">
        <Bot className="w-5 h-5 text-primary" />
      </div>
      
      <div className="gradient-message-ai border border-border rounded-2xl px-5 py-4 shadow-card">
        <div className="flex gap-1.5">
          <span 
            className="w-2 h-2 rounded-full bg-primary animate-typing"
            style={{ animationDelay: "0ms" }}
          />
          <span 
            className="w-2 h-2 rounded-full bg-primary animate-typing"
            style={{ animationDelay: "150ms" }}
          />
          <span 
            className="w-2 h-2 rounded-full bg-primary animate-typing"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
