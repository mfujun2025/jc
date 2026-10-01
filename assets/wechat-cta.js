/* ==========================================================================
   微信留资入口 —— 一键复制微信号
   · 用事件委托绑定，不依赖内联 onclick（避免函数未定义时报 ReferenceError）
   · 复制优先用 navigator.clipboard（需 HTTPS），失败回退 execCommand
   · 两条路都失败时，把微信号选中，用户可手动复制
   · JS 就绪后给卡片加 .wx-ready，隐藏「手动复制」兜底提示
   ========================================================================== */
(function () {
    'use strict';

    var FEEDBACK_MS = 1700;

    /* ---- 兜底复制：临时 textarea + execCommand ---- */
    function legacyCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:absolute;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(ta);

        var sel = document.getSelection();
        var saved = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : null;

        ta.select();
        if (ta.setSelectionRange) { ta.setSelectionRange(0, ta.value.length); }

        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }

        document.body.removeChild(ta);
        if (saved && sel) { sel.removeAllRanges(); sel.addRange(saved); }
        return ok;
    }

    /* ---- 选中微信号本体，便于用户手动复制 ---- */
    function selectIdText(btn) {
        try {
            var target = btn.querySelector('.wx-cta__id-txt') || btn;
            var range = document.createRange();
            range.selectNodeContents(target);
            var sel = document.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) { /* 忽略 */ }
    }

    /* ---- 按钮反馈 ---- */
    function feedback(btn, ok) {
        var tag = btn.querySelector('.wx-cta__id-tag');
        if (!tag) { return; }
        if (!btn.getAttribute('data-wx-orig')) {
            btn.setAttribute('data-wx-orig', tag.textContent);
        }
        tag.textContent = ok ? '已复制 ✓' : '请手动选中';
        if (ok) { btn.classList.add('is-copied'); }

        clearTimeout(btn._wxTimer);
        btn._wxTimer = setTimeout(function () {
            tag.textContent = btn.getAttribute('data-wx-orig') || '复制';
            btn.classList.remove('is-copied');
        }, FEEDBACK_MS);
    }

    /* ---- 主逻辑 ---- */
    function copyWechat(btn) {
        var text = (btn.getAttribute('data-wx') || '').trim();
        if (!text) { return; }

        function finish(ok) {
            feedback(btn, ok);
            if (!ok) { selectIdText(btn); }
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(
                function () { finish(true); },
                function () { finish(legacyCopy(text)); }
            );
        } else {
            finish(legacyCopy(text));
        }
    }

    /* ---- 事件委托 ----
       凡带 data-wx 属性的元素都是「一键复制微信号」按钮（全尺寸卡片与紧凑变体通吃） */
    document.addEventListener('click', function (e) {
        var el = e.target;
        while (el && el !== document) {
            if (el.getAttribute && el.getAttribute('data-wx')) {
                e.preventDefault();
                copyWechat(el);
                return;
            }
            el = el.parentNode;
        }
    }, false);

    /* ---- JS 就绪标记 ----
       注意：本文件是 defer 脚本，前面可能还有别的 defer 外链脚本（如统计代码）。
       若某个外链脚本慢/挂，DOMContentLoaded 会被拖住，只挂 DOMContentLoaded 就迟迟不执行。
       因此：立即跑一次 + DOMContentLoaded + load 各兜一次。重复加 class 无副作用。 */
    function markReady() {
        var ids = document.querySelectorAll('.wx-cta__id');
        for (var i = 0; i < ids.length; i++) {
            var node = ids[i].parentNode;
            while (node && node !== document) {
                if (node.classList && node.classList.contains('wx-cta__card')) {
                    node.classList.add('wx-ready');
                    break;
                }
                node = node.parentNode;
            }
        }
    }

    markReady();                                   // 立即（本脚本在卡片之后，DOM 已就绪）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', markReady);
    }
    window.addEventListener('load', markReady);
})();
