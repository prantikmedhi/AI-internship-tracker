/**
 * Greeting Intent
 * Detects and responds to greetings
 */

const GREETING_KEYWORDS = [
  'hello',
  'hi',
  'hey',
  'howdy',
  'greetings',
  'sup',
  'what\'s up',
  'yo',
  'good morning',
  'good afternoon',
  'good evening',
  'good night',
  'thanks',
  'thank you',
];

const GREETING_RESPONSES = [
  '👋 Hey there! Ready to find some internships?',
  '👋 Hi! How can I help you today?',
  '🙋 Hello! Looking for internships?',
  '👋 What\'s up! Let me help you search.',
  '🤖 Hey! Ask me to find internships or search your Notion workspace.',
  '👋 Howdy! What can I do for you?',
];

export function isGreeting(text: string): boolean {
  return GREETING_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function randomGreetingResponse(): string {
  return GREETING_RESPONSES[Math.floor(Math.random() * GREETING_RESPONSES.length)];
}
