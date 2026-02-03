from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import asyncio
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from react_agent.graph import agentGraph
from react_agent.context import Context

app = FastAPI(title="PyVibe Agent API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your VS Code extension origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"

class ChatResponse(BaseModel):
    response: str
    thread_id: str
    metadata: Dict[str, Any] = {}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat with the PyVibe agent"""
    try:
        # Create a thread config for LangGraph with context
        config = {
            "configurable": {
                "thread_id": request.thread_id
            }
        }
        
        # Create context with default values
        context = Context()
        
        # Invoke the agent with the user message and context using async API
        result = await agentGraph.ainvoke(
            {"messages": [{"role": "user", "content": request.message}]},
            config,
            context=context
        )
        
        # Extract the response from the last message
        if result and "messages" in result and result["messages"]:
            last_message = result["messages"][-1]
            response_text = last_message.content if hasattr(last_message, 'content') else str(last_message)
        else:
            response_text = "I'm sorry, I couldn't process your request."
        
        return ChatResponse(
            response=response_text,
            thread_id=request.thread_id,
            metadata={"status": "success"}
        )
        
    except Exception as e:
        print(f"Error processing chat request: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "PyVibe Agent API"}

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "PyVibe Agent API is running",
        "version": "1.0.0",
        "endpoints": {
            "chat": "/chat",
            "health": "/health"
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
