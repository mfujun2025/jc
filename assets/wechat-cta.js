/* ==========================================================================
   微信留资入口 —— 一键复制微信号 + 微信客服入口
   · 用事件委托绑定，不依赖内联 onclick（避免函数未定义时报 ReferenceError）
   · 复制优先用 navigator.clipboard（需 HTTPS），失败回退 execCommand
   · 两条路都失败时，把微信号选中，用户可手动复制
   · JS 就绪后给卡片加 .wx-ready，隐藏「手动复制」兜底提示
   · 客服入口按环境切换：微信内走直链，非微信显示二维码（卡片）/ 弹层（紧凑变体）
   ========================================================================== */
(function () {
    'use strict';

    var FEEDBACK_MS = 1700;
    var KF_QR = '/assets/wechat-kf-qr.png';

    /* ---- 环境判定：给 <html> 加 class，CSS 据此切换客服入口形态 ----
       放在最前面执行。kfid 链接（work.weixin.qq.com/kfid/...）在不同环境表现完全不同：

         · 微信内      → 点直链一步进客服会话                    → 给直链按钮
         · 桌面浏览器  → 点直链会执行 weixin:// 协议跳转，电脑上没这个协议，
                        大概率白屏；正确做法是就地显示二维码让用户扫   → 给二维码
         · 手机浏览器  → 能唤起微信 App（iOS 会弹「在"微信"中打开？」）→ 给直链按钮
                        （手机上显示二维码是没用的，用户扫不了自己这块屏幕）

       默认态（CSS 里）是二维码：即使本脚本没跑起来，桌面用户也不会被导向白屏。
       代价是手机用户会先看到二维码再被切成按钮——卡片在页面底部，
       用户滚到那里时脚本早已执行完，实际不会看到闪动。 */
    var ua = navigator.userAgent;
    var inWechat = /MicroMessenger/i.test(ua);
    var isMobile = /Android|iPhone|iPad|iPod|Windows Phone|HarmonyOS|BlackBerry|Mobile/i.test(ua)
                   || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));  // iPadOS 伪装成 Mac

    var rootClass = document.documentElement.className;
    if (inWechat) { rootClass += (rootClass ? ' ' : '') + 'in-wechat'; }
    if (isMobile) { rootClass += (rootClass ? ' ' : '') + 'is-mobile'; }
    document.documentElement.className = rootClass;

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

    /* ---- 客服入口：非微信环境下，点紧凑入口弹二维码 ----
       全尺寸卡片里二维码是直接铺开的，不需要弹层；
       但 design 工具页顶栏那种紧凑位置放不下二维码，
       所以在那里（带 data-kf）点一下弹出来。 */
    var pop = null;

    function closePop() {
        if (pop && pop.parentNode) { pop.parentNode.removeChild(pop); }
        pop = null;
    }

    function openPop(anchor) {
        closePop();
        pop = document.createElement('div');
        pop.className = 'wx-kf-pop';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-label', '微信扫码咨询客服');
        pop.innerHTML = '<img src="' + KF_QR + '" width="168" height="168"'
                      + ' alt="微信扫码联系卷尺定制客服">'
                      + '<span>微信扫码 · 咨询客服</span>';
        document.body.appendChild(pop);

        var r = anchor.getBoundingClientRect();
        var vw = document.documentElement.clientWidth;
        var sx = window.pageXOffset || document.documentElement.scrollLeft || 0;
        var sy = window.pageYOffset || document.documentElement.scrollTop || 0;

        var left = r.left + sx + r.width / 2 - pop.offsetWidth / 2;
        left = Math.max(sx + 8, Math.min(left, sx + vw - pop.offsetWidth - 8));

        var top = r.bottom + sy + 10;
        /* 下方放不下就翻到上方 */
        if (r.bottom + pop.offsetHeight + 20 > window.innerHeight && r.top > pop.offsetHeight + 20) {
            top = r.top + sy - pop.offsetHeight - 10;
        }
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
        pop._anchor = anchor;
    }

    document.addEventListener('click', function (e) {
        /* 点在弹层自己身上：不关 */
        if (pop && pop.contains(e.target)) { return; }

        var el = e.target;
        while (el && el !== document) {
            if (el.hasAttribute && el.hasAttribute('data-kf')) {
                /* 微信内 / 手机上：让浏览器走原生链接（微信内直接进会话，
                   手机上会唤起微信 App）。只有电脑浏览器才需要弹二维码，
                   因为电脑上没有 weixin:// 协议，跳过去是白屏。 */
                if (inWechat || isMobile) { return; }
                e.preventDefault();
                if (pop && pop._anchor === el) { closePop(); } else { openPop(el); }
                return;
            }
            el = el.parentNode;
        }
        /* 点别处一律收起 */
        closePop();
    }, false);

    window.addEventListener('resize', closePop);
    window.addEventListener('scroll', closePop, true);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) { closePop(); }
    });

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
