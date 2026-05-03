import { useRef, useState, useCallback } from 'react';
import { create } from 'zustand';
import api from './api';
import styles from './App.module.css';

interface Greeting {
  id: string;
  name: string;
  greeting: string;
}

// ---------------------------------------------------------------------------
// Global store
// ---------------------------------------------------------------------------

interface Store {
  greetings: Greeting[];
  addGreeting: (greeting: Greeting) => void;
}

const useStore = create<Store>((set) => ({
  greetings: [],
  addGreeting: (greeting) =>
    set((state) => ({ greetings: [greeting, ...state.greetings] })),
}));

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [name, setName] = useState('');
  const [streamText, setStreamText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const greetings = useStore((s) => s.greetings);
  const addGreeting = useStore((s) => s.addGreeting);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setStreamText('');
    try {
      const result = (await api.helloWorld(
        { name: trimmed },
        {
          stream: true,
          onToken: (text: string) => setStreamText(text),
        },
      )) as Greeting;

      addGreeting(result);
      setStreamText('');
      setName('');
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
      setStreamText('');
    }
  }, [name, isLoading, addGreeting]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const allItems = [
    ...(isLoading && streamText
      ? [
          {
            id: '_stream',
            name: name.trim(),
            greeting: streamText,
            isStreaming: true,
          },
        ]
      : []),
    ...greetings.map((g) => ({ ...g, isStreaming: false })),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Hello World</h1>
          <p className={styles.subtitle}>AI-powered greetings</p>
        </div>

        <div className={styles.inputArea}>
          <input
            ref={inputRef}
            className={styles.nameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your name"
            disabled={isLoading}
            autoFocus
          />
          <button
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading}
            data-loading={isLoading || undefined}
          >
            {isLoading ? 'Thinking...' : 'Say Hello'}
          </button>
        </div>

        {allItems.length > 0 ? (
          <div className={styles.listSection}>
            {allItems.map((item, i) => (
              <div key={item.id}>
                {i > 0 && <div className={styles.divider} />}
                <div className={styles.card}>
                  <p className={styles.cardGreeting}>
                    {item.greeting}
                    {item.isStreaming && (
                      <span className={styles.streamingDot} />
                    )}
                  </p>
                  <p className={styles.cardName}>{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>No greetings yet</div>
        )}
      </div>
    </div>
  );
}
