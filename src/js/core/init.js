import { FOCUSABLE } from "./dom.js";

// CSS 체크박스 모달·드로어(마크업만으로 동작하는 kit 패턴) 향상 — 견본: "스크림·포커스 트랩은 JS 영역".
// 열리면 패널 첫 요소로 포커스, Tab 가두기, Esc 닫기, 닫히면 토글 체크박스로 포커스 복귀.
export function bindToggleOverlays() {
  const panelOf = (t) => t.parentElement?.querySelector(".Catui_modal, .Catui_drawer");
  const onChange = (e) => {
    const t = e.target;
    if (!t.matches?.(".Catui_modal-toggle, .Catui_drawer-toggle")) return;
    if (t.checked) panelOf(t)?.querySelector(FOCUSABLE)?.focus();  // focus()가 스타일을 동기 재계산하므로 바로 호출
    else t.focus();
  };
  const onKey = (e) => {
    const panel = e.target.closest?.(".Catui_modal, .Catui_drawer");
    if (!panel || panel.tagName === "DIALOG") return;   // <dialog>(layer)는 브라우저가 처리
    const toggle = panel.parentElement?.querySelector(".Catui_modal-toggle, .Catui_drawer-toggle");
    if (!toggle) return;
    if (e.key === "Escape") {
      toggle.checked = false;
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (e.key !== "Tab") return;
    const list = [...panel.querySelectorAll(FOCUSABLE)];
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  // 닫기 라벨(label.Catui_close / 취소 label)도 키보드로: 포커스 가능하게 + Enter/Space
  const onKeyLabel = (e) => {
    const lab = e.target.closest?.(".Catui_modal label[for], .Catui_drawer label[for]");
    if (!lab || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    lab.click();
  };
  const prepare = (scope = document) => scope.querySelectorAll(".Catui_modal label[for]:not([tabindex]), .Catui_drawer label[for]:not([tabindex])").forEach((l) => {
    l.tabIndex = 0;
    if (!l.matches(".Catui_btn")) l.setAttribute("role", "button");
  });
  prepare();
  document.addEventListener("change", onChange);
  document.addEventListener("keydown", onKey);
  document.addEventListener("keydown", onKeyLabel);
  return {
    prepare,
    off() {
      document.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keydown", onKeyLabel);
    },
  };
}
