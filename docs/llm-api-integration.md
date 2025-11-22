# Qwen2-VL Email Analyzer API - Integration Guide

## Overview

The Qwen2-VL Email Analyzer API provides AI-powered analysis of email marketing campaigns using computer vision. Simply send an email screenshot, and receive detailed, actionable feedback with industry benchmarks and conversion impact projections.

**Base URL:** `http://localhost:8001` (update for your deployment)

**API Compatibility:** OpenAI-compatible endpoints

**Model:** Fine-tuned Qwen2-VL-2B specialized in retail email marketing analysis

## Quick Start

### 1. Check API Health

```bash
curl http://localhost:8001/health
```

**Response:**
```json
{
  "status": "healthy"
}
```

### 2. Analyze an Email Screenshot

```bash
./test_curl.sh path/to/email_screenshot.png
```

Or use the Python client (see examples below).

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

---

### GET /v1/models

List available models.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "qwen2vl-email-analyzer",
      "object": "model",
      "created": 0,
      "owned_by": "custom"
    }
  ]
}
```

---

### POST /v1/chat/completions

Analyze email screenshots with AI.

**Request Body:**
```json
{
  "model": "qwen2vl-email-analyzer",
  "messages": [
    {
      "role": "system",
      "content": "You are an expert email marketing analyst specializing in retail e-commerce campaigns."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,<BASE64_ENCODED_IMAGE>"
          }
        },
        {
          "type": "text",
          "text": "Analyze this email marketing campaign."
        }
      ]
    }
  ],
  "max_tokens": 2048,
  "temperature": 0.7
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model identifier: `"qwen2vl-email-analyzer"` |
| `messages` | array | Yes | Array of message objects (system + user) |
| `max_tokens` | integer | No | Maximum tokens in response (default: 2048) |
| `temperature` | float | No | Sampling temperature 0-1 (default: 0.7) |

**Message Content Types:**

For multimodal messages with images:
```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/png;base64,<BASE64_STRING>"
  }
}
```

For text:
```json
{
  "type": "text",
  "text": "Your prompt here"
}
```

**Response:**
```json
{
  "id": "chat-completion",
  "object": "chat.completion",
  "created": 0,
  "model": "qwen2vl-email-analyzer",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "**LIFECYCLE CONTEXT:** ...\n**SUBJECT (7/10):** ...\n..."
      },
      "finish_reason": "stop"
    }
  ]
}
```

## Response Format

The model returns structured analysis in markdown format:

```
**LIFECYCLE CONTEXT:** Campaign stage identification + industry benchmarks
**SUBJECT (X/10):** Score + analysis + specific recommendations with metrics
**BODY (X/10):** Content analysis + actionable improvements with impact
**CTA (X/10):** Call-to-action evaluation + optimization suggestions
**TECHNICAL/GDPR (X/10):** Compliance check + privacy recommendations
**CONVERSION IMPACT:** Baseline → Improved conversion rate projections
**ACTIONS:** Numbered list of specific, implementable recommendations
**TRANSFERABLE LESSONS:** Behavioral psychology principles for future campaigns
```

Each section includes:
- ✓ What's working well
- ✗ Areas for improvement
- → Specific recommendations with quantified impact (e.g., "+15% CTR")

## Code Examples

### Python

```python
import requests
import base64
from typing import Dict, Any

class EmailAnalyzerClient:
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.model = "qwen2vl-email-analyzer"

    def analyze_email(
        self,
        image_path: str,
        custom_prompt: str = None,
        max_tokens: int = 2048,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Analyze an email screenshot.

        Args:
            image_path: Path to email screenshot image
            custom_prompt: Optional custom analysis prompt
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature (0-1)

        Returns:
            Analysis results dictionary
        """
        # Encode image to base64
        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode("utf-8")

        # Default prompt
        prompt = custom_prompt or "Analyze this email marketing campaign screenshot and provide detailed feedback."

        # Prepare request
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert email marketing analyst specializing in retail e-commerce campaigns."
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
                            "text": prompt
                        }
                    ]
                }
            ],
            "max_tokens": max_tokens,
            "temperature": temperature
        }

        # Send request
        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            json=payload,
            timeout=60
        )
        response.raise_for_status()

        return response.json()

    def get_analysis_text(self, response: Dict[str, Any]) -> str:
        """Extract analysis text from API response."""
        return response["choices"][0]["message"]["content"]


# Usage example
if __name__ == "__main__":
    client = EmailAnalyzerClient()

    # Analyze email
    result = client.analyze_email("email_screenshot.png")

    # Get analysis
    analysis = client.get_analysis_text(result)
    print(analysis)
```

### Node.js / JavaScript

