(function () {
  "use strict";

  var storageKey = "daily-expense-tracker-records";
  var expenses = loadExpenses();

  var elements = {
    form: document.getElementById("expenseForm"),
    expenseId: document.getElementById("expenseId"),
    formTitle: document.getElementById("formTitle"),
    date: document.getElementById("dateInput"),
    description: document.getElementById("descriptionInput"),
    amount: document.getElementById("amountInput"),
    category: document.getElementById("categoryInput"),
    note: document.getElementById("noteInput"),
    submit: document.getElementById("submitButton"),
    reset: document.getElementById("resetFormButton"),
    search: document.getElementById("searchInput"),
    categoryFilter: document.getElementById("categoryFilter"),
    fromFilter: document.getElementById("fromFilter"),
    toFilter: document.getElementById("toFilter"),
    tableBody: document.getElementById("expenseTableBody"),
    emptyState: document.getElementById("emptyState"),
    totalSpent: document.getElementById("totalSpent"),
    monthSpent: document.getElementById("monthSpent"),
    entryCount: document.getElementById("entryCount"),
    topCategory: document.getElementById("topCategory")
  };

  elements.date.value = today();
  render();

  elements.form.addEventListener("submit", saveExpense);
  elements.reset.addEventListener("click", resetForm);
  elements.search.addEventListener("input", render);
  elements.categoryFilter.addEventListener("change", render);
  elements.fromFilter.addEventListener("change", render);
  elements.toFilter.addEventListener("change", render);
  elements.tableBody.addEventListener("click", handleTableAction);

  function saveExpense(event) {
    event.preventDefault();

    var amount = Number(elements.amount.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      elements.amount.focus();
      return;
    }

    var expense = {
      id: elements.expenseId.value || createId(),
      date: elements.date.value,
      description: elements.description.value.trim(),
      amount: Math.round(amount * 100) / 100,
      category: elements.category.value,
      note: elements.note.value.trim(),
      createdAt: new Date().toISOString()
    };

    var existingIndex = expenses.findIndex(function (item) {
      return item.id === expense.id;
    });

    if (existingIndex >= 0) {
      expense.createdAt = expenses[existingIndex].createdAt;
      expenses[existingIndex] = expense;
    } else {
      expenses.unshift(expense);
    }

    persist();
    resetForm();
    render();
  }

  function handleTableAction(event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    var id = button.getAttribute("data-id");
    var expense = expenses.find(function (item) {
      return item.id === id;
    });

    if (!expense) {
      return;
    }

    if (button.getAttribute("data-action") === "edit") {
      elements.expenseId.value = expense.id;
      elements.date.value = expense.date;
      elements.description.value = expense.description;
      elements.amount.value = expense.amount.toFixed(2);
      elements.category.value = expense.category;
      elements.note.value = expense.note;
      elements.formTitle.textContent = "Edit expense";
      elements.submit.textContent = "Update expense";
      elements.description.focus();
      return;
    }

    expenses = expenses.filter(function (item) {
      return item.id !== id;
    });
    persist();
    render();
  }

  function render() {
    var filtered = getFilteredExpenses();
    renderSummary(filtered);
    renderRows(filtered);
  }

  function renderSummary(items) {
    var now = new Date();
    var monthKey = String(now.getFullYear()) + "-" + String(now.getMonth() + 1).padStart(2, "0");
    var total = items.reduce(sumAmount, 0);
    var monthTotal = expenses
      .filter(function (expense) {
        return expense.date.indexOf(monthKey) === 0;
      })
      .reduce(sumAmount, 0);

    elements.totalSpent.textContent = formatMoney(total);
    elements.monthSpent.textContent = formatMoney(monthTotal);
    elements.entryCount.textContent = String(items.length);
    elements.topCategory.textContent = getTopCategory(items);
  }

  function renderRows(items) {
    elements.tableBody.innerHTML = "";
    elements.emptyState.hidden = items.length > 0;

    items.forEach(function (expense) {
      var row = document.createElement("tr");
      row.innerHTML = [
        "<td>" + escapeHtml(formatDate(expense.date)) + "</td>",
        "<td><strong>" + escapeHtml(expense.description) + "</strong>" + noteHtml(expense.note) + "</td>",
        "<td><span class=\"category-pill\">" + escapeHtml(expense.category) + "</span></td>",
        "<td class=\"amount-cell\">" + escapeHtml(formatMoney(expense.amount)) + "</td>",
        "<td class=\"action-cell\"><span class=\"row-actions\">",
        "<button type=\"button\" class=\"text-button\" data-action=\"edit\" data-id=\"" + escapeHtml(expense.id) + "\">Edit</button>",
        "<button type=\"button\" class=\"text-button danger\" data-action=\"delete\" data-id=\"" + escapeHtml(expense.id) + "\">Delete</button>",
        "</span></td>"
      ].join("");
      elements.tableBody.appendChild(row);
    });
  }

  function getFilteredExpenses() {
    var searchTerm = elements.search.value.trim().toLowerCase();
    var category = elements.categoryFilter.value;
    var from = elements.fromFilter.value;
    var to = elements.toFilter.value;

    return expenses
      .filter(function (expense) {
        var matchesSearch = !searchTerm ||
          expense.description.toLowerCase().indexOf(searchTerm) >= 0 ||
          expense.note.toLowerCase().indexOf(searchTerm) >= 0;
        var matchesCategory = category === "all" || expense.category === category;
        var matchesFrom = !from || expense.date >= from;
        var matchesTo = !to || expense.date <= to;
        return matchesSearch && matchesCategory && matchesFrom && matchesTo;
      })
      .sort(function (a, b) {
        if (a.date === b.date) {
          return b.createdAt.localeCompare(a.createdAt);
        }
        return b.date.localeCompare(a.date);
      });
  }

  function resetForm() {
    elements.form.reset();
    elements.expenseId.value = "";
    elements.date.value = today();
    elements.formTitle.textContent = "Add expense";
    elements.submit.textContent = "Save expense";
  }

  function loadExpenses() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(expenses));
  }

  function getTopCategory(items) {
    if (!items.length) {
      return "None";
    }

    var totals = items.reduce(function (bucket, expense) {
      bucket[expense.category] = (bucket[expense.category] || 0) + expense.amount;
      return bucket;
    }, {});

    return Object.keys(totals).sort(function (a, b) {
      return totals[b] - totals[a];
    })[0];
  }

  function sumAmount(total, expense) {
    return total + expense.amount;
  }

  function createId() {
    return "expense-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(value);
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value + "T00:00:00"));
  }

  function noteHtml(note) {
    return note ? "<span class=\"note\">" + escapeHtml(note) + "</span>" : "";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
