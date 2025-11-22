#!/usr/bin/env python3
"""
Test the vLLM API with email screenshots.
Uses OpenAI-compatible API with base64-encoded images.
"""

import base64
import requests
import sys
from pathlib import Path

def encode_image(image_path):
    """Encode image to base64 string"""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def analyze_email_via_api(image_path, api_url="http://localhost:8001/v1/chat/completions"):
    """Send email screenshot to vLLM API for analysis"""

    print("=" * 70)
    print("Testing Qwen2-VL Email Analyzer API")
    print("=" * 70)
    print()
    print(f"Image: {image_path}")
    print(f"API: {api_url}")
    print()

    # Encode image
    print("Encoding image...")
    image_b64 = encode_image(image_path)

    # System prompt (from training data)
    system_prompt = """You are an expert email marketing analyst specializing in retail e-commerce campaigns.
Analyze the email screenshot provided and give detailed, actionable feedback following this structure:

**LIFECYCLE CONTEXT:** Identify the campaign stage (Welcome, Abandoned Cart, Re-engagement, etc.) and relevant industry benchmarks.
**SUBJECT (X/10):** Score and analyze the subject line effectiveness.
**BODY (X/10):** Score and analyze the email body content and messaging.
**CTA (X/10):** Score and analyze the call-to-action placement and effectiveness.
**TECHNICAL/GDPR (X/10):** Score technical implementation and compliance.
**CONVERSION IMPACT:** Estimate conversion rate improvements with specific metrics.
**ACTIONS:** Provide numbered, specific recommendations with quantified impact.
**TRANSFERABLE LESSONS:** Extract behavioral psychology principles that apply across campaigns.

Base your analysis on visual elements, design choices, and overall email effectiveness."""

    user_prompt = "Analyze this email marketing campaign screenshot and provide detailed feedback following the structure specified in the system prompt."

    # Create API request
    payload = {
        "model": "qwen2vl-email-analyzer",
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_b64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": user_prompt
                    }
                ]
            }
        ],
        "max_tokens": 2048,
        "temperature": 0.7
    }

    print("Sending request to API...")
    print()

    try:
        response = requests.post(api_url, json=payload, timeout=120)
        response.raise_for_status()

        result = response.json()
        analysis = result["choices"][0]["message"]["content"]

        print("=" * 70)
        print("Analysis Results")
        print("=" * 70)
        print()
        print(analysis)
        print()
        print("=" * 70)
        print("API Test Complete")
        print("=" * 70)

        return analysis

    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to API")
        print("Make sure vLLM server is running:")
        print("  ./start_vision_api.sh")
        print()
        sys.exit(1)

    except requests.exceptions.Timeout:
        print("ERROR: Request timed out")
        print("The model may be loading or processing a large image")
        print()
        sys.exit(1)

    except Exception as e:
        print(f"ERROR: {e}")
        print()
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 test_vision_api.py <path_to_email_image>")
        print()
        print("Example:")
        print("  python3 test_vision_api.py ../email_images/email_001.png")
        print()
        sys.exit(1)

    image_path = Path(sys.argv[1])

    if not image_path.exists():
        print(f"ERROR: Image not found: {image_path}")
        sys.exit(1)

    analyze_email_via_api(image_path)

if __name__ == "__main__":
    main()