```javascript
const axios = require('axios');
const fs = require('fs');

class EmailAnalyzerClient {
  constructor(baseUrl = 'http://localhost:8001') {
    this.baseUrl = baseUrl;
    this.model = 'qwen2vl-email-analyzer';
  }

  async analyzeEmail(imagePath, options = {}) {
    const {
      customPrompt = 'Analyze this email marketing campaign screenshot and provide detailed feedback.',
      maxTokens = 2048,
      temperature = 0.7
    } = options;

    // Read and encode image
    const imageBuffer = fs.readFileSync(imagePath);
    const imageB64 = imageBuffer.toString('base64');

    // Prepare request
    const payload = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert email marketing analyst specializing in retail e-commerce campaigns.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageB64}`
              }
            },
            {
              type: 'text',
              text: customPrompt
            }
          ]
        }
      ],
      max_tokens: maxTokens,
      temperature: temperature
    };

    // Send request
    const response = await axios.post(
      `${this.baseUrl}/v1/chat/completions`,
      payload,
      { timeout: 60000 }
    );

    return response.data;
  }

  getAnalysisText(response) {
    return response.choices[0].message.content;
  }
}

// Usage example
(async () => {
  const client = new EmailAnalyzerClient();

  const result = await client.analyzeEmail('email_screenshot.png');
  const analysis = client.getAnalysisText(result);

  console.log(analysis);
})();
```

### cURL

```bash
#!/bin/bash

# Configuration
IMAGE_PATH="email_screenshot.png"
API_URL="http://localhost:8001/v1/chat/completions"

# Encode image
IMAGE_B64=$(base64 -w 0 "$IMAGE_PATH")

# Create request
cat > /tmp/request.json <<EOF
{
  "model": "qwen2vl-email-analyzer",
  "messages": [
    {
      "role": "system",
      "content": "You are an expert email marketing analyst."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,$IMAGE_B64"
          }
        },
        {
          "type": "text",
          "text": "Analyze this email."
        }
      ]
    }
  ],
  "max_tokens": 2048,
  "temperature": 0.7
}
EOF

# Send request
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d @/tmp/request.json \
  | jq -r '.choices[0].message.content'
```

### PHP

```php
<?php

class EmailAnalyzerClient {
    private $baseUrl;
    private $model = 'qwen2vl-email-analyzer';

    public function __construct($baseUrl = 'http://localhost:8001') {
        $this->baseUrl = $baseUrl;
    }

    public function analyzeEmail($imagePath, $options = []) {
        $customPrompt = $options['custom_prompt'] ?? 'Analyze this email marketing campaign screenshot.';
        $maxTokens = $options['max_tokens'] ?? 2048;
        $temperature = $options['temperature'] ?? 0.7;

        // Encode image
        $imageData = file_get_contents($imagePath);
        $imageB64 = base64_encode($imageData);

        // Prepare payload
        $payload = [
            'model' => $this->model,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are an expert email marketing analyst.'
                ],
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'image_url',
                            'image_url' => [
                                'url' => "data:image/png;base64,$imageB64"
                            ]
                        ],
                        [
                            'type' => 'text',
                            'text' => $customPrompt
                        ]
                    ]
                ]
            ],
            'max_tokens' => $maxTokens,
            'temperature' => $temperature
        ];

        // Send request
        $ch = curl_init($this->baseUrl . '/v1/chat/completions');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $response = curl_exec($ch);
        curl_close($ch);

        return json_decode($response, true);
    }

    public function getAnalysisText($response) {
        return $response['choices'][0]['message']['content'];
    }
}

// Usage
$client = new EmailAnalyzerClient();
$result = $client->analyzeEmail('email_screenshot.png');
$analysis = $client->getAnalysisText($result);
echo $analysis;
```

## Best Practices

### Image Preparation

1. **Format**: PNG or JPG
2. **Size**: Resize to max 512px width before sending (reduces latency)
3. **Quality**: Ensure text is readable (min 72 DPI)
4. **Content**: Full email screenshot including header, body, and footer

```python
from PIL import Image

