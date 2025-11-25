# Fine-Tuning Data Format

This document describes the structure of training data stored in DynamoDB for fine-tuning email analysis models.

## Storage Structure

Each email analysis is stored with a `fineTuningData` field that follows the standard LLM fine-tuning format (compatible with OpenAI, Anthropic, and similar providers).

### Example Record

```json
{
  "emailId": "abc123",
  "timestamp": 1700000000000,
  "from": "sender@example.com",
  "subject": "Black Friday Sale",

  "fineTuningData": {
    "messages": [
      {
        "role": "system",
        "content": "You are an email marketing analyst specializing in retail e-commerce.\n\nAnalyze the provided email marketing campaign and provide comprehensive feedback.\n\nCRITICAL LANGUAGE REQUIREMENT:\n- Email Language: German\n- ALL suggestions (subject lines, CTA text, body copy examples) MUST be in German\n- Analysis and explanations should be in English\n- DO NOT suggest removing email client prefixes (Fwd:, Re:, Fw:) from subject lines\n\nProvide scores out of 10 for each section and specific, actionable recommendations.\nRemember: the sender will copy-paste your suggestions directly into their German campaign."
      },
      {
        "role": "user",
        "content": "Analyze this email marketing campaign:\n\nSubject: Black Friday Sale\n\nContent:\nSichern Sie sich jetzt 50% Rabatt auf alle Produkte!\n\nProvide detailed structured feedback following the email marketing analysis framework."
      },
      {
        "role": "assistant",
        "content": {
          "detectedLanguage": "German",
          "lifecycleContext": {
            "stage": "Promotional Campaign",
            "journeyFit": "Transactional engagement during high-intent shopping period",
            "benchmarks": "Black Friday campaigns typically see 25-35% open rates, 3-5% CTR"
          },
          "subjectLine": {
            "score": 7,
            "analysis": "Clear value proposition with specific discount. Could improve with urgency or personalization.",
            "alternatives": [
              "Letzte Chance: 50% Black Friday Rabatt endet heute!",
              "Nur für Sie: Exklusive 50% auf Ihre Favoriten",
              "Black Friday: Jetzt 50% sparen + Gratis Versand"
            ]
          },
          "bodyContent": {
            "score": 6,
            "analysis": "Good discount offer but lacks structure and clear CTA hierarchy",
            "examples": [
              {
                "text": "Entdecken Sie unsere Top-Angebote mit bis zu 50% Rabatt",
                "impact": "Creates excitement and clarity about offer scope"
              }
            ]
          },
          "callToAction": {
            "score": 5,
            "analysis": "Missing clear CTA button and urgency",
            "suggestions": [
              "Jetzt zugreifen",
              "Black Friday Rabatte sichern",
              "Angebot aktivieren"
            ]
          },
          "technicalGdpr": {
            "score": 8,
            "analysis": "Appears mobile-friendly, GDPR compliant"
          },
          "conversionImpact": {
            "estimates": "Adding urgency and better CTA could increase CTR by 15-25%"
          },
          "recommendedActions": [
            {
              "action": "Add countdown timer or deadline",
              "example": "Nur noch 6 Stunden: Black Friday Sale endet bald!"
            },
            {
              "action": "Include product recommendations",
              "example": "Ihre persönlichen Empfehlungen mit 50% Rabatt"
            }
          ],
          "transferableLessons": [
            "Urgency drives action in promotional campaigns",
            "Language consistency is critical for trust and conversion"
          ]
        }
      }
    ],
    "metadata": {
      "language": "German",
      "contentType": "text-only",
      "hasImages": false,
      "hasPDFs": false,
      "imageCount": 0,
      "pdfCount": 0,
      "tokensUsed": 2456,
      "processingTimeMs": 4523
    }
  }
}
```

## Benefits for Fine-Tuning

### 1. **Ready for Training**
The format can be directly exported and used for fine-tuning without transformation:
```bash
# Export from DynamoDB
aws dynamodb scan --table-name EmailAnalysisData \
  --projection-expression fineTuningData > training_data.json
```

### 2. **Message Format**
Follows the standard `messages` array format used by OpenAI, Anthropic, and others:
- **system**: Contains the instructions and requirements
- **user**: Contains the input (email to analyze)
- **assistant**: Contains the expected output (structured analysis)

### 3. **Rich Metadata**
Each example includes metadata for:
- Filtering by language for language-specific models
- Filtering by content type (text-only vs with images/PDFs)
- Performance metrics (tokens, processing time)
- Content characteristics (has images, has PDFs)

## Using the Data

### Export for Fine-Tuning
```python
import boto3
import json

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('EmailAnalysisData')

# Scan and extract training data
response = table.scan(
    ProjectionExpression='fineTuningData'
)

training_examples = [item['fineTuningData'] for item in response['Items']]

# Save in JSONL format (one example per line)
with open('training_data.jsonl', 'w') as f:
    for example in training_examples:
        f.write(json.dumps(example) + '\n')
```

### Filter by Language
```python
# Get only German examples
response = table.scan(
    FilterExpression='fineTuningData.metadata.#lang = :german',
    ExpressionAttributeNames={'#lang': 'language'},
    ExpressionAttributeValues={':german': 'German'}
)
```

### Filter by Content Type
```python
# Get only text-only examples (no images/PDFs)
response = table.scan(
    FilterExpression='fineTuningData.metadata.contentType = :type',
    ExpressionAttributeValues={':type': 'text-only'}
)
```

## Legacy Fields

For backward compatibility, the following legacy fields are also stored:
- `emailContent`: Raw text content
- `claudeAnalysis`: Formatted text response (for email)
- `claudeAnalysisJson`: Structured JSON (for parsing)
- `detectedLanguage`: Language code

These can be removed in future versions once all integrations use `fineTuningData`.
