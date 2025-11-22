import { describe, it, expect } from 'vitest';
import {
  extractTextContent,
  htmlToPlainText,
  detectAttachments,
  categorizeContent,
  validateContentPackage,
  type ProcessingContext,
} from './email-processor';
import type { WebhookPayload } from '../lib/schemas';
import type { EncodedImage } from './image-processor';
import { ContentProcessingError, ERROR_CODES } from '../lib/errors';

describe('Email Processor Service', () => {
  describe('extractTextContent', () => {
    it('should extract text from text field when available', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Hello world',
      };

      const result = extractTextContent(payload);

      expect(result).toBe('Hello world');
    });

    it('should prioritize text field over HTML', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Plain text version',
        html: '<p>HTML version</p>',
      };

      const result = extractTextContent(payload);

      expect(result).toBe('Plain text version');
    });

    it('should extract text from HTML when text field is missing', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello from HTML</p>',
      };

      const result = extractTextContent(payload);

      expect(result).toBe('Hello from HTML');
    });

    it('should extract text from HTML when text field is empty', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: '',
        html: '<p>HTML content</p>',
      };

      const result = extractTextContent(payload);

      expect(result).toBe('HTML content');
    });

    it('should extract text from HTML when text field is whitespace only', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: '   ',
        html: '<p>HTML content</p>',
      };

      const result = extractTextContent(payload);

      expect(result).toBe('HTML content');
    });

    it('should return empty string when both text and HTML are missing', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
      };

      const result = extractTextContent(payload);

      expect(result).toBe('');
    });

    it('should return empty string when both text and HTML are empty', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: '',
        html: '',
      };

      const result = extractTextContent(payload);

      expect(result).toBe('');
    });

    it('should trim leading and trailing whitespace from text', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: '  Hello world  ',
      };

      const result = extractTextContent(payload);

      expect(result).toBe('Hello world');
    });

    it('should handle multiline text content', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Line 1\nLine 2\nLine 3',
      };

      const result = extractTextContent(payload);

      expect(result).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('htmlToPlainText', () => {
    it('should strip simple HTML tags', () => {
      const html = '<p>Hello world</p>';
      const result = htmlToPlainText(html);
      expect(result).toBe('Hello world');
    });

    it('should strip nested HTML tags', () => {
      const html = '<div><p><strong>Bold text</strong> and <em>italic</em></p></div>';
      const result = htmlToPlainText(html);
      expect(result).toBe('Bold text and italic');
    });

    it('should decode common HTML entities', () => {
      const html = 'Hello&nbsp;world&amp;friends&lt;tag&gt;';
      const result = htmlToPlainText(html);
      expect(result).toBe('Hello world&friends<tag>');
    });

    it('should decode quotes', () => {
      const html = '&quot;Hello&quot; and &#39;world&#39;';
      const result = htmlToPlainText(html);
      expect(result).toBe('"Hello" and \'world\'');
    });

    it('should normalize whitespace', () => {
      const html = '<p>Hello    world</p>\n<p>New   paragraph</p>';
      const result = htmlToPlainText(html);
      expect(result).toBe('Hello world New paragraph');
    });

    it('should handle complex HTML structure', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </body>
        </html>
      `;
      const result = htmlToPlainText(html);
      expect(result).toContain('Title');
      expect(result).toContain('Paragraph 1');
      expect(result).toContain('Paragraph 2');
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
    });

    it('should handle HTML with attributes', () => {
      const html = '<a href="https://example.com" class="link">Click here</a>';
      const result = htmlToPlainText(html);
      expect(result).toBe('Click here');
    });

    it('should handle self-closing tags', () => {
      const html = 'Line 1<br/>Line 2<hr/>Line 3';
      const result = htmlToPlainText(html);
      expect(result).toBe('Line 1 Line 2 Line 3');
    });

    it('should trim leading and trailing whitespace', () => {
      const html = '  <p>Hello</p>  ';
      const result = htmlToPlainText(html);
      expect(result).toBe('Hello');
    });

    it('should handle empty HTML', () => {
      const html = '';
      const result = htmlToPlainText(html);
      expect(result).toBe('');
    });

    it('should handle HTML with only tags', () => {
      const html = '<div></div><p></p>';
      const result = htmlToPlainText(html);
      expect(result).toBe('');
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<p>Unclosed paragraph';
      const result = htmlToPlainText(html);
      expect(result).toBe('Unclosed paragraph');
    });

    it('should preserve text between tags', () => {
      const html = 'Text before <p>inside</p> text after';
      const result = htmlToPlainText(html);
      expect(result).toBe('Text before inside text after');
    });

    it('should handle HTML with script and style tags', () => {
      const html = '<p>Content</p><script>alert("test")</script><style>.class{}</style>';
      const result = htmlToPlainText(html);
      expect(result).toBe('Content alert("test") .class{}');
    });
  });

  describe('detectAttachments', () => {
    it('should return empty array when attachments field is missing', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'No attachments',
      };

      const result = detectAttachments(payload);

      expect(result).toEqual([]);
    });

    it('should return empty array when attachments array is empty', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'No attachments',
        attachments: [],
      };

      const result = detectAttachments(payload);

      expect(result).toEqual([]);
    });

    it('should detect single attachment', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        attachments: [
          {
            url: 'https://example.com/screenshot.png',
            filename: 'screenshot.png',
            contentType: 'image/png',
          },
        ],
      };

      const result = detectAttachments(payload);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        url: 'https://example.com/screenshot.png',
        filename: 'screenshot.png',
        contentType: 'image/png',
      });
    });

    it('should detect multiple attachments', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        attachments: [
          {
            url: 'https://example.com/screenshot.png',
            filename: 'screenshot.png',
            contentType: 'image/png',
          },
          {
            url: 'https://example.com/draft.jpg',
            filename: 'draft.jpg',
            contentType: 'image/jpeg',
          },
        ],
      };

      const result = detectAttachments(payload);

      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('screenshot.png');
      expect(result[0].contentType).toBe('image/png');
      expect(result[1].filename).toBe('draft.jpg');
      expect(result[1].contentType).toBe('image/jpeg');
    });

    it('should preserve all attachment metadata', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        attachments: [
          {
            url: 'https://example.com/document.pdf',
            filename: 'document.pdf',
            contentType: 'application/pdf',
          },
        ],
      };

      const result = detectAttachments(payload);

      expect(result[0]).toHaveProperty('url');
      expect(result[0]).toHaveProperty('filename');
      expect(result[0]).toHaveProperty('contentType');
      expect(result[0].url).toBe('https://example.com/document.pdf');
    });

    it('should handle different content types', () => {
      const payload: WebhookPayload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        attachments: [
          {
            url: 'https://example.com/image.png',
            filename: 'image.png',
            contentType: 'image/png',
          },
          {
            url: 'https://example.com/photo.jpg',
            filename: 'photo.jpg',
            contentType: 'image/jpeg',
          },
          {
            url: 'https://example.com/doc.pdf',
            filename: 'doc.pdf',
            contentType: 'application/pdf',
          },
        ],
      };

      const result = detectAttachments(payload);

      expect(result).toHaveLength(3);
      expect(result.map(a => a.contentType)).toEqual([
        'image/png',
        'image/jpeg',
        'application/pdf',
      ]);
    });
  });

  describe('categorizeContent', () => {
    it('should categorize as text-only when only text is present', () => {
      const text = 'This is some email text';
      const images: EncodedImage[] = [];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('text-only');
      expect(result.text).toBe(text);
      expect(result.images).toEqual([]);
    });

    it('should categorize as screenshot-only when only images are present', () => {
      const text = '';
      const images: EncodedImage[] = [
        {
          filename: 'screenshot.png',
          contentType: 'image/png',
          dataUrl: 'data:image/png;base64,abc123',
        },
      ];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('screenshot-only');
      expect(result.text).toBe('');
      expect(result.images).toEqual(images);
    });

    it('should categorize as hybrid when both text and images are present', () => {
      const text = 'Here is my draft';
      const images: EncodedImage[] = [
        {
          filename: 'screenshot.png',
          contentType: 'image/png',
          dataUrl: 'data:image/png;base64,abc123',
        },
      ];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('hybrid');
      expect(result.text).toBe(text);
      expect(result.images).toEqual(images);
    });

    it('should categorize as empty when neither text nor images are present', () => {
      const text = '';
      const images: EncodedImage[] = [];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('empty');
      expect(result.text).toBe('');
      expect(result.images).toEqual([]);
    });

    it('should treat whitespace-only text as empty', () => {
      const text = '   \n\t  ';
      const images: EncodedImage[] = [];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('empty');
      expect(result.text).toBe('   \n\t  '); // Preserves original text
      expect(result.images).toEqual([]);
    });

    it('should categorize as screenshot-only with whitespace text and images', () => {
      const text = '  ';
      const images: EncodedImage[] = [
        {
          filename: 'image.png',
          contentType: 'image/png',
          dataUrl: 'data:image/png;base64,xyz',
        },
      ];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('screenshot-only');
    });

    it('should handle multiple images in screenshot-only', () => {
      const text = '';
      const images: EncodedImage[] = [
        {
          filename: 'image1.png',
          contentType: 'image/png',
          dataUrl: 'data:image/png;base64,abc',
        },
        {
          filename: 'image2.jpeg',
          contentType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,def',
        },
      ];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('screenshot-only');
      expect(result.images).toHaveLength(2);
    });

    it('should handle multiple images in hybrid', () => {
      const text = 'Check out these screenshots';
      const images: EncodedImage[] = [
        {
          filename: 'image1.png',
          contentType: 'image/png',
          dataUrl: 'data:image/png;base64,abc',
        },
        {
          filename: 'image2.png',
          contentType: 'image/png',
          dataUrl: 'data:image/png;base64,def',
        },
      ];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('hybrid');
      expect(result.images).toHaveLength(2);
    });

    it('should preserve original text in content package', () => {
      const text = '  Leading and trailing spaces  ';
      const images: EncodedImage[] = [];

      const result = categorizeContent(text, images);

      expect(result.text).toBe(text); // Original text preserved, not trimmed
    });

    it('should preserve images array reference', () => {
      const text = 'Text content';
      const images: EncodedImage[] = [
        {
          filename: 'test.png',
          contentType: 'image/png',
          dataUrl: 'data:image/png;base64,test',
        },
      ];

      const result = categorizeContent(text, images);

      expect(result.images).toBe(images); // Same reference
    });

    it('should handle long text content', () => {
      const text = 'A'.repeat(10000);
      const images: EncodedImage[] = [];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('text-only');
      expect(result.text.length).toBe(10000);
    });

    it('should handle many images', () => {
      const text = '';
      const images: EncodedImage[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          filename: `image${i}.png`,
          contentType: 'image/png',
          dataUrl: `data:image/png;base64,data${i}`,
        }));

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('screenshot-only');
      expect(result.images).toHaveLength(10);
    });

    it('should categorize newlines-only text as empty', () => {
      const text = '\n\n\n';
      const images: EncodedImage[] = [];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('empty');
    });

    it('should categorize text with single character as text-only', () => {
      const text = 'A';
      const images: EncodedImage[] = [];

      const result = categorizeContent(text, images);

      expect(result.contentType).toBe('text-only');
      expect(result.text).toBe('A');
    });
  });

  describe('validateContentPackage', () => {
    describe('Valid content scenarios', () => {
      it('should not throw error for text-only content', () => {
        const contentPackage = {
          contentType: 'text-only' as const,
          text: 'Hello world',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 0,
          downloadedCount: 0,
          validatedCount: 0,
        };

        expect(() => validateContentPackage(contentPackage, context)).not.toThrow();
      });

      it('should not throw error for screenshot-only content', () => {
        const contentPackage = {
          contentType: 'screenshot-only' as const,
          text: '',
          images: [
            {
              filename: 'screenshot.png',
              contentType: 'image/png',
              dataUrl: 'data:image/png;base64,abc',
            },
          ],
        };
        const context: ProcessingContext = {
          attachmentCount: 1,
          downloadedCount: 1,
          validatedCount: 1,
        };

        expect(() => validateContentPackage(contentPackage, context)).not.toThrow();
      });

      it('should not throw error for hybrid content', () => {
        const contentPackage = {
          contentType: 'hybrid' as const,
          text: 'Check this out',
          images: [
            {
              filename: 'screenshot.png',
              contentType: 'image/png',
              dataUrl: 'data:image/png;base64,abc',
            },
          ],
        };
        const context: ProcessingContext = {
          attachmentCount: 1,
          downloadedCount: 1,
          validatedCount: 1,
        };

        expect(() => validateContentPackage(contentPackage, context)).not.toThrow();
      });

      it('should not throw error when text exists even if images failed', () => {
        const contentPackage = {
          contentType: 'text-only' as const,
          text: 'Here is my text',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 2,
          downloadedCount: 0,
          validatedCount: 0,
          downloadFailures: 2,
        };

        expect(() => validateContentPackage(contentPackage, context)).not.toThrow();
      });
    });

    describe('NO_CONTENT error', () => {
      it('should throw NO_CONTENT error when no text and no attachments', () => {
        const contentPackage = {
          contentType: 'empty' as const,
          text: '',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 0,
          downloadedCount: 0,
          validatedCount: 0,
        };

        expect(() => validateContentPackage(contentPackage, context)).toThrow(
          ContentProcessingError
        );
        expect(() => validateContentPackage(contentPackage, context)).toThrow(
          'No content found to analyze'
        );

        try {
          validateContentPackage(contentPackage, context);
        } catch (error) {
          expect(error).toBeInstanceOf(ContentProcessingError);
          if (error instanceof ContentProcessingError) {
            expect(error.code).toBe(ERROR_CODES.NO_CONTENT);
            expect(error.details).toHaveProperty('attachmentCount', 0);
          }
        }
      });

      it('should throw NO_CONTENT error for whitespace-only text', () => {
        const contentPackage = {
          contentType: 'empty' as const,
          text: '   \n\t  ',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 0,
          downloadedCount: 0,
          validatedCount: 0,
        };

        expect(() => validateContentPackage(contentPackage, context)).toThrow(
          ContentProcessingError
        );
      });
    });

    describe('DOWNLOAD_FAILED error', () => {
      it('should throw DOWNLOAD_FAILED error when all downloads failed', () => {
        const contentPackage = {
          contentType: 'empty' as const,
          text: '',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 3,
          downloadedCount: 0,
          validatedCount: 0,
          downloadFailures: 3,
        };

        expect(() => validateContentPackage(contentPackage, context)).toThrow(
          ContentProcessingError
        );
        expect(() => validateContentPackage(contentPackage, context)).toThrow(
          'Unable to download screenshots'
        );

        try {
          validateContentPackage(contentPackage, context);
        } catch (error) {
          if (error instanceof ContentProcessingError) {
            expect(error.code).toBe(ERROR_CODES.DOWNLOAD_FAILED);
            expect(error.details).toHaveProperty('attachmentCount', 3);
            expect(error.details).toHaveProperty('downloadedCount', 0);
          }
        }
      });

      it('should prioritize DOWNLOAD_FAILED over NO_CONTENT when attachments existed', () => {
        const contentPackage = {
          contentType: 'empty' as const,
          text: '',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 1,
          downloadedCount: 0,
          validatedCount: 0,
        };

        try {
          validateContentPackage(contentPackage, context);
        } catch (error) {
          if (error instanceof ContentProcessingError) {
            expect(error.code).toBe(ERROR_CODES.DOWNLOAD_FAILED);
          }
        }
      });
    });

    describe('INVALID_FORMAT error', () => {
      it('should throw INVALID_FORMAT error when all formats are invalid', () => {
        const contentPackage = {
          contentType: 'empty' as const,
          text: '',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 2,
          downloadedCount: 2,
          validatedCount: 0,
          formatFailures: 2,
        };

        expect(() => validateContentPackage(contentPackage, context)).toThrow(
          ContentProcessingError
        );
        expect(() => validateContentPackage(contentPackage, context)).toThrow(
          'Unsupported image formats'
        );

        try {
          validateContentPackage(contentPackage, context);
        } catch (error) {
          if (error instanceof ContentProcessingError) {
            expect(error.code).toBe(ERROR_CODES.INVALID_FORMAT);
            expect(error.details).toHaveProperty('formatFailures', 2);
          }
        }
      });

      it('should throw INVALID_FORMAT when downloaded but all invalid', () => {
        const contentPackage = {
          contentType: 'empty' as const,
          text: '  ',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 1,
          downloadedCount: 1,
          validatedCount: 0,
          formatFailures: 1,
        };

        try {
          validateContentPackage(contentPackage, context);
        } catch (error) {
          if (error instanceof ContentProcessingError) {
            expect(error.code).toBe(ERROR_CODES.INVALID_FORMAT);
          }
        }
      });
    });

    describe('SIZE_EXCEEDED error', () => {
      it('should throw SIZE_EXCEEDED error when all images too large', () => {
        const contentPackage = {
          contentType: 'empty' as const,
          text: '',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 2,
          downloadedCount: 2,
          validatedCount: 0,
          sizeFailures: 2,
        };

        expect(() => validateContentPackage(contentPackage, context)).toThrow(
          ContentProcessingError
        );
        expect(() => validateContentPackage(contentPackage, context)).toThrow(
          'Screenshots are too large'
        );

        try {
          validateContentPackage(contentPackage, context);
        } catch (error) {
          if (error instanceof ContentProcessingError) {
            expect(error.code).toBe(ERROR_CODES.SIZE_EXCEEDED);
            expect(error.details).toHaveProperty('sizeFailures', 2);
          }
        }
      });

      it('should throw SIZE_EXCEEDED for single oversized image', () => {
        const contentPackage = {
          contentType: 'empty' as const,
          text: '',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 1,
          downloadedCount: 1,
          validatedCount: 0,
          sizeFailures: 1,
        };

        try {
          validateContentPackage(contentPackage, context);
        } catch (error) {
          if (error instanceof ContentProcessingError) {
            expect(error.code).toBe(ERROR_CODES.SIZE_EXCEEDED);
          }
        }
      });
    });

    describe('Error priority and details', () => {
      it('should include comprehensive error details', () => {
        const contentPackage = {
          contentType: 'empty' as const,
          text: '',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 5,
          downloadedCount: 3,
          validatedCount: 0,
          downloadFailures: 2,
          formatFailures: 2,
          sizeFailures: 1,
        };

        try {
          validateContentPackage(contentPackage, context);
        } catch (error) {
          if (error instanceof ContentProcessingError) {
            expect(error.details).toHaveProperty('contentType', 'empty');
            expect(error.details).toHaveProperty('attachmentCount', 5);
            expect(error.details).toHaveProperty('downloadedCount', 3);
            expect(error.details).toHaveProperty('validatedCount', 0);
          }
        }
      });

      it('should prioritize format failures over size failures', () => {
        const contentPackage = {
          contentType: 'empty' as const,
          text: '',
          images: [],
        };
        const context: ProcessingContext = {
          attachmentCount: 3,
          downloadedCount: 3,
          validatedCount: 0,
          formatFailures: 2,
          sizeFailures: 1,
        };

        try {
          validateContentPackage(contentPackage, context);
        } catch (error) {
          if (error instanceof ContentProcessingError) {
            // Format failures take priority
            expect(error.code).toBe(ERROR_CODES.INVALID_FORMAT);
          }
        }
      });
    });
  });
});
