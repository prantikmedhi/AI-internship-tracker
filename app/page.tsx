'use client';

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 font-sans dark:from-slate-900 dark:to-slate-800 min-h-screen">
      <main className="flex flex-col items-center justify-center gap-8 py-32 px-16 text-center max-w-2xl">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            🤖 Notion Internship Agent
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            AI-powered internship finder powered by Telegram
          </p>
        </div>

        <div className="flex flex-col items-center gap-6 w-full">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-left w-full">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-3">How to Use:</h2>
            <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300 list-decimal list-inside">
              <li>Open Telegram and find your bot</li>
              <li>Send <code className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">/start</code></li>
              <li>Click the Notion OAuth link in the chat</li>
              <li>Authenticate your Notion account (PKCE flow)</li>
              <li>Start searching: <code className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">/find python india</code></li>
            </ol>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            This page handles OAuth callbacks. <strong>Use Telegram to interact with the bot!</strong>
          </p>
        </div>

        <div className="flex flex-col gap-4 text-left w-full mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">✨ Features</h2>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex gap-2">
              <span>✓</span>
              <span>Secure OAuth 2.0 PKCE authentication (no tokens stored)</span>
            </li>
            <li className="flex gap-2">
              <span>✓</span>
              <span>Read your Notion profile (Resume, Skills, Projects, Preferences)</span>
            </li>
            <li className="flex gap-2">
              <span>✓</span>
              <span>Search internships from LinkedIn, Internshala, and RemoteOK</span>
            </li>
            <li className="flex gap-2">
              <span>✓</span>
              <span>AI-powered ranking with Ollama or Gemini</span>
            </li>
            <li className="flex gap-2">
              <span>✓</span>
              <span>Save results to Notion with skill matching analysis</span>
            </li>
            <li className="flex gap-2">
              <span>✓</span>
              <span>MCP server support for Notion workspace management</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
