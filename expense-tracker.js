import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

var firebaseConfig = {
  apiKey: "AIzaSyAoRMybyh_83sEgcKnF_yUK3_hs4zXWF9c",
  authDomain: "expense-3ddb0.firebaseapp.com",
  projectId: "expense-3ddb0",
  storageBucket: "expense-3ddb0.firebasestorage.app",
  messagingSenderId: "678543474449",
  appId: "1:678543474449:web:9fe7f3c4c4120c6fa496b0"
};

var householdId = "shared-household";

(function () {
  var appPanel = document.getElementById("appPanel");
  var authPanel = document.getElementById("authPanel");
  var loginForm = document.getElementById("loginForm");
  var loginEmail = document.getElementById("loginEmail");
  var loginPassword = document.getElementById("loginPassword");
  var loginButton = document.getElementById("loginButton");
  var authMessage = document.getElementById("authMessage");
  var userEmail = document.getElementById("userEmail");
  var signOutButton = document.getElementById("signOutButton");
  var bookForm = document.getElementById("bookForm");
  var newBookMonth = document.getElementById("newBookMonth");
  var bookMessage = document.getElementById("bookMessage");
  var bookList = document.getElementById("bookList");
  var expenseBook = document.getElementById("expenseBook");
  var activeBookLabel = document.getElementById("activeBookLabel");
  var expenseModal = document.getElementById("expenseModal");
  var openExpenseModal = document.getElementById("openExpenseModal");
  var form = document.getElementById("expenseForm");
  var expenseId = document.getElementById("expenseId");
  var expenseDate = document.getElementById("expenseDate");
  var expenseName = document.getElementById("expenseName");
  var expenseAmount = document.getElementById("expenseAmount");
  var expenseCategory = document.getElementById("expenseCategory");
  var categoryField = document.getElementById("categoryField");
  var payerToggle = document.querySelector(".payer-toggle");
  var descriptionPresetButtons = document.querySelectorAll("[data-description]");
  var expenseNote = document.getElementById("expenseNote");
  var appMessage = document.getElementById("appMessage");
  var rows = document.getElementById("expenseRows");
  var emptyState = document.getElementById("emptyState");
  var formTitle = document.getElementById("formTitle");
  var submitButton = document.getElementById("submitButton");
  var cancelEdit = document.getElementById("cancelEdit");
  var filterCategory = document.getElementById("filterCategory");
  var todayTotal = document.getElementById("todayTotal");
  var monthTotal = document.getElementById("monthTotal");
  var incomeTotal = document.getElementById("incomeTotal");

  var app;
  var auth;
  var db;
  var currentUser = null;
  var months = [];
  var selectedMonthId = getMonthId(todayAsInput());
  var expenses = [];
  var monthUnsubscribe = null;
  var expenseUnsubscribes = [];
  var editingMonthId = "";

  expenseDate.value = todayAsInput();
  newBookMonth.value = selectedMonthId;
  render();

  if (firebaseConfig.apiKey.indexOf("PASTE_") === 0) {
    authMessage.textContent = "Add your Firebase config in expense-tracker.js before signing in.";
    loginForm.querySelector("button").disabled = true;
  } else {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setAuthStatus("Ready to sign in.", "");

    onAuthStateChanged(auth, function (user) {
      currentUser = user;
      if (user) {
        userEmail.textContent = user.email || "";
        authPanel.classList.add("hidden");
        appPanel.classList.remove("hidden");
        ensureMonthBook(selectedMonthId).catch(function (error) {
          setStatus(friendlyFirebaseError(error), "error");
        });
        listenForSharedExpenses();
      } else {
        stopListening();
        expenses = [];
        render();
        appPanel.classList.add("hidden");
        authPanel.classList.remove("hidden");
      }
    });
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    setAuthStatus("Signing in...", "");
    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";
    signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value)
      .then(function () {
        loginForm.reset();
        setAuthStatus("Signed in.", "success");
      })
      .catch(function (error) {
        setAuthStatus(friendlyFirebaseError(error), "error");
      })
      .finally(function () {
        loginButton.disabled = false;
        loginButton.textContent = "Sign in";
      });
  });

  signOutButton.addEventListener("click", function () {
    signOut(auth);
  });

  openExpenseModal.addEventListener("click", function () {
    resetForm();
    openModal();
  });

  expenseModal.addEventListener("click", function (event) {
    if (event.target === expenseModal) {
      resetForm();
      closeModal();
    }
  });

  bookForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser || !newBookMonth.value) {
      return;
    }

    if (!isValidMonth(newBookMonth.value)) {
      setBookStatus("Use month format YYYY-MM, for example 2026-06.", "error");
      return;
    }

    try {
      setBookStatus("Creating book...", "");
      await ensureMonthBook(newBookMonth.value);
      selectMonthBook(newBookMonth.value);
      setBookStatus("Book is ready.", "success");
    } catch (error) {
      setBookStatus(friendlyFirebaseError(error), "error");
    }
  });

  bookList.addEventListener("change", function () {
    selectMonthBook(bookList.value);
  });

  expenseBook.addEventListener("change", function () {
    selectMonthBook(expenseBook.value);
  });

  document.querySelectorAll("input[name=\"entryType\"]").forEach(function (control) {
    control.addEventListener("change", updateEntryLabels);
  });

  payerToggle.querySelectorAll("label").forEach(function (label) {
    label.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      var control = label.querySelector("input[name=\"expensePaidBy\"]");
      if (control) {
        setSelectedPayer(control.value);
      }
    });

    label.addEventListener("click", function () {
      var control = label.querySelector("input[name=\"expensePaidBy\"]");
      if (control) {
        setSelectedPayer(control.value);
      }
    });
  });

  descriptionPresetButtons.forEach(function (button) {
    button.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      setDescriptionPreset(button);
    });

    button.addEventListener("click", function () {
      setDescriptionPreset(button);
    });
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    if (!isValidDate(expenseDate.value)) {
      setStatus("Use date format YYYY-MM-DD, for example 2026-06-05.", "error");
      return;
    }

    var monthId = expenseBook.value || getMonthId(expenseDate.value);
    var record = {
      date: expenseDate.value,
      name: expenseName.value.trim(),
      amount: Number(expenseAmount.value),
      type: getSelectedEntryType(),
      category: getSelectedEntryType() === "income" ? "Income" : expenseCategory.value,
      paidBy: getSelectedPayer(),
      note: expenseNote.value.trim(),
      monthId: monthId,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    };

    if (!record.date || !record.name || !record.amount || record.amount <= 0) {
      return;
    }

    if (record.date.slice(0, 7) !== monthId) {
      record.date = defaultDateForMonth(monthId);
    }

    submitButton.disabled = true;
    setStatus("Saving expense...", "");

    try {
      await ensureMonthBook(monthId);

      if (expenseId.value) {
        if (editingMonthId && editingMonthId !== monthId) {
          await deleteDoc(expenseDoc(editingMonthId, expenseId.value));
          await setDoc(expenseDoc(monthId, expenseId.value), {
            ...record,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid
          });
        } else {
          await updateDoc(expenseDoc(monthId, expenseId.value), record);
        }
      } else {
        await addDoc(expenseCollection(monthId), {
          ...record,
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid
        });
      }

      resetForm();
      setStatus("Expense saved to Firebase.", "success");
      closeModal();
    } catch (error) {
      setStatus(friendlyFirebaseError(error), "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  rows.addEventListener("click", async function (event) {
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
      if (!window.confirm("Delete this entry?")) {
        return;
      }
      try {
        await deleteDoc(expenseDoc(record.monthId, id));
        setStatus("Expense deleted.", "success");
      } catch (error) {
        setStatus(friendlyFirebaseError(error), "error");
      }
    }
  });

  filterCategory.addEventListener("input", render);

  cancelEdit.addEventListener("click", resetForm);
  cancelEdit.addEventListener("click", closeModal);

  function render() {
    renderBooks();
    var visibleExpenses = getFilteredExpenses();
    visibleExpenses.sort(function (a, b) {
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });

    rows.innerHTML = "";
    var activeDate = "";
    visibleExpenses.forEach(function (item) {
      if (item.date !== activeDate) {
        activeDate = item.date;
        rows.appendChild(createDayGroup(activeDate));
      }
      rows.appendChild(createExpenseRow(item));
    });

    emptyState.classList.toggle("hidden", visibleExpenses.length > 0);
    updateSummary();
  }

  function createDayGroup(dateValue) {
    var group = document.createElement("div");
    group.className = "day-group";
    group.textContent = formatDate(dateValue);
    return group;
  }

  function createExpenseRow(item) {
    var row = document.createElement("article");
    row.className = "expense-row";
    row.innerHTML = [
      "<div class=\"expense-main\">",
      "<div class=\"row-title\">" + escapeHtml(item.name) + "</div>",
      "<div class=\"row-meta\">" + renderEntryMeta(item) + "</div>",
      "</div>",
      "<div class=\"expense-side\">",
      "<strong class=\"" + amountClass(item) + "\">" + formatSignedMoney(item) + "</strong>",
      "<div class=\"actions\">",
      "<button type=\"button\" class=\"ghost-button\" data-action=\"edit\" data-id=\"" + item.id + "\">Edit</button>",
      "<button type=\"button\" class=\"danger-button\" data-action=\"delete\" data-id=\"" + item.id + "\">Delete</button>",
      "</div>",
      "</div>"
    ].join("");
    return row;
  }

  function renderNote(note) {
    return note ? "<div class=\"row-note\">" + escapeHtml(note) + "</div>" : "";
  }

  function renderNoteText(note) {
    return note ? " · " + escapeHtml(note) : "";
  }

  function getFilteredExpenses() {
    return expenses.filter(function (item) {
      var bookMatches = !selectedMonthId || item.monthId === selectedMonthId;
      var categoryMatches = getEntryType(item) === "income" || filterCategory.value === "All" || item.category === filterCategory.value;
      return bookMatches && categoryMatches;
    });
  }

  function updateSummary() {
    var today = todayAsInput();
    var month = selectedMonthId || today.slice(0, 7);
    var monthExpenseSum = expenses.filter(function (item) {
      return item.monthId === month && getEntryType(item) === "expense";
    }).reduce(sumAmount, 0);
    var monthIncomeSum = expenses.filter(function (item) {
      return item.monthId === month && getEntryType(item) === "income";
    }).reduce(sumAmount, 0);
    var todaySum = expenses.filter(function (item) {
      return item.date === today && getEntryType(item) === "expense";
    }).reduce(sumAmount, 0);

    todayTotal.textContent = formatMoney(todaySum);
    monthTotal.textContent = formatMoney(monthExpenseSum);
    incomeTotal.textContent = formatMoney(monthIncomeSum);
  }

  function sumAmount(total, item) {
    return total + Number(item.amount || 0);
  }

  function startEdit(record) {
    expenseId.value = record.id;
    editingMonthId = record.monthId;
    selectMonthBook(record.monthId);
    expenseDate.value = record.date;
    expenseName.value = record.name;
    expenseAmount.value = record.amount;
    setSelectedEntryType(getEntryType(record));
    expenseCategory.value = record.category === "Income" ? "Other" : record.category;
    setSelectedPayer(record.paidBy || "yc");
    expenseNote.value = record.note || "";
    updateEntryLabels();
    openModal();
  }

  function resetForm() {
    form.reset();
    expenseId.value = "";
    editingMonthId = "";
    expenseBook.value = selectedMonthId;
    expenseDate.value = defaultDateForMonth(selectedMonthId);
    setSelectedEntryType("expense");
    setSelectedPayer("yc");
    updateEntryLabels();
  }

  function openModal() {
    expenseModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    expenseModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function setDescriptionPreset(button) {
    expenseName.value = button.getAttribute("data-description") || "";
    expenseName.dispatchEvent(new Event("input", { bubbles: true }));
    expenseName.focus();
  }

  function listenForSharedExpenses() {
    stopListening();

    monthUnsubscribe = onSnapshot(collection(db, "households", householdId, "months"), function (snapshot) {
      expenseUnsubscribes.forEach(function (unsubscribe) {
        unsubscribe();
      });
      expenseUnsubscribes = [];
      expenses = [];
      months = [];
      render();

      snapshot.forEach(function (monthSnapshot) {
        var monthId = monthSnapshot.id;
        months.push({
          id: monthId,
          label: monthSnapshot.data().label || formatMonthLabel(monthId)
        });
        var unsubscribeExpenses = onSnapshot(query(expenseCollection(monthId), orderBy("date", "desc")), function (expenseSnapshot) {
          expenses = expenses.filter(function (item) {
            return item.monthId !== monthId;
          });

          expenseSnapshot.forEach(function (expenseSnapshotItem) {
            expenses.push({
              id: expenseSnapshotItem.id,
              ...expenseSnapshotItem.data(),
              monthId: monthId
            });
          });

        render();
      }, function (error) {
        setStatus(friendlyFirebaseError(error), "error");
      });

      expenseUnsubscribes.push(unsubscribeExpenses);
    });
      months.sort(function (a, b) {
        return b.id.localeCompare(a.id);
      });
      if (!months.some(function (month) { return month.id === selectedMonthId; }) && months.length) {
        selectedMonthId = months[0].id;
      }
      render();
    }, function (error) {
      setStatus(friendlyFirebaseError(error), "error");
      stopListening();
    });
  }

  function stopListening() {
    if (monthUnsubscribe) {
      monthUnsubscribe();
      monthUnsubscribe = null;
    }
    expenseUnsubscribes.forEach(function (unsubscribe) {
      unsubscribe();
    });
    expenseUnsubscribes = [];
  }

  function monthDoc(monthId) {
    return doc(db, "households", householdId, "months", monthId);
  }

  function expenseCollection(monthId) {
    return collection(db, "households", householdId, "months", monthId, "expenses");
  }

  function expenseDoc(monthId, id) {
    return doc(db, "households", householdId, "months", monthId, "expenses", id);
  }

  function getMonthId(dateValue) {
    return dateValue.slice(0, 7);
  }

  async function ensureMonthBook(monthId) {
    await setDoc(monthDoc(monthId), {
      label: formatMonthLabel(monthId),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  function selectMonthBook(monthId) {
    selectedMonthId = monthId;
    expenseBook.value = monthId;
    newBookMonth.value = monthId;
    if (!expenseDate.value || expenseDate.value.slice(0, 7) !== monthId) {
      expenseDate.value = defaultDateForMonth(monthId);
    }
    render();
  }

  function renderBooks() {
    var knownMonths = months.slice();
    if (!knownMonths.some(function (month) { return month.id === selectedMonthId; })) {
      knownMonths.push({
        id: selectedMonthId,
        label: formatMonthLabel(selectedMonthId)
      });
    }

    knownMonths.sort(function (a, b) {
      return b.id.localeCompare(a.id);
    });

    expenseBook.innerHTML = "";
    bookList.innerHTML = "";
    knownMonths.forEach(function (month) {
      var option = document.createElement("option");
      option.value = month.id;
      option.textContent = month.label;
      expenseBook.appendChild(option);

      var bookOption = document.createElement("option");
      bookOption.value = month.id;
      bookOption.textContent = month.label + " - " + formatMoney(netTotalForMonth(month.id));
      bookList.appendChild(bookOption);
    });

    expenseBook.value = selectedMonthId;
    bookList.value = selectedMonthId;
    activeBookLabel.textContent = selectedMonthId ? formatMonthLabel(selectedMonthId) : "No book selected";
  }

  function netTotalForMonth(monthId) {
    var income = expenses.filter(function (item) {
      return item.monthId === monthId && getEntryType(item) === "income";
    }).reduce(sumAmount, 0);
    var expense = expenses.filter(function (item) {
      return item.monthId === monthId && getEntryType(item) === "expense";
    }).reduce(sumAmount, 0);
    return income - expense;
  }

  function getSelectedPayer() {
    var selected = document.querySelector("input[name=\"expensePaidBy\"]:checked");
    return selected ? selected.value : "yc";
  }

  function getSelectedEntryType() {
    var selected = document.querySelector("input[name=\"entryType\"]:checked");
    return selected ? selected.value : "expense";
  }

  function setSelectedEntryType(value) {
    var selected = document.querySelector("input[name=\"entryType\"][value=\"" + value + "\"]");
    if (selected) {
      selected.checked = true;
    }
    updateEntryLabels();
  }

  function getEntryType(item) {
    return item.type === "income" ? "income" : "expense";
  }

  function amountClass(item) {
    return getEntryType(item) === "income" ? "income-amount" : "expense-amount";
  }

  function formatSignedMoney(item) {
    var prefix = getEntryType(item) === "income" ? "+" : "";
    return prefix + formatMoney(item.amount);
  }

  function renderCategory(category) {
    return "<span class=\"category-with-icon\"><span class=\"category-icon category-" + escapeHtml(categorySlug(category)) + "\" aria-hidden=\"true\"></span>" + escapeHtml(category || "Other") + "</span>";
  }

  function categorySlug(category) {
    return String(category || "Other").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function updateEntryLabels() {
    var type = getSelectedEntryType();
    var isEditing = Boolean(expenseId.value);
    formTitle.textContent = (isEditing ? "Edit " : "Add ") + type;
    submitButton.textContent = (isEditing ? "Update " : "Save ") + type;
    categoryField.classList.toggle("hidden", type === "income");
  }

  function renderEntryMeta(item) {
    var parts = [];
    if (getEntryType(item) === "income") {
      parts.push("<span class=\"category-with-icon\"><span class=\"category-icon category-income\" aria-hidden=\"true\"></span>Income</span>");
    } else {
      parts.push(renderCategory(item.category));
    }
    parts.push(escapeHtml(item.paidBy || "-"));
    if (item.note) {
      parts.push(escapeHtml(item.note));
    }
    return parts.join(" · ");
  }

  function setSelectedPayer(value) {
    var selected = document.querySelector("input[name=\"expensePaidBy\"][value=\"" + value + "\"]");
    if (selected) {
      selected.checked = true;
    }
  }

  function defaultDateForMonth(monthId) {
    var today = todayAsInput();
    if (today.slice(0, 7) === monthId) {
      return today;
    }
    return monthId + "-01";
  }

  function formatMonthLabel(monthId) {
    return new Date(monthId + "-01T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "long"
    });
  }

  function todayAsInput() {
    var now = new Date();
    var offset = now.getTimezoneOffset();
    var localDate = new Date(now.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  function isValidMonth(value) {
    if (!/^\d{4}-\d{2}$/.test(value || "")) {
      return false;
    }
    var month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12;
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
      return false;
    }
    var parts = value.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function formatDate(value) {
    return new Date(value + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
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

  function friendlyFirebaseError(error) {
    if (!error || !error.code) {
      return "Firebase could not complete that action. Check your project setup.";
    }

    if (error.code === "permission-denied") {
      return "Permission denied. Add this user's UID as a household member in Firestore.";
    }

    if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      return "Email or password is incorrect.";
    }

    if (error.code === "failed-precondition") {
      return "Firestore needs an index or setup change. Check the Firebase console message.";
    }

    return error.message || "Firebase could not complete that action.";
  }

  function setStatus(message, type) {
    appMessage.textContent = message || "";
    appMessage.classList.toggle("status-error", type === "error");
    appMessage.classList.toggle("status-success", type === "success");
  }

  function setBookStatus(message, type) {
    bookMessage.textContent = message || "";
    bookMessage.classList.toggle("status-error", type === "error");
    bookMessage.classList.toggle("status-success", type === "success");
  }

  function setAuthStatus(message, type) {
    authMessage.textContent = message || "";
    authMessage.classList.toggle("status-error", type === "error");
    authMessage.classList.toggle("status-success", type === "success");
  }

})();