def prepare_image(image_path, max_width=512):
    """Resize image for optimal API performance."""
    img = Image.open(image_path)

    if img.size[0] > max_width:
        ratio = max_width / img.size[0]
        new_size = (max_width, int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    output_path = f"resized_{image_path}"
    img.save(output_path, optimize=True, quality=85)
    return output_path
```

### Performance Optimization

1. **Batch Processing**: Process multiple emails sequentially (API is single-threaded)
2. **Caching**: Cache analyses for identical images
3. **Timeout**: Set 60-second timeout (typical response: 10-15 seconds)
4. **Retry Logic**: Implement exponential backoff for transient errors

```python
import time
from typing import Optional

def analyze_with_retry(
    client: EmailAnalyzerClient,
    image_path: str,
    max_retries: int = 3
) -> Optional[Dict[str, Any]]:
    """Analyze with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            return client.analyze_email(image_path)
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                wait = 2 ** attempt  # 1s, 2s, 4s
                time.sleep(wait)
            else:
                raise
        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")
            return None
```

### Error Handling

```python
import requests

def safe_analyze(client, image_path):
    """Analyze with comprehensive error handling."""
    try:
        result = client.analyze_email(image_path)
        return {
            'success': True,
            'analysis': client.get_analysis_text(result)
        }
    except requests.exceptions.Timeout:
        return {
            'success': False,
            'error': 'Request timed out (>60s)'
        }
    except requests.exceptions.ConnectionError:
        return {
            'success': False,
            'error': 'API server unavailable'
        }
    except requests.exceptions.HTTPError as e:
        return {
            'success': False,
            'error': f'HTTP error: {e.response.status_code}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }
```

## Rate Limits

**Current Configuration:**
- No rate limiting (single-user development server)
- Sequential processing (one request at a time)
- Average response time: 10-15 seconds

**Production Recommendations:**
- Implement rate limiting (e.g., 10 requests/minute per API key)
- Add request queuing for high-volume scenarios
- Monitor response times and adjust timeouts

## Response Time

| Metric | Time |
|--------|------|
| Model loading (startup) | 30-40 seconds |
| Per-request inference | 10-15 seconds |
| Base64 encoding (client) | < 1 second |
| Network latency | < 1 second |

**Total end-to-end**: ~12-17 seconds per email

## Parsing Analysis Output

The API returns markdown-formatted analysis. Here's how to parse it:

```python
import re
from typing import Dict

def parse_analysis(analysis_text: str) -> Dict[str, any]:
    """Parse structured analysis into dictionary."""
    result = {}

    # Extract scores
    score_pattern = r'\*\*(\w+) \((\d+)/10\):\*\*'
    scores = re.findall(score_pattern, analysis_text)
    result['scores'] = {name.lower(): int(score) for name, score in scores}

    # Extract lifecycle context
    lifecycle_match = re.search(r'\*\*LIFECYCLE CONTEXT:\*\* (.*?)(?:\n\*\*|$)', analysis_text, re.DOTALL)
    if lifecycle_match:
        result['lifecycle_context'] = lifecycle_match.group(1).strip()

    # Extract conversion impact
    conversion_match = re.search(r'\*\*CONVERSION IMPACT:\*\* (.*?)(?:\n\*\*|$)', analysis_text, re.DOTALL)
    if conversion_match:
        result['conversion_impact'] = conversion_match.group(1).strip()

    # Extract actions
    actions_match = re.search(r'\*\*ACTIONS:\*\*(.*?)(?:\n\*\*|$)', analysis_text, re.DOTALL)
    if actions_match:
        actions_text = actions_match.group(1).strip()
        result['actions'] = re.findall(r'\d+\.\s+(.*?)(?:\n|$)', actions_text)

    return result

# Usage
analysis = client.get_analysis_text(result)
parsed = parse_analysis(analysis)

print(f"Subject Score: {parsed['scores']['subject']}/10")
print(f"Actions: {parsed['actions']}")
```

## Webhook Integration (Optional)

For async processing, you can build a webhook handler:

```python
from fastapi import FastAPI, BackgroundTasks
import httpx

app = FastAPI()

async def process_and_callback(image_url: str, callback_url: str):
    """Process email and send result to callback URL."""
    # Download image
    async with httpx.AsyncClient() as client:
        image_response = await client.get(image_url)
        image_data = image_response.content

    # Analyze
    analyzer = EmailAnalyzerClient()
    result = analyzer.analyze_email_from_bytes(image_data)

    # Callback
    async with httpx.AsyncClient() as client:
        await client.post(callback_url, json=result)

@app.post("/analyze-async")
async def analyze_async(
    image_url: str,
    callback_url: str,
    background_tasks: BackgroundTasks
):
    """Queue email analysis with callback."""
    background_tasks.add_task(process_and_callback, image_url, callback_url)
    return {"status": "queued"}
```

## Security Considerations

1. **Authentication**: Add API key authentication for production
2. **Input Validation**: Validate image size (max 10MB) and format
3. **Rate Limiting**: Prevent abuse with rate limits
4. **HTTPS**: Use TLS for production deployments
5. **Content Filtering**: Validate image content (no inappropriate images)

## Support & Contact

**Issues**: Report bugs or feature requests to your support channel
**Performance**: Typical SLA: 95% of requests complete in < 20 seconds
**Uptime**: Development server - no uptime guarantees

## Changelog

**v1.0.0** (2025-11-18)
- Initial release
- Qwen2-VL-2B fine-tuned model
- OpenAI-compatible API
- Support for PNG/JPG email screenshots
- Structured markdown output with scores and recommendations
