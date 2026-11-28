"use client";

import { useState, useRef, useEffect } from "react";

interface AIPetButtonProps {
  organizationId?: string;
}

export function AIPetButton({ organizationId }: AIPetButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "Olá! Sou seu assistente RSBUILD. Como posso ajudar você hoje?" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsTyping(true);

    // Placeholder for AI integration
    // TODO: Integrate with OpenAI/Anthropic API
    setTimeout(() => {
      const responses = [
        "Entendi sua pergunta! Posso ajudar com isso.",
        "Ótima pergunta. Vou verificar no sistema.",
        "Isso faz parte do módulo financeiro. Quer que eu explique mais?",
        "Você pode encontrar essa opção no menu lateral.",
        "Estou aqui para ajudar! O que mais você precisa saber?"
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setMessages(prev => [...prev, { role: "assistant", content: randomResponse }]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Pet Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="ai-pet-button"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #B5583C 0%, #E8A87C 100%)",
            border: "3px solid var(--surface)",
            boxShadow: "0 8px 24px rgba(181, 88, 60, 0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            zIndex: 1000,
            transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            animation: "float 3s ease-in-out infinite"
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1) rotate(10deg)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1) rotate(0deg)"}
          title="Assistente RSBUILD"
        >
          🤖
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className="ai-pet-chat"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "380px",
            maxHeight: "500px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            boxShadow: "0 12px 48px rgba(0,0,0,0.2)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px",
              background: "linear-gradient(135deg, #B5583C 0%, #E8A87C 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "24px" }}>🤖</span>
              <div>
                <strong style={{ color: "white", fontSize: "14px" }}>Assistente RSBUILD</strong>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "11px" }}>
                  {isTyping ? "Digitando..." : "Online"}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "white",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px"
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: "16px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "var(--bg)"
            }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  gap: "8px"
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: msg.role === "user" ? "var(--line)" : "linear-gradient(135deg, #B5583C 0%, #E8A87C 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    flexShrink: 0
                  }}
                >
                  {msg.role === "user" ? "👤" : "🤖"}
                </div>
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    background: msg.role === "user" ? "var(--rsbuild-terracotta-soft, rgba(181, 88, 60, 0.1))" : "var(--surface)",
                    color: "var(--ink)",
                    fontSize: "13px",
                    lineHeight: "1.4"
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: "flex", gap: "8px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #B5583C 0%, #E8A87C 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px"
                  }}
                >
                  🤖
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    background: "var(--surface)",
                    color: "var(--muted)",
                    fontSize: "13px"
                  }}
                >
                  <span style={{ animation: "pulse 1.5s infinite" }}>...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "12px",
              background: "var(--surface)",
              borderTop: "1px solid var(--line)",
              display: "flex",
              gap: "8px"
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "20px",
                border: "1px solid var(--line)",
                background: "var(--bg)",
                color: "var(--ink)",
                fontSize: "13px",
                outline: "none"
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #B5583C 0%, #E8A87C 100%)",
                border: "none",
                color: "white",
                cursor: input.trim() && !isTyping ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                opacity: input.trim() && !isTyping ? 1 : 0.5
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
