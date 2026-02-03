#!/usr/bin/env python3
"""
Simple script to start the PyVibe server
"""
import os
import sys
import subprocess
from pathlib import Path

def main():
    # Change to the project directory
    project_dir = Path(__file__).parent
    os.chdir(project_dir)
    
    # Install dependencies using uv from system
    print("🔧 Installing dependencies...")
    try:
        subprocess.run(["uv", "sync"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        print("💡 Make sure uv is installed: pip install uv")
        sys.exit(1)
    
    # Start the server using uv run
    print("🚀 Starting PyVibe server on http://localhost:8000")
    print("📝 API Documentation: http://localhost:8000/docs")
    print("🛑 Press Ctrl+C to stop the server")
    print("-" * 50)
    
    try:
        subprocess.run(["uv", "run", "python", "src/server.py"])
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
