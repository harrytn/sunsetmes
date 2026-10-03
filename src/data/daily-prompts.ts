// Both profiles receive the same prompt for a UTC day. The full set repeats only
// after 40 days, with no database reads or writes needed to choose a prompt.
export const dailyPrompts = [
  'What color feels like today?',
  'What do you need most today?',
  'What made you smile today?',
  'What is your energy like?',
  'What does home feel like today?',
  'What word describes your morning?',
  'What word describes your evening?',
  'What would you like more of?',
  'What would you like less of?',
  'What is on your mind?',
  'What are you grateful for?',
  'What do you miss today?',
  'What gives you comfort?',
  'What made today memorable?',
  'What word fits this weather?',
  'What is your heart asking for?',
  'What did you notice today?',
  'What are you looking forward to?',
  'What would you hold onto?',
  'What would you let go of?',
  'What feels possible today?',
  'What feels difficult today?',
  'What sound fits your day?',
  'What taste fits your day?',
  'What season feels like you?',
  'What would you call this chapter?',
  'What was your best moment?',
  'What word feels like a hug?',
  'What helps you feel calm?',
  'What are you curious about?',
  'What surprised you today?',
  'What feels far away?',
  'What feels close to you?',
  'What do you want to remember?',
  'What would you tell tomorrow?',
  'What is your pace today?',
  'What word describes us today?',
  'What is worth celebrating?',
  'What would make tonight better?',
  'What word will you carry forward?',
] as const;

export function promptForUtcDate(date: Date) {
  const day = Math.floor(date.getTime() / 86_400_000);
  const index = ((day % dailyPrompts.length) + dailyPrompts.length) % dailyPrompts.length;
  return { question: dailyPrompts[index], number: index + 1, total: dailyPrompts.length };
}
