export type PromptConfig = {
  role?: string;
  instruction?: string | string[];
  context?: string;
  output_constraints?: string | string[];
  style_or_tone?: string | string[];
  output_format?: string | string[];
  examples?: string | string[];
  goal?: string;
  reasoning_strategy?: string;
};

export type AppConfig = {
  reasoning_strategies?: Record<string, string>;
};

export function lowercaseFirstChar(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

export function formatPromptSection(
  leadIn: string,
  value: string | string[]
): string {
  const formattedValue = Array.isArray(value)
    ? value.map((item) => `- ${item}`).join("\n")
    : value;
  return `${leadIn}\n${formattedValue}`;
}

export function buildPromptFromConfig(
  config: PromptConfig,
  inputData: string = "",
  appConfig?: AppConfig
): string {
  const promptParts: string[] = [];

  if (config.role) {
    promptParts.push(`You are ${lowercaseFirstChar(config.role.trim())}.`);
  }

  const instruction = config.instruction;
  if (!instruction) {
    throw new Error("Missing required field: 'instruction'");
  }
  promptParts.push(
    formatPromptSection("Your task is as follows:", instruction)
  );

  if (config.context) {
    promptParts.push(
      `Here’s some background that may help you:\n${config.context}`
    );
  }

  if (config.output_constraints) {
    promptParts.push(
      formatPromptSection(
        "Ensure your response follows these rules:",
        config.output_constraints
      )
    );
  }

  if (config.style_or_tone) {
    promptParts.push(
      formatPromptSection(
        "Follow these style and tone guidelines in your response:",
        config.style_or_tone
      )
    );
  }

  if (config.output_format) {
    promptParts.push(
      formatPromptSection(
        "Structure your response as follows:",
        config.output_format
      )
    );
  }

  if (config.examples) {
    promptParts.push("Here are some examples to guide your response:");
    if (Array.isArray(config.examples)) {
      config.examples.forEach((example, i) => {
        promptParts.push(`Example ${i + 1}:\n${example}`);
      });
    } else {
      promptParts.push(String(config.examples));
    }
  }

  if (config.goal) {
    promptParts.push(
      `Your goal is to achieve the following outcome:\n${config.goal}`
    );
  }

  if (inputData) {
    promptParts.push(
      `Here is the content you need to work with:\n<<<BEGIN CONTENT>>>\n\n\`\`\`\n${inputData.trim()}\n\`\`\`\n<<<END CONTENT>>>`
    );
  }

  if (
    config.reasoning_strategy &&
    config.reasoning_strategy !== "None" &&
    appConfig
  ) {
    const strategies = appConfig.reasoning_strategies || {};
    const strategyText = strategies[config.reasoning_strategy];
    if (strategyText) {
      promptParts.push(strategyText.trim());
    }
  }

  promptParts.push("Now perform the task as instructed above.");

  return promptParts.join("\n\n");
}
