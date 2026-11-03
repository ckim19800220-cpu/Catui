// widgets — 투표 · 핫딜 남은 시간 · 상대 시간 갱신
//   <form data-catui-cm-poll="poll-1301">  투표: 한 번만(기억), 참여 후 결과 막대(비율은 표 수에서 계산), 결과 보기 버튼
//   <time data-catui-cm-until="ISO">       핫딜 남은 시간 "3시간 12분 남음" / "종료" (1분마다)
//   <time data-catui-cm-ago="ISO">         "5분 전" (1분마다)
community.widgets = {
  // 남은 시간·상대 시간 글자 갱신 (목록을 다시 그린 뒤에도 부른다)
  tick(scope = document) {
    scope.querySelectorAll("[data-catui-cm-until]").forEach((t) => {
      const left = new Date(t.getAttribute("data-catui-cm-until")) - community.now();
      const h = Math.floor(left / 36e5), m = Math.floor((left % 36e5) / 6e4);
      t.textContent = left <= 0 ? "종료" : h >= 24 ? `${Math.floor(h / 24)}일 남음` : h ? `${h}시간 ${m}분 남음` : `${m}분 남음`;
      t.closest("[data-catui-cm-deal]")?.toggleAttribute("data-ended", left <= 0);
    });
    scope.querySelectorAll("[data-catui-cm-ago]").forEach((t) => { t.textContent = community.ago(t.getAttribute("data-catui-cm-ago")); });
  },
  init(root) {
    root.querySelectorAll("form[data-catui-cm-poll]").forEach((f) => this.poll(f));
    this.tick(root);
    const id = setInterval(() => this.tick(root), 6e4);
    community._offs.push(() => clearInterval(id));
  },
  poll(f) {
    const name = f.getAttribute("data-catui-cm-poll");
    community.data(name).then((poll) => {
      const mine = () => cmGet("polls", {})[name];
      const draw = (showResult) => {
        const voted = mine(), votes = poll.options.map((o, i) => o.votes + (voted === i ? 1 : 0)), total = votes.reduce((a, b) => a + b, 0);
        const done = new Date(poll.until) < community.now();
        if (voted != null || showResult || done) {
          catui.mount(f, catui.html`<fieldset><legend class="Catui_label">${poll.question}</legend>
            <ul class="Catui_cm-poll-res">${poll.options.map((o, i) => { const pct = total ? Math.round(votes[i] / total * 100) : 0; return catui.html`<li${voted === i ? catui.html` aria-current="true"` : ""}><span class="Catui_cm-poll-lab">${o.label}${voted === i ? catui.html` <span class="Catui_badge Catui_badge-success">내 선택</span>` : ""}</span><span class="Catui_cm-poll-bar" role="img" aria-label="${o.label} ${pct}퍼센트, ${votes[i]}표"><i style="width:${pct}%"></i></span><span class="Catui_num">${pct}% · ${catui.util.number(votes[i])}표</span></li>`; })}</ul>
            <p class="Catui_help">${catui.util.number(total)}명 참여 · ${done ? "마감" : `${community.ago(poll.until).replace(" 전", "")} 마감`}</p>
            ${voted == null && !done ? catui.html`<button class="Catui_btn Catui_btn-sm Catui_btn-ghost" type="button" data-back>투표하러 돌아가기</button>` : ""}</fieldset>`);
          return;
        }
        catui.mount(f, catui.html`<fieldset><legend class="Catui_label">${poll.question}</legend>
          <div class="Catui_vstack Catui_gap-1">${poll.options.map((o, i) => catui.html`<label class="Catui_choice"><input class="Catui_clip" type="radio" name="${name}" value="${i}"><span class="Catui_radio"></span>${o.label}</label>`)}</div>
          <div class="Catui_actions"><button class="Catui_btn Catui_btn-md Catui_btn-primary" type="submit">투표하기</button><button class="Catui_btn Catui_btn-md Catui_btn-ghost" type="button" data-result>결과 보기</button></div></fieldset>`);
      };
      community._on(f, "submit", (e) => {
        e.preventDefault();
        const v = f.querySelector("input:checked");
        if (!v) { catui.layer.msg("항목을 골라 주세요", { icon: "warn" }); return; }
        cmSet("polls", { ...cmGet("polls", {}), [name]: Number(v.value) });
        draw(true); community.emit("poll", { name, choice: Number(v.value) });
        f.querySelector("ul")?.setAttribute("tabindex", "-1"); f.querySelector("ul")?.focus();
      });
      community._on(f, "click", (e) => { if (e.target.closest("[data-result]")) draw(true); if (e.target.closest("[data-back]")) draw(false); });
      draw(false);
    }).catch(() => {});
  },
};
