// This file is machine-generated - edit at your own risk.

'use server';

/**
 * @fileOverview Generates review questions for self and peer reviews based on a topic or skills.
 *
 * - generateReviewQuestions - A function that generates review questions.
 * - GenerateReviewQuestionsInput - The input type for the generateReviewQuestions function.
 * - GenerateReviewQuestionsOutput - The return type for the generateReviewQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {requireUserSession} from '@/lib/auth';

const GenerateReviewQuestionsInputSchema = z.object({
  topicOrSkills: z
    .string()
    .describe('The general topic or set of skills for the review questions.'),
  reviewType: z.enum(['self', 'peer']).describe('The type of review (self or peer).'),
  numberOfQuestions: z
    .number()
    .min(3)
    .max(10)
    .default(5)
    .describe('The number of questions to generate.'),
});

export type GenerateReviewQuestionsInput = z.infer<typeof GenerateReviewQuestionsInputSchema>;

const GenerateReviewQuestionsOutputSchema = z.object({
  questions: z.array(
    z.string().describe('A question for the review, related to the topic or skills.')
  ),
});

export type GenerateReviewQuestionsOutput = z.infer<typeof GenerateReviewQuestionsOutputSchema>;

export async function generateReviewQuestions(
  input: GenerateReviewQuestionsInput
): Promise<GenerateReviewQuestionsOutput> {
  await requireUserSession();
  return generateReviewQuestionsFlow(input);
}

const generateReviewQuestionsPrompt = ai.definePrompt({
  name: 'generateReviewQuestionsPrompt',
  input: {schema: GenerateReviewQuestionsInputSchema},
  output: {schema: GenerateReviewQuestionsOutputSchema},
  prompt: `You are an HR expert specializing in generating review questions for employees.

You will generate {{numberOfQuestions}} questions for a {{reviewType}} review, based on the following topic or skills: {{topicOrSkills}}.

Ensure the questions are clear, concise, and relevant to the topic or skills provided.

Output the questions as a JSON array of strings.

Example:
{
  "questions": [
    "What are your key accomplishments related to {{topicOrSkills}}?",
    "How have you demonstrated {{topicOrSkills}} in your role?",
    "What are your strengths and weaknesses related to {{topicOrSkills}}?",
    "How can you further improve your skills in {{topicOrSkills}}?",
    "How does your work in {{topicOrSkills}} contribute to the team's goals?"
  ]
}

Now generate {{numberOfQuestions}} questions for a {{reviewType}} review based on {{topicOrSkills}}.
`, // Added Handlebars syntax for accessing input values
});

const generateReviewQuestionsFlow = ai.defineFlow(
  {
    name: 'generateReviewQuestionsFlow',
    inputSchema: GenerateReviewQuestionsInputSchema,
    outputSchema: GenerateReviewQuestionsOutputSchema,
  },
  async input => {
    const {output} = await generateReviewQuestionsPrompt(input);
    return output!;
  }
);
