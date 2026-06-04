(function () {
  var storageKey = "daily-expense-tracker-records";
  var form = document.getElementById("expenseForm");
  var expenseId = document.getElementById("expenseId");
  var expenseDate = document.getElementById("expenseDate");
  var expenseName = document.getElementById("expenseName");
  var expenseAmount = document.getElementById("expenseAmount");
  var expenseCategory = document.getElementById("expenseCategory");
  var expenseNote = document.getElementById("expenseNote");
  var rows = document.getElementById("expenseRows");
  var emptyState = document.getElementById("emptyState");
  var formTitle = document.getElementById("formTitle");
  var submitButton = document.getElementById("submitButton");
  var cancelEdit = document.getElementById("cancelEdit");
  var filterFrom = document.getElementById("filterFrom");
  var filterTo = document.getElementById("filterTo");
  var filterCategory = document.getElementById("filterCategory");
  var clearFilters = document.getElementById("clearFilters");
  var todayTotal = document.getElementById("todayTotal");
  var monthTotal = document.getElementById("monthTotal");
  var recordCount = document.getElementById("recordCount");
  var averageSpend = document.getElementById("averageSpend");

  var expenses = loadExpenses();

  expenseDate.value = todayAsInput();
  render();

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var record = {
      id: expenseId.value || String(Date.now()),
      date: expenseDate.value,
      name: expenseName.value.trim(),
      amount: Number(expenseAmount.value),
      category: expenseCategory.value,
      note: expenseNote.value.trim()
    };

    if (!record.date || !record.name || !record.amount || record.amount <= 0) {
      return;
    }

    if (expenseId.value) {
      expenses = expenses.map(function (item) {
        return item.id === record.id ? record : item;
      });
    } else {
      expenses.push(record);
    }

    saveExpenses();
    resetForm();
    render();
  });

  rows.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    var id = button.getAttribute("data-id");
    var action = button.getAttribute("data-action");
    var record = expenses.find(function (item) {
      return item.id === id;
    });

    if (!record) {
      return;
    }

    if (action === "edit") {
      startEdit(record);
    }

    if (action === "delete") {
      expenses = expenses.filter(function (item) {
        return item.id !== id;
      });
      saveExpenses();
      render();
    }
  });

  [filterFrom, filterTo, filterCategory].forEach(function (control) {
    control.addEventListener("input", render);
  });

  cancelEdit.addEventListener("click", resetForm);

  clearFilters.addEventListener("click", function () {
    filterFrom.value = "";
    filterTo.value = "";
    filterCategory.value = "All";
    render();
  });

  function loadExpenses() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || [];
    } catch (error) {
      return [];
    }
  }

  function saveExpenses() {
    localStorage.setItem(storageKey, JSON.stringify(expenses));
  }

  function render() {
    var visibleExpenses = getFilteredExpenses();
    visibleExpenses.sort(function (a, b) {
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });

    rows.innerHTML = "";
    visibleExpenses.forEach(function (item) {
      rows.appendChild(createExpenseRow(item));
    });

    emptyState.classList.toggle("hidden", visibleExpenses.length > 0);
    updateSummary();
  }

  function createExpenseRow(item) {
    var row = document.createElement("tr");
    row.innerHTML = [
      "<td>" + formatDate(item.date) + "</td>",
      "<td><div class=\"row-title\">" + escapeHtml(item.name) + "</div>" + renderNote(item.note) + "</td>",
      "<td><span class=\"tag\">" + escapeHtml(item.category) + "</span></td>",
      "<td class=\"amount-cell\">" + formatMoney(item.amount) + "</td>",
      "<td><div class=\"actions\">",
      "<button type=\"button\" class=\"ghost-button\" data-action=\"edit\" data-id=\"" + item.id + "\">Edit</button>",
      "<button type=\"button\" class=\"danger-button\" data-action=\"delete\" data-id=\"" + item.id + "\">Delete</button>",
      "</div></td>"
    ].join("");
    return row;
  }

  function renderNote(note) {
    return note ? "<div class=\"row-note\">" + escapeHtml(note) + "</div>" : "";
  }

  function getFilteredExpenses() {
    return expenses.filter(function (item) {
      var fromMatches = !filterFrom.value || item.date >= filterFrom.value;
      var toMatches = !filterTo.value || item.date <= filterTo.value;
      var categoryMatches = filterCategory.value === "All" || item.category === filterCategory.value;
      return fromMatches && toMatches && categoryMatches;
    });
  }

  function updateSummary() {
    var today = todayAsInput();
    var month = today.slice(0, 7);
    var allTotal = expenses.reduce(sumAmount, 0);
    var monthSum = expenses.filter(function (item) {
      return item.date.slice(0, 7) === month;
    }).reduce(sumAmount, 0);
    var todaySum = expenses.filter(function (item) {
      return item.date === today;
    }).reduce(sumAmount, 0);

    todayTotal.textContent = formatMoney(todaySum);
    monthTotal.textContent = formatMoney(monthSum);
    recordCount.textContent = String(expenses.length);
    averageSpend.textContent = formatMoney(expenses.length ? allTotal / expenses.length : 0);
  }

  function sumAmount(total, item) {
    return total + Number(item.amount || 0);
  }

  function startEdit(record) {
    expenseId.value = record.id;
    expenseDate.value = record.date;
    expenseName.value = record.name;
    expenseAmount.value = record.amount;
    expenseCategory.value = record.category;
    expenseNote.value = record.note || "";
    formTitle.textContent = "Edit expense";
    submitButton.textContent = "Update expense";
    cancelEdit.classList.remove("hidden");
    expenseName.focus();
  }

  function resetForm() {
    form.reset();
    expenseId.value = "";
    expenseDate.value = todayAsInput();
    formTitle.textContent = "Add expense";
    submitButton.textContent = "Save expense";
    cancelEdit.classList.add("hidden");
  }

  function todayAsInput() {
    var now = new Date();
    var offset = now.getTimezoneOffset();
    var localDate = new Date(now.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  function formatDate(value) {
    return new Date(value + "T00:00:00").toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatMoney(value) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD"
    }).format(Number(value || 0));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

})();
