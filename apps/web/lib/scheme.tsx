import type { ReactNode } from "react";

/**
 * The reader's color scheme, the same control markset.org, intentset.org and the old page have: three radio inputs
 * read by body:has() in door.css, with every color resolved through color-scheme. Auto is checked, so a reader who
 * never touches it keeps the system's preference. Each option is an icon with its word kept in the accessibility tree.
 */
const Icon = ({ children, fill = false }: { children: ReactNode; fill?: boolean }) => (
  <svg
    className="site-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke={fill ? undefined : "currentColor"}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const options = [
  {
    id: "auto",
    title: "Match the system",
    word: "Auto",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none" />
      </Icon>
    ),
  },
  {
    id: "light",
    title: "Light",
    word: "Light",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
      </Icon>
    ),
  },
  {
    id: "dark",
    title: "Dark",
    word: "Dark",
    icon: (
      <Icon>
        <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z" />
      </Icon>
    ),
  },
] as const;

export const SchemeControl = () => (
  // biome-ignore lint/a11y/useSemanticElements: a fieldset draws a border and a legend; this is a compact pill of icons.
  <div className="site-scheme" role="group" aria-label="Color scheme">
    {options.map((option) => (
      <span key={option.id} className="site-scheme-choice">
        <input
          type="radio"
          name="ms-scheme"
          id={`ms-scheme-${option.id}`}
          className="site-scheme-input"
          defaultChecked={option.id === "auto"}
        />
        <label className="site-scheme-option" htmlFor={`ms-scheme-${option.id}`} title={option.title}>
          {option.icon}
          <span className="site-visually-hidden">{option.word}</span>
        </label>
      </span>
    ))}
  </div>
);

/**
 * The page's one script, and all it does is remember the reader's scheme across a reload, which no CSS can do. It is
 * not tracking: it stores one word in the reader's own browser and sends nothing anywhere. It writes data-scheme on
 * <body>, the hook markset.css publishes, and runs first so the scheme is in force before anything paints.
 */
export const schemeScript = `(function () {
  var key = "ms-scheme";
  var read = function () {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };
  var apply = function (value) {
    if (value === "light" || value === "dark") document.body.dataset.scheme = value;
    else delete document.body.dataset.scheme;
  };
  apply(read());
  document.addEventListener("change", function (event) {
    var input = event.target;
    if (!input || input.name !== key) return;
    var value = input.id.slice(key.length + 1);
    apply(value);
    try {
      if (value === "auto") localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {}
  });
  document.addEventListener("DOMContentLoaded", function () {
    var value = read();
    var input = document.getElementById(key + "-" + (value === "light" || value === "dark" ? value : "auto"));
    if (input) input.checked = true;
  });
})();`;
