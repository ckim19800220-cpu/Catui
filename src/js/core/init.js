import { focusables, imeBusy } from "./dom.js";

// CSS 체크박스 모달·드로어(마크업만으로 동작하는 kit 패턴) 향상 — 견본: "스크림·포커스 트랩은 JS 영역".
// 열리면 패널 첫 요소로 포커스, Tab 가두기, Esc 닫기, 닫히면 토글 체크박스로 포커스 복귀.
export function bindToggleOverlays() {
  const TOGGLE = ".Catui_modal-toggle, .Catui_drawer-toggle";
  const PANEL = ".Catui_modal, .Catui_drawer";
  // CSS가 `토글:checked ~ 패널` 형제 선택자이므로, 토글 다음 형제 중 첫 패널 / 패널 앞 형제 중 가장 가까운 토글이 짝이다
  const panelOf = (t) => { for (let n = t.nextElementSibling; n; n = n.nextElementSibling) { if (n.matches(TOGGLE)) return null; if (n.matches(PANEL)) return n; } return null; };
  const openToggles = () => [...document.querySelectorAll(TOGGLE)].filter((t) => t.checked && panelOf(t));
  const close = (t) => { t.checked = false; t.dispatchEvent(new Event("change", { bubbles: true })); };

  const onChange = (e) => {
    const t = e.target;
    if (!t.matches?.(TOGGLE)) return;
    const panel = panelOf(t);
    if (t.checked) { if (panel) (focusables(panel)[0] || panel).focus({ preventScroll: true }); }  // focus()가 스타일을 동기 재계산하므로 바로 호출
    else if (!panel || panel.contains(document.activeElement) || document.activeElement === document.body) t.focus({ preventScroll: true });
  };
  const onKey = (e) => {
    if (e.key !== "Escape" && e.key !== "Tab") return;
    if (e.key === "Escape" && imeBusy(e)) return;          // 한글 조합 중(·직후) Esc는 조합 취소일 뿐
    if (e.target.closest?.("dialog")) return;            // <dialog>(layer)는 브라우저가 처리
    const open = openToggles();
    if (!open.length) return;
    const toggle = open[open.length - 1];                 // 문서 순서상 마지막 = 위에 그려진 패널
    const panel = panelOf(toggle);
    if (e.key === "Escape") {
      if (e.defaultPrevented) return;                     // 패널 안 드롭다운·달력이 먼저 Esc를 썼으면 패널은 그대로
      e.preventDefault();
      close(toggle);
      return;
    }
    const list = focusables(panel);
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0], last = list[list.length - 1], active = document.activeElement;
    if (!panel.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  // 닫기 라벨(label.Catui_close / 취소 label)도 키보드로: 포커스 가능하게 + Enter/Space
  const onKeyLabel = (e) => {
    const lab = e.target.closest?.(".Catui_modal label[for], .Catui_drawer label[for]");
    if (!lab || imeBusy(e) || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    lab.click();
  };
  const prepare = (scope = document) => {
    scope.querySelectorAll?.(".Catui_modal label[for]:not([tabindex]), .Catui_drawer label[for]:not([tabindex])").forEach((l) => {
      l.tabIndex = 0;
      if (!l.matches(".Catui_btn")) l.setAttribute("role", "button");
    });
    scope.querySelectorAll?.(PANEL).forEach((p) => { if (!p.hasAttribute("tabindex")) p.tabIndex = -1; });   // 포커스할 요소가 없는 패널도 포커스 받게
  };
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
