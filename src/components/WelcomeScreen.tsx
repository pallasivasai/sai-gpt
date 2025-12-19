import { Bot, MessageSquare, Mic, Image } from "lucide-react";

const WelcomeScreen = () => {
  const features = [
    {
      icon: MessageSquare,
      title: "Text Chat",
      description: "Ask anything with text",
    },
    {
      icon: Mic,
      title: "Voice Input",
      description: "Speak in Telugu or English",
    },
    {
      icon: Image,
      title: "Image Analysis",
      description: "Upload images for analysis",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-6">
        <Bot className="w-10 h-10 text-primary-foreground" />
      </div>
      
      <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
        SAI-GPT
      </h1>
      
      <p className="text-lg text-muted-foreground mb-2">
        by Devoote
      </p>
      
      <p className="text-muted-foreground mb-8 max-w-md">
        Your dedicated AI assistant for all Devoote-related questions. 
        Ask about our services, products, and solutions.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
        {features.map((feature) => (
          <div 
            key={feature.title}
            className="bg-card border border-border rounded-xl p-5 shadow-card hover:border-primary/50 transition-colors"
          >
            <feature.icon className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-1">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
      
      <p className="text-sm text-muted-foreground mt-8">
        🔊 All responses are read out in Telugu
      </p>
    </div>
  );
};

export default WelcomeScreen;
