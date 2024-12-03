// ==UserScript==
// @name         Old Feed
// @namespace    https://gerritbirkeland.com/
// @version      0.14.0-fork-andy0130tw.2
// @updateURL    https://raw.githubusercontent.com/andy0130tw/old-github-feed/main/old-feed.user.js
// @downloadURL  https://raw.githubusercontent.com/andy0130tw/old-github-feed/main/old-feed.user.js
// @description  Restores the Following/For You buttons to let you pick your feed
// @author       Gerrit Birkeland
// @match        https://github.com/
// @match        https://github.com/dashboard
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const feedContainer = document.querySelector("#dashboard feed-container");
    // Apparently if this isn't true, then an SSO popup is being shown, so don't do anything.
    if (!feedContainer) return;

    const columnContainer = document.querySelector(".feed-content");
    columnContainer.classList.remove("flex-justify-center");
    columnContainer.style.maxWidth = "100vw";
    const feedColumn = columnContainer.querySelector(".feed-main");
    feedColumn.style.maxWidth = "100vw";

    if (feedColumn.children.length != 2) {
        console.warn("[Old Feed] Page does not have expected structure, please report an issue");
        return;
    }

    const news = document.querySelector("#dashboard .news");

    function getDashboardCacheStorageKey(uid) {
      return `dashboardCache:${uid ?? '?'}`;
    }

    function probeDataPropContainingUid() {
      const hydroView = followingFeedWrapper.querySelector('[data-repository-hovercards-enabled] > [data-hydro-view]');
      if (hydroView) return hydroView.dataset.hydroView;
      const hydroClick = followingFeedWrapper.querySelector('[data-hydro-click]');
      if (hydroClick) return hydroClick.dataset.hydroClick;
      // not found
      return null;
    }

    // !!! prevent reinitialization during navigations
    const followingFeedWrapper = document.querySelector('#old-feed-following-feed') ?? document.createElement("div");
    if (followingFeedWrapper.parentNode == null) {
      // XXX: not sure if this way works on every account
      const cacheKey = getDashboardCacheStorageKey(document.querySelector('meta[name="octolytics-actor-id"]')?.content);
      followingFeedWrapper.id = 'old-feed-following-feed';
      followingFeedWrapper.innerHTML = localStorage.getItem(cacheKey) || "";
      news.appendChild(followingFeedWrapper);
    }

    const existingPicker = document.querySelector('#old-feed-picker');
    const picker = existingPicker ?? document.createElement("div");
    if (picker.parentNode == null) {
      news.insertBefore(picker, feedContainer);
    }
    picker.innerHTML = `
        <div class="mb-3" id="old-feed-picker">
            <nav class="overflow-hidden UnderlineNav">
                <ul class="UnderlineNav-body">
                    <li class="d-inline-flex">
                        <a data-show="following" class="feed-button UnderlineNav-item selected">
                            <span data-content="Following">Following</span>
                        </a>
                    </li>
                    <li class="d-inline-flex">
                        <a data-show="forYou" class="feed-button UnderlineNav-item">
                            <span data-content="For You">For You</span>
                        </a>
                    </li>
                </ul>
                <ul class="UnderlineNav-body" style="display: none !important;">
                    <li class="d-inline-flex">
                        <span class="loader">Loading...</span>
                    </li>
                </ul>
            </nav>
        </div>
    `;

    // !!!
    const loadingIndicator = document.createElement('div') // picker.querySelector(".loader");

    // FIXME: which variable is for background color of ".feed-background" depends on theme;
    //        it is not always "--bgColor-inset"
    loadingIndicator.style = `position: absolute;
      top: 0; left: 0; right: 0; z-index: 99;
      pointer-events: none;
      font-size: 24px;
      text-align: center;
      padding: 16px 0 96px;
      transition: opacity 150ms ease-out;
      background: linear-gradient(0deg, transparent, var(--bgColor-inset, var(--color-canvas-inset)) 60%);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;`
    loadingIndicator.innerHTML = `
      <picture>
        <img style="width: 48px; display: block" src="https://github.githubassets.com/assets/mona-loading-dimmed-5da225352fd7.gif">
      </picture>
      <div>Loading...</div>`
    news.style.position = 'relative'
    news.insertBefore(loadingIndicator, feedContainer)

    const tabs = { following: followingFeedWrapper, forYou: feedContainer };
    picker.addEventListener("click", event => {
        const target = event.target.closest("a");
        if (target == null) return;

        Object.entries(tabs).forEach(([name, el]) => {
            el.style.display = name === target.dataset.show ? "block" : "none";
        });

        picker.querySelectorAll(".feed-button").forEach(button => {
            button.classList.remove("selected");
        });
        target.classList.add("selected");

        localStorage.setItem("dashboardActiveButton", target.dataset.show);
    });
    picker.querySelector(`[data-show=${localStorage.getItem("dashboardActiveButton") || "following"}]`).click();

    let userHasLoadedMore = false;
    fetchDashboard();

    // GitHub updates the feed every minute unless the user has loaded more, so we'll do the same.
    setInterval(() => {
        if (userHasLoadedMore === false) {
            fetchDashboard();
        }
    }, 60000);

    async function fetchDashboard() {
        // !!!
        const getContentArea = () => news.querySelector('.news > *:last-child')
        loadingIndicator.style.opacity = 1;
        getContentArea().style.opacity = .6;

        const r = await fetch(`https://github.com/dashboard-feed?page=1`, { headers: { "X-Requested-With": "XMLHttpRequest" } })
        const html = await r.text()

        // !!!
        getContentArea().style.opacity = 1;
        loadingIndicator.style.opacity = 0;
        // loadingIndicator.textContent = "";

        followingFeedWrapper.innerHTML = html;
        followingFeedWrapper.querySelector(".ajax-pagination-btn")?.addEventListener("click", () => {
            userHasLoadedMore = true;
        });

        // !!!
        let uid
        try {
          const data = probeDataPropContainingUid();
          if (data != null) uid = JSON.parse(data).payload.user_id;
        } catch (e) {
          console.warn('[old-github-feed] Failed to extract uid from dashboard feed', e);
        }
        const cacheKey = getDashboardCacheStorageKey(uid);

        // Apply pretty paddings for feeds.
        followingFeedWrapper.querySelector(".body .py-4")?.style.setProperty('padding-top', 'var(--base-size-4, 4px)', 'important');
        followingFeedWrapper.querySelectorAll(".body .py-4").forEach((e) => {
            e.classList.remove("py-4");
            e.classList.add("py-3");
        });
        // Apply the same foreground color for texts.
        followingFeedWrapper.querySelectorAll(".body > div > div > div.color-fg-muted").forEach((e) => {
            if (!e.nextElementSibling) {
                e.querySelector("div").classList.add("color-fg-default");
            }
        });
        // Apply box for non-boxed items.
        followingFeedWrapper.querySelectorAll(".body > .d-flex > .d-flex > div > div[class=color-fg-default]").forEach((e) => {
            e.classList.add("Box");
            e.classList.add("p-3");
            e.classList.add("mt-2");
        });
        /// Apply same colors for feeds.
        followingFeedWrapper.querySelectorAll("div.Box.color-bg-overlay").forEach((e) => {
            e.classList.remove("color-bg-overlay");
            e.classList.remove("color-shadow-medium");
            e.classList.add("feed-item-content");
            e.classList.add("border");
            e.classList.add("color-border-default");
            e.classList.add("color-shadow-small");
            e.classList.add("rounded-2");
            const markdownBody = e.querySelector("div.color-fg-muted.comment-body.markdown-body");
            if (markdownBody) {
                markdownBody.classList.remove("color-fg-muted");
            }
        });
        // Saving the edited content for the cache.
        localStorage.setItem(cacheKey, followingFeedWrapper.innerHTML);
    }
})();
