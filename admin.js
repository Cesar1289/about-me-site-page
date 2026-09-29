/*
 * About Me Website - Admin dashboard JavaScript
 * Cesar Espitia
 *
 * Handles:
 *  - Admin password login (token kept in memory only - never localStorage)
 *  - Loading contact messages from the server
 *  - Summary values: Total, New, Replied, Reply Rate
 *  - Bar chart: Messages by Reason for Contact (custom SVG, updates with data)
 *  - Filters: All / New / Replied
 *  - Mark as Replied operation
 *  - Logout and refresh
 */

(function () {
  // Admin session token lives in memory only (lost on refresh = logged out)
  var adminToken = null;
  var allMessages = [];
  var currentFilter = "all";

  var REASONS = ["Comment", "Question", "Partnership", "Opportunity", "Other"];

  /* ---------------- Element helpers ---------------- */

  function $(id) {
    return document.getElementById(id);
  }

  function formatDate(iso) {
    if (!iso) return "N/A";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  }

  /* ---------------- Auth / API ---------------- */

  function apiHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + adminToken,
    };
  }

  function login(event) {
    event.preventDefault();
    var password = $("admin-password").value;
    var msg = $("login-message");
    msg.className = "form-message";
    $("login-btn").disabled = true;

    fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password }),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (result) {
        $("login-btn").disabled = false;
        if (result.ok && result.body.token) {
          adminToken = result.body.token; // memory only
          $("admin-password").value = "";
          showDashboard();
        } else {
          msg.textContent =
            (result.body && result.body.error) || "Incorrect password.";
          msg.className = "form-message visible error";
        }
      })
      .catch(function () {
        $("login-btn").disabled = false;
        msg.textContent = "Could not reach the server. Please try again.";
        msg.className = "form-message visible error";
      });
    return false;
  }

  function logout() {
    adminToken = null;
    allMessages = [];
    $("login-view").classList.remove("hidden");
    $("dashboard-view").classList.add("hidden");
  }

  function showDashboard() {
    $("login-view").classList.add("hidden");
    $("dashboard-view").classList.remove("hidden");
    loadMessages();
  }

  /* ---------------- Data loading ---------------- */

  function loadMessages() {
    var loading = $("loading-bar");
    if (loading) loading.classList.remove("hidden");

    fetch("/api/admin/messages", { headers: apiHeaders() })
      .then(function (res) {
        if (res.status === 401) {
          logout();
          throw new Error("unauthorized");
        }
        return res.json();
      })
      .then(function (body) {
        allMessages = body.messages || [];
        render();
      })
      .catch(function (err) {
        if (err.message !== "unauthorized") {
          alert("Failed to load messages. Please refresh and try again.");
        }
      })
      .finally(function () {
        if (loading) loading.classList.add("hidden");
      });
  }

  /* ---------------- Rendering ---------------- */

  function render() {
    renderStats();
    renderChart();
    renderList();
  }

  function renderStats() {
    var total = allMessages.length;
    var repliedCount = allMessages.filter(function (m) {
      return m.replied === true;
    }).length;
    var newCount = total - repliedCount;
    var replyRate = total > 0 ? Math.round((repliedCount / total) * 1000) / 10 : 0;

    $("stat-total").textContent = total;
    $("stat-new").textContent = newCount;
    $("stat-replied").textContent = repliedCount;
    $("stat-rate").textContent = replyRate + "%";
  }

  /* Custom SVG bar chart: Messages by Reason for Contact.
     Built entirely from the current data, so it updates whenever the data changes. */
  function renderChart() {
    var counts = {};
    REASONS.forEach(function (r) {
      counts[r] = 0;
    });
    allMessages.forEach(function (m) {
      if (counts[m.reason] !== undefined) counts[m.reason]++;
    });

    var values = REASONS.map(function (r) {
      return counts[r];
    });
    var maxVal = Math.max.apply(null, values.concat([1]));

    var chartW = 700;
    var chartH = 300;
    var padL = 40;
    var padB = 50;
    var padT = 20;
    var plotW = chartW - padL - 20;
    var plotH = chartH - padT - padB;
    var gap = plotW / REASONS.length;
    var barW = gap * 0.6;

    var svg = '<svg class="chart-svg" viewBox="0 0 ' + chartW + " " + chartH + '" role="img" aria-label="Messages by Reason for Contact">';
    svg += '<defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">';
    svg += '<stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#6366f1"/>';
    svg += "</linearGradient></defs>";

    // Gridlines + y-axis labels
    for (var i = 0; i <= 4; i++) {
      var y = padT + plotH - (plotH * i) / 4;
      var val = Math.round((maxVal * i) / 4);
      svg +=
        '<line x1="' + padL + '" y1="' + y + '" x2="' + (chartW - 20) + '" y2="' + y +
        '" stroke="#334155" stroke-width="1" stroke-dasharray="4 4"/>' +
        '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" fill="#94a3b8" font-size="12" text-anchor="end">' +
        val + "</text>";
    }

    // Bars + value labels + category labels
    REASONS.forEach(function (reason, idx) {
      var count = counts[reason];
      var barH = (count / maxVal) * plotH;
      var x = padL + gap * idx + (gap - barW) / 2;
      var y = padT + plotH - barH;
      svg +=
        '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH +
        '" rx="8" fill="url(#barGrad)"><title>' + reason + ": " + count +
        "</title></rect>";
      if (count > 0) {
        svg +=
          '<text x="' + (x + barW / 2) + '" y="' + (y - 6) + '" fill="#e2e8f0" font-size="14" font-weight="bold" text-anchor="middle">' +
          count + "</text>";
      }
      svg +=
        '<text x="' + (x + barW / 2) + '" y="' + (chartH - 24) + '" fill="#94a3b8" font-size="13" text-anchor="middle">' +
        reason + "</text>";
    });

    svg += "</svg>";

    var chartBox = document.getElementById("reason-chart");
    if (chartBox) chartBox.innerHTML = svg;
  }

  function renderList() {
    var listEl = $("message-list");
    listEl.innerHTML = "";

    var filtered = allMessages.filter(function (m) {
      if (currentFilter === "new") return m.replied === false;
      if (currentFilter === "replied") return m.replied === true;
      return true; // all
    });

    if (filtered.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state">No messages in this view yet.</div>';
      return;
    }

    filtered.forEach(function (m) {
      var isReplied = m.replied === true;
      var card = document.createElement("article");
      card.className = "message-card" + (isReplied ? " replied" : "");

      var top = document.createElement("div");
      top.className = "message-top";
      top.innerHTML =
        "<strong>" + escapeHtml(m.firstName) + " " + escapeHtml(m.lastName) +
        "</strong>" +
        '<span class="status-badge ' + (isReplied ? "replied" : "new") + '">' +
        (isReplied ? "Replied" : "New") +
        "</span>";

      var meta = document.createElement("div");
      meta.className = "message-meta";
      meta.innerHTML =
        "<span>📧 " + escapeHtml(m.email) + "</span>" +
        "<span>🏷️ Reason: " + escapeHtml(m.reason) + "</span>" +
        "<span>🕒 Received: " + escapeHtml(formatDate(m.submittedAt)) + "</span>" +
        (isReplied && m.repliedAt
          ? "<span>✅ Replied at: " + escapeHtml(formatDate(m.repliedAt)) + "</span>"
          : "");

      var body = document.createElement("div");
      body.className = "message-body";
      body.textContent = m.message;

      var actions = document.createElement("div");
      actions.className = "message-actions";

      if (!isReplied) {
        var btn = document.createElement("button");
        btn.className = "btn-small";
        btn.textContent = "Mark as Replied";
        btn.addEventListener("click", function () {
          markReplied(m.id, btn);
        });
        actions.appendChild(btn);
      } else {
        var note = document.createElement("span");
        note.style.color = "#94a3b8";
        note.style.fontSize = "0.88rem";
        note.textContent = "This message has been replied to.";
        actions.appendChild(note);
      }

      card.appendChild(top);
      card.appendChild(meta);
      card.appendChild(body);
      card.appendChild(actions);
      listEl.appendChild(card);
    });
  }

  function markReplied(id, btn) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Updating...";
    }

    fetch("/api/admin/messages/" + encodeURIComponent(id) + "/replied", {
      method: "PATCH",
      headers: apiHeaders(),
    })
      .then(function (res) {
        if (res.status === 401) {
          logout();
          throw new Error("unauthorized");
        }
        return res.json();
      })
      .then(function (body) {
        // Replace the stored record so stats and chart re-calculate
        var updated = body.record;
        allMessages = allMessages.map(function (m) {
          return m.id === updated.id ? updated : m;
        });
        render();
      })
      .catch(function (err) {
        if (err.message !== "unauthorized") {
          alert("Failed to mark the message as replied. Please try again.");
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Mark as Replied";
          }
        }
      });
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    var div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  /* ---------------- Filters ---------------- */

  function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll(".filter-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-filter") === filter);
    });
    renderList();
  }

  /* ---------------- Init ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    var loginForm = $("login-form");
    if (loginForm) loginForm.addEventListener("submit", login);

    var logoutBtn = $("logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", logout);

    var refreshBtn = $("refresh-btn");
    if (refreshBtn) refreshBtn.addEventListener("click", loadMessages);

    document.querySelectorAll(".filter-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        setFilter(b.getAttribute("data-filter"));
      });
    });
  });
})();
