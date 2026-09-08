import { render as renderA } from "@conqueso/fe-mfe-a";

export function render(root: HTMLElement, props: Record<string, unknown>) {
  const container = document.createElement("div");
  container.style.border = "2px solid var(--accent)";
  container.style.padding = "1rem";
  container.innerHTML = `<h3>MFE-B</h3><div id="mfe-a-root"></div>`;
  root.appendChild(container);

  const aRoot = container.querySelector("#mfe-a-root") as HTMLElement;
  const unmountA = renderA(aRoot, { name: (props.name as string) ?? "MFE-B" });

  return () => {
    unmountA();
    container.remove();
  };
}
