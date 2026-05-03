import { db } from '@mindstudio-ai/agent';

export interface Greeting {
  name: string;
  greeting: string;
}

export const Greetings = db.defineTable<Greeting>('greetings');
