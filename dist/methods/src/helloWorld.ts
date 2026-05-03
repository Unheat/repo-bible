import { mindstudio } from '@mindstudio-ai/agent';
import { Greetings } from './tables/default';

export interface HelloWorldInput {
  name: string;
}

export interface HelloWorldOutput {
  id: string;
  name: string;
  greeting: string;
}

export async function helloWorld(
  input: HelloWorldInput,
): Promise<HelloWorldOutput> {
  const { content } = await mindstudio.generateText({
    message: `Write a single warm, creative, one-sentence greeting for someone named "${input.name}". Be friendly and imaginative. Reply with only the greeting, nothing else.`,
  });

  const record = await Greetings.push({
    name: input.name,
    greeting: content,
  });

  return { id: record.id, name: record.name, greeting: record.greeting };
}
