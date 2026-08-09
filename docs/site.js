const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];

function activateTab(nextTab) {
  for (const tab of tabs) {
    const active = tab === nextTab;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }

  for (const panel of panels) {
    panel.hidden = panel.getAttribute("aria-labelledby") !== nextTab.id;
  }
}

for (const tab of tabs) {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const current = tabs.indexOf(tab);
    let next = current;
    if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;

    tabs[next].focus();
    activateTab(tabs[next]);
  });
}

for (const button of document.querySelectorAll('[data-copy-target]')) {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;

    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      const previous = button.textContent;
      button.textContent = button.dataset.copySuccess ?? "Copied";
      window.setTimeout(() => {
        button.textContent = previous;
      }, 1400);
    } catch {
      button.textContent = button.dataset.copyUnavailable ?? "Unavailable";
    }
  });
}

const promptLab = document.querySelector("[data-prompt-lab]");

if (promptLab) {
  void initializePromptLab(promptLab).catch((error) => {
    const status = promptLab.querySelector("[data-prompt-status]");
    if (status) {
      status.textContent = `${promptLab.dataset.loadError ?? "Unable to load the local enhancer."} ${error.message}`;
    }
  });
}

async function initializePromptLab(lab) {
  const {
    MAX_PROMPT_INPUT_LENGTH,
    enhanceNaturalLanguagePrompt,
  } = await import("./prompt-enhancer.js?v=prompt-lab-4");
  const form = lab.querySelector("[data-prompt-form]");
  const input = lab.querySelector("[data-prompt-input]");
  const profile = lab.querySelector("[data-prompt-profile]");
  const language = lab.querySelector("[data-prompt-language]");
  const count = lab.querySelector("[data-prompt-count]");
  const output = lab.querySelector("[data-prompt-output]");
  const resultMeta = lab.querySelector("[data-prompt-result-meta]");
  const questions = lab.querySelector("[data-prompt-questions]");
  const questionsPanel = lab.querySelector("[data-prompt-questions-panel]");
  const status = lab.querySelector("[data-prompt-status]");
  const copyButton = lab.querySelector("[data-prompt-copy]");
  const examples = [...lab.querySelectorAll("[data-prompt-example]")];

  if (
    !form
    || !input
    || !profile
    || !language
    || !count
    || !output
    || !resultMeta
    || !questions
    || !questionsPanel
    || !status
    || !copyButton
  ) {
    throw new Error("Prompt lab markup is incomplete.");
  }

  input.maxLength = MAX_PROMPT_INPUT_LENGTH;

  const updateCount = () => {
    count.textContent = formatTemplate(lab.dataset.countTemplate, {
      count: input.value.length,
      max: MAX_PROMPT_INPUT_LENGTH,
    });
  };

  const render = () => {
    updateCount();

    try {
      const result = enhanceNaturalLanguagePrompt({
        input: input.value,
        profile: profile.value,
        language: language.value,
      });

      output.textContent = result.enhancedPrompt;
      resultMeta.textContent = `${result.profile} · ${result.language}`;
      status.textContent = formatTemplate(lab.dataset.readyTemplate, {
        profile: result.profile,
        language: result.language,
      });
      questions.replaceChildren(
        ...result.clarifyingQuestions.map((question) => {
          const item = document.createElement("li");
          item.textContent = question;
          return item;
        }),
      );
      questionsPanel.hidden = result.clarifyingQuestions.length === 0;
      copyButton.disabled = false;
    } catch (error) {
      output.textContent = "";
      resultMeta.textContent = lab.dataset.waitingLabel ?? "Waiting for input";
      status.textContent = `${lab.dataset.errorPrefix ?? "Check the request:"} ${error.message}`;
      questions.replaceChildren();
      questionsPanel.hidden = true;
      copyButton.disabled = true;
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  input.addEventListener("input", updateCount);
  for (const example of examples) {
    example.addEventListener("click", () => {
      input.value = example.dataset.promptExample ?? "";
      if (example.dataset.promptExampleProfile) {
        profile.value = example.dataset.promptExampleProfile;
      }
      render();
      input.focus();
    });
  }
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.textContent);
      showTemporaryButtonText(copyButton, lab.dataset.copySuccess ?? "Copied");
    } catch {
      showTemporaryButtonText(copyButton, lab.dataset.copyUnavailable ?? "Unavailable");
    }
  });

  render();
}

function formatTemplate(template = "", values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function showTemporaryButtonText(button, text) {
  const previous = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = previous;
  }, 1400);
}
