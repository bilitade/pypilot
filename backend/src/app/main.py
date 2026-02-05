"""Main FastAPI application entry point."""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.config import create_app, setup_routes

# Create and configure app
app = create_app()

# Setup routes
setup_routes(app)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
